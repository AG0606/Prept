import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function callGroq(systemPrompt: string, userMessage: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1500,
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0]) {
    throw new Error('Groq returned empty choices');
  }
  return data.choices[0].message.content;
}

async function callGemini(instruction: string, content: string, options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: options?.model ?? 'gemini-flash-latest',
    systemInstruction: instruction,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 1500,
    }
  });

  const result = await model.generateContent(content);
  return result.response.text();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const resumeId = searchParams.get('resumeId');
    const jobProfile = searchParams.get('jobProfile');

    if (!resumeId || !jobProfile) {
      return NextResponse.json({ error: 'Missing resumeId or jobProfile' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const cached = await prisma.resumeQuestion.findUnique({
      where: {
        resumeId_jobProfile: {
          resumeId,
          jobProfile
        }
      }
    });

    if (cached) {
      try {
        const questions = JSON.parse(cached.questions);
        return NextResponse.json({ questions });
      } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON in DB' }, { status: 500 });
      }
    }

    return NextResponse.json({ questions: null });
  } catch (error) {
    console.error('Error fetching resume questions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { resumeId, jobProfile, resumeData } = body;

    if (!resumeId || !jobProfile || !resumeData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify resume belongs to user
    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId: user.id }
    });

    if (!resume) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const systemPrompt = `You are an expert technical interviewer. Generate 5-8 resume-specific interview questions tailored to the candidate's specific experience, projects, and skills gaps for the ${jobProfile} role.
Your questions should:
- Probe architecture decisions made on specific projects mentioned.
- Ask about production usage of skills listed without clear examples.
- Probe gaps between stated skills and demonstrated experience.
- Be extremely specific to the details in the resume.

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "question": "string",
      "questionType": "resume_specific",
      "expectedPoints": ["string", "string"],
      "description": "string"
    }
  ]
}`;

    const userMessage = `Resume Data:\n${JSON.stringify(resumeData, null, 2)}\n\nJob Profile: ${jobProfile}`;

    let resultText = '';
    
    try {
      resultText = await callGroq(systemPrompt, userMessage, { temperature: 0.7, maxTokens: 1500 });
    } catch (error) {
      console.warn('Groq failed for resume questions, falling back to Gemini...', error);
      try {
        resultText = await callGemini(systemPrompt, userMessage, { temperature: 0.7, maxTokens: 1500 });
      } catch (fallbackError) {
        console.error('Both providers failed for resume questions:', fallbackError);
        return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
      }
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(resultText);
    } catch (e) {
      console.error('Failed to parse LLM response', e);
      return NextResponse.json({ error: 'Invalid response from LLM' }, { status: 500 });
    }

    const generatedQuestions = parsedResult.questions || [];

    const saved = await prisma.resumeQuestion.upsert({
      where: {
        resumeId_jobProfile: {
          resumeId,
          jobProfile
        }
      },
      update: {
        questions: JSON.stringify(generatedQuestions)
      },
      create: {
        resumeId,
        jobProfile,
        questions: JSON.stringify(generatedQuestions)
      }
    });

    return NextResponse.json({ questions: generatedQuestions });
  } catch (error) {
    console.error('Error generating resume questions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
