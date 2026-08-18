import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function callGroq(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not configured');

  const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound'];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error (${model}): ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '{}';
    } catch (e) {
      lastErr = e;
      console.warn(`Groq model ${model} failed in jd-analyze:`, e);
    }
  }

  throw lastErr || new Error('All Groq models failed in jd-analyze');
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number }
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(geminiKey);
  const models = ['gemini-3.6-flash', 'gemini-flash-latest'];
  let lastErr: any = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: options?.temperature ?? 0.3,
        },
      });

      const result = await model.generateContent(userMessage);
      return result.response.text();
    } catch (e) {
      lastErr = e;
      console.warn(`Gemini model ${modelName} failed in jd-analyze:`, e);
    }
  }

  throw lastErr || new Error('All Gemini models failed in jd-analyze');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobDescription, resumeData, jobProfile } = await req.json();

    if (!jobDescription || jobDescription.trim().length < 20) {
      return NextResponse.json({ error: 'Job description too short' }, { status: 400 });
    }

    const systemPrompt = `You are a Principal Technical Recruiter and Engineering Hiring Manager.
You perform rigorous Gap Analysis between a target Job Description and a Candidate's Resume.
Your goal is to pinpoint exact strengths where the candidate excels, and critical missing requirements/competencies that will be targeted during the interview.

OUTPUT FORMAT: Return ONLY a valid JSON object:
{
  "matchScore": 78,
  "matchingStrengths": [
    "Direct match: 4+ years of React and Next.js architecture matches the Senior Frontend requirement.",
    "Strong demonstrated experience with state management and frontend performance optimization."
  ],
  "missingGaps": [
    "JD requires GraphQL and Apollo Client, which is missing from demonstrated work experience.",
    "JD asks for Kubernetes/Docker deployment pipelines not explicitly evidenced in recent projects."
  ],
  "recommendedFocusAreas": [
    "Prepare architectural trade-off comparisons for GraphQL vs RESTful APIs.",
    "Be ready to discuss CI/CD automation and containerization scaling."
  ]
}`;

    const userMessage = `TARGET ROLE: ${jobProfile || 'Software Engineer'}

TARGET JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

CANDIDATE RESUME:
${JSON.stringify(resumeData || {}, null, 2).slice(0, 3000)}

Perform a thorough gap analysis now.`;

    let responseText = '';
    try {
      responseText = await callGroq(systemPrompt, userMessage, { temperature: 0.3 });
    } catch (groqErr) {
      console.warn('Groq JD analysis failed, falling back to Gemini...', groqErr);
      try {
        responseText = await callGemini(systemPrompt, userMessage, { temperature: 0.3 });
      } catch (geminiErr) {
        console.error('Gemini JD analysis fallback also failed:', geminiErr);
      }
    }

    let parsed = {
      matchScore: 75,
      matchingStrengths: ['Core background aligns with stated engineering responsibilities.'],
      missingGaps: ['Specific niche tooling from the job description requires technical depth verification.'],
      recommendedFocusAreas: ['Review core architecture and scalability design patterns.'],
    };

    if (responseText) {
      try {
        const clean = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch (e) {
        console.error('Failed to parse JD analysis output:', e);
      }
    }

    return NextResponse.json({ success: true, analysis: parsed });
  } catch (error) {
    console.error('JD analysis route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
