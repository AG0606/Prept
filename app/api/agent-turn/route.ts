// ════════════════════════════════════════════════════════════
// Unified Agent Turn API — Merges scoring + sentiment + question generation
// into a SINGLE LLM call per turn, reducing API calls from 5 → 3.
// ════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadBalancer } from '@/lib/loadBalancer';

export const dynamic = 'force-dynamic';

// ── Groq LLM Call ───────────────────────────────────────────
async function callGroq(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not configured');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: options?.temperature ?? 0.6,
      max_tokens: options?.maxTokens ?? 900,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0]) {
    throw new Error('Groq returned empty choices');
  }
  loadBalancer.recordCall('groq');
  return data.choices[0].message.content;
}

// ── Gemini LLM Call ─────────────────────────────────────────
async function callGemini(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: options?.temperature ?? 0.6,
      maxOutputTokens: options?.maxTokens ?? 900,
    },
  });

  const result = await model.generateContent(userMessage);
  loadBalancer.recordCall('gemini');
  return result.response.text();
}

// ── Unified Prompt Builder ──────────────────────────────────
function buildUnifiedPrompt(
  systemInstruction: string,
  lastAnswer: string,
  question: string,
  questionType: string,
  jobRole: string,
  expectedPoints?: string[],
  testResults?: { passed: number; total: number; details?: any[] }
): string {
  const scoringCriteria = questionType === 'coding'
    ? `Coding Criteria: score based on code correctness + efficiency + readability (0=broken, 10=optimal). If test results exist, weight pass rate heavily.`
    : questionType === 'technical'
    ? `Technical Criteria: score based on depth of understanding + accuracy + practical applicability (0=wrong, 10=expert).`
    : `Behavioral Criteria: score based on STAR structure coverage and specificity (0=vague, 10=compelling with examples). starScore: Situation=1, Task=1, Action=1, Result=1.`;

  const expectedSection = expectedPoints?.length
    ? `\nExpected Points: ${expectedPoints.join(', ')}. Check how many the candidate addressed.`
    : '';

  const testSection =
    testResults && testResults.total > 0
      ? `\nTest Results: ${testResults.passed}/${testResults.total} test cases passed.${
          testResults.details
            ? testResults.details
                .filter((d: any) => !d.passed)
                .map((f: any) => `\n  FAIL: input(${f.input}) expected(${f.expected}) got(${f.actual})`)
                .join('')
            : ''
        }`
      : '';

  return `
PREVIOUS QUESTION [${questionType}]: ${question}
CANDIDATE'S ANSWER: ${lastAnswer}
JOB ROLE: ${jobRole}
${expectedSection}${testSection}

TASK: You must do TWO things in a single JSON response:

1. EVALUATE the candidate's answer above:
   - score (0-10): ${scoringCriteria}
   - starScore (0-4): STAR coverage (only for behavioral, set 0 for others)
   - sentiment: "positive", "negative", or "neutral" based on tone/confidence
   - feedback: one concise sentence of constructive feedback

2. DECIDE the next interview action using the system instructions and context provided.

Respond with EXACTLY this JSON structure:
{
  "evaluation": {
    "score": 0,
    "starScore": 0,
    "completeness": 0.0,
    "relevance": 0.0,
    "sentiment": "neutral",
    "feedback": "..."
  },
  "nextAction": {
    "type": "ask_question",
    "question": "...",
    "question_id": "descriptive_slug",
    "questionType": "technical|behavioral|coding",
    "isFollowUp": false,
    "expectedPoints": ["point1", "point2"],
    "testCases": []
  }
}

For end_session: set nextAction.type to "end_session" with "reason" and "finalImpression" fields.
testCases is REQUIRED only for coding questions.
`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const {
      systemInstruction,
      context,
      lastAnswer,
      question,
      questionType,
      jobRole,
      expectedPoints,
      testResults,
    } = body;

    if (!lastAnswer || !question) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build the unified prompt
    const userMessage = buildUnifiedPrompt(
      systemInstruction,
      lastAnswer,
      question,
      questionType || 'behavioral',
      jobRole || 'Software Engineer',
      expectedPoints,
      testResults
    );

    // Combine system instruction + context for the system prompt
    const fullSystemPrompt = `${systemInstruction}\n\nINTERVIEW CONTEXT:\n${context}`;

    // Use load balancer to pick provider
    const provider = loadBalancer.getProvider('speed');

    try {
      const text =
        provider === 'groq'
          ? await callGroq(fullSystemPrompt, userMessage, { temperature: 0.6, maxTokens: 900 })
          : await callGemini(fullSystemPrompt, userMessage, { temperature: 0.6, maxTokens: 900 });

      // Parse the response
      let parsed;
      try {
        let cleaned = text.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse LLM response as JSON');
        }
      }

      // Clamp evaluation scores
      const evaluation = parsed.evaluation || {};
      evaluation.score = Math.max(0, Math.min(10, evaluation.score ?? 5));
      evaluation.starScore = Math.max(0, Math.min(4, evaluation.starScore ?? 0));
      evaluation.completeness = Math.max(0, Math.min(1, evaluation.completeness ?? 0.5));
      evaluation.relevance = Math.max(0, Math.min(1, evaluation.relevance ?? 0.5));
      evaluation.sentiment = evaluation.sentiment || 'neutral';
      evaluation.feedback = evaluation.feedback || 'No feedback available';

      return NextResponse.json({
        evaluation,
        nextAction: parsed.nextAction || parsed,
        provider,
        stats: loadBalancer.getStats(),
      });
    } catch (primaryError) {
      // Fallback to the other provider
      console.warn(`${provider} failed, falling back...`, primaryError);
      const fallbackProvider = provider === 'groq' ? 'gemini' : 'groq';

      try {
        const text =
          fallbackProvider === 'groq'
            ? await callGroq(fullSystemPrompt, userMessage, { temperature: 0.6, maxTokens: 900 })
            : await callGemini(fullSystemPrompt, userMessage, { temperature: 0.6, maxTokens: 900 });

        let parsed;
        try {
          let cleaned = text.trim();
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
          }
          parsed = JSON.parse(cleaned);
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Could not parse fallback LLM response');
          }
        }

        const evaluation = parsed.evaluation || {};
        evaluation.score = Math.max(0, Math.min(10, evaluation.score ?? 5));
        evaluation.starScore = Math.max(0, Math.min(4, evaluation.starScore ?? 0));
        evaluation.completeness = Math.max(0, Math.min(1, evaluation.completeness ?? 0.5));
        evaluation.relevance = Math.max(0, Math.min(1, evaluation.relevance ?? 0.5));
        evaluation.sentiment = evaluation.sentiment || 'neutral';
        evaluation.feedback = evaluation.feedback || 'No feedback available';

        return NextResponse.json({
          evaluation,
          nextAction: parsed.nextAction || parsed,
          provider: fallbackProvider,
          stats: loadBalancer.getStats(),
        });
      } catch (fallbackError) {
        console.error('Both providers failed:', fallbackError);
        // Return default scores and a fallback question
        return NextResponse.json({
          evaluation: {
            score: 5,
            starScore: 2,
            completeness: 0.5,
            relevance: 0.5,
            sentiment: 'neutral',
            feedback: 'Scoring temporarily unavailable',
          },
          nextAction: {
            type: 'ask_question',
            question: 'Tell me about a challenging project you worked on and what you learned.',
            question_id: 'fallback_recovery',
            questionType: 'behavioral',
            isFollowUp: false,
            expectedPoints: ['Clear problem description', 'Actions taken', 'Results achieved'],
          },
          provider: 'fallback',
        });
      }
    }
  } catch (error) {
    console.error('Agent turn error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
