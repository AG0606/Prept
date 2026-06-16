import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const HF_MODEL_URL = process.env.HF_SCORER_MODEL
  ? `https://api-inference.huggingface.co/models/${process.env.HF_SCORER_MODEL}`
  : null;

const DEFAULT_SCORE = {
  score: 5, starScore: 2, completeness: 0.5, relevance: 0.5,
  feedback: 'Scoring temporarily unavailable',
};

function buildScoringPrompt(question: string, answer: string, jobRole: string, questionType?: string, expectedPoints?: string[], testResults?: any): string {
  const baseContext = `Role: ${jobRole}\nQuestion: ${question}\nAnswer: ${answer}`;
  
  const expectedSection = expectedPoints?.length
    ? `\nExpected Points: ${expectedPoints.join(', ')}\n- Check how many of these the candidate addressed.`
    : '';

  if (questionType === 'coding') {
    let testSection = '';
    if (testResults && testResults.total > 0) {
      testSection = `\nTest Results: ${testResults.passed}/${testResults.total} test cases passed.`;
      if (testResults.details && testResults.details.length > 0) {
        const failedTests = testResults.details.filter((d: any) => !d.passed);
        if (failedTests.length > 0) {
          testSection += `\nFailed cases:`;
          for (const ft of failedTests) {
            testSection += `\n  - Input: ${ft.input} | Expected: ${ft.expected} | Got: ${ft.actual}`;
          }
        }
      }
    }
    return `Score this CODING interview answer.\n${baseContext}${expectedSection}${testSection}\n\nReturn ONLY valid JSON:\n{"score": 0-10, "starScore": 0, "completeness": 0.0-1.0, "relevance": 0.0-1.0, "feedback": "one sentence"}\n\nCoding Criteria:\n- score: code correctness + efficiency + readability (0=broken, 10=optimal). If test cases ran, weight pass rate heavily: all passed = floor 7, most passed = floor 5, none passed = ceiling 4.\n- completeness: did they handle edge cases and explain their approach?\n- relevance: does the solution fit the problem requirements?\n- starScore: set to 0 (not applicable for coding)\n- feedback: mention test results and time/space complexity if relevant`;
  }
  
  if (questionType === 'technical') {
    return `Score this TECHNICAL interview answer.\n${baseContext}${expectedSection}\n\nReturn ONLY valid JSON:\n{"score": 0-10, "starScore": 0, "completeness": 0.0-1.0, "relevance": 0.0-1.0, "feedback": "one sentence"}\n\nTechnical Criteria:\n- score: depth of understanding + accuracy + practical applicability (0=wrong, 10=expert)\n- completeness: breadth of coverage, trade-offs discussed?\n- relevance: directly applicable to ${jobRole} role?\n- starScore: set to 0 (not applicable for technical)\n- feedback: note any misconceptions or impressive insights`;
  }

  // Default: behavioral/situational/resume_specific
  return `Score this BEHAVIORAL interview answer.\n${baseContext}${expectedSection}\n\nReturn ONLY valid JSON:\n{"score": 0-10, "starScore": 0-4, "completeness": 0.0-1.0, "relevance": 0.0-1.0, "feedback": "one sentence"}\n\nBehavioral Criteria:\n- score: overall quality (0=vague/irrelevant, 10=compelling with specific examples)\n- starScore: STAR structure coverage (Situation=1, Task=1, Action=1, Result=1)\n- completeness: how specific and detailed was the answer?\n- relevance: directly relevant to the ${jobRole} role?\n- feedback: constructive, mention what was missing or what was strong`;
}

/** Parse and clamp a raw JSON score response */
function parseScoreResponse(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  }
  const parsed = JSON.parse(cleaned);
  return {
    score: Math.max(0, Math.min(10, parsed.score ?? 5)),
    starScore: Math.max(0, Math.min(4, parsed.starScore ?? 0)),
    completeness: Math.max(0, Math.min(1, parsed.completeness ?? 0.5)),
    relevance: Math.max(0, Math.min(1, parsed.relevance ?? 0.5)),
    feedback: parsed.feedback || 'No feedback available',
  };
}

/** Score via Groq (Llama 3.3 70B) — primary provider for high-frequency scoring */
async function scoreWithGroq(prompt: string): Promise<ReturnType<typeof parseScoreResponse> | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an interview response scorer. Return ONLY valid JSON with the requested fields. No extra text.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.warn('Groq scoring failed:', response.statusText);
      return null;
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    return parseScoreResponse(text);
  } catch (error) {
    console.warn('Groq scoring error:', error);
    return null;
  }
}

/** Score via Gemini — fallback provider */
async function scoreWithGemini(prompt: string): Promise<ReturnType<typeof parseScoreResponse> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 300,
      }
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseScoreResponse(text);
  } catch (error) {
    console.warn('Gemini scoring error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { question, answer, jobRole, questionType, expectedPoints, testResults } = await req.json();

  // Try HuggingFace first if configured
  if (HF_MODEL_URL && process.env.HF_TOKEN) {
    try {
      const input = `[ROLE: ${jobRole}] [QUESTION: ${question}] [ANSWER: ${answer}]`;
      const res = await fetch(HF_MODEL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: input }),
      });
      const raw = await res.json();
      if (raw[0]) return NextResponse.json(raw[0]);
    } catch {
      // Fall through to LLM scoring
    }
  }

  const prompt = buildScoringPrompt(question, answer, jobRole, questionType, expectedPoints, testResults);

  // PRIMARY: Groq (fast, generous free tier — ~1000 RPD)
  const groqResult = await scoreWithGroq(prompt);
  if (groqResult) return NextResponse.json(groqResult);

  // FALLBACK: Gemini (save quota for low-frequency tasks)
  console.warn('Groq scoring failed or unavailable, trying Gemini...');
  const geminiResult = await scoreWithGemini(prompt);
  if (geminiResult) return NextResponse.json(geminiResult);

  // FINAL FALLBACK: Default scores
  console.error('All scoring providers failed, returning defaults');
  return NextResponse.json(DEFAULT_SCORE);
}
