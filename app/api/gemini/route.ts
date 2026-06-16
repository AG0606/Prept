import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ════════════════════════════════════════════════════════════
// Groq LLM — PRIMARY for high-frequency tasks (interview turns)
// ~1000 RPD free tier with sub-second latency
// ════════════════════════════════════════════════════════════

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
      max_tokens: options?.maxTokens ?? 600,
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ════════════════════════════════════════════════════════════
// Gemini LLM — used for low-frequency tasks + fallback
// ════════════════════════════════════════════════════════════

async function callGemini(instruction: string, content: string, options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: options?.model ?? 'gemini-2.0-flash',
    systemInstruction: instruction,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 600,
    }
  });

  const result = await model.generateContent(content);
  return result.response.text();
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task, content, instruction } = await req.json();

  // ── Resume Parsing ─────────────────────────────────────────
  // LOW frequency (1x per upload) → Gemini first for quality
  if (task === 'parse_resume') {
    const prompt = `${instruction}\n\nRESUME TEXT:\n${content}`;
    try {
      const text = await callGemini(
        'You are a resume parser. Return valid JSON only.',
        prompt,
        { model: 'gemini-2.0-flash', temperature: 0.2, maxTokens: 2000 }
      );
      return NextResponse.json({ text });
    } catch (error) {
      console.warn('Gemini failed for parse_resume, falling back to Groq...', error);
      try {
        const fallbackText = await callGroq('You are a resume parser. Return valid JSON only.', prompt, { temperature: 0.2, maxTokens: 2000 });
        return NextResponse.json({ text: fallbackText });
      } catch (fallbackError) {
        console.error('Groq fallback also failed:', fallbackError);
        return NextResponse.json({ error: 'Both Gemini and Groq failed' }, { status: 500 });
      }
    }
  }

  // ── Interview Turn ─────────────────────────────────────────
  // HIGH frequency (10-15x per session) → Groq FIRST to save Gemini quota
  if (task === 'interview_turn') {
    // Try Groq first (fast, generous free tier)
    try {
      const text = await callGroq(instruction, content, { temperature: 0.7, maxTokens: 600 });
      return NextResponse.json({ text });
    } catch (error) {
      console.warn('Groq failed for interview_turn, falling back to Gemini...', error);
      // Fallback to Gemini
      try {
        const text = await callGemini(instruction, content, { temperature: 0.7, maxTokens: 600 });
        return NextResponse.json({ text });
      } catch (fallbackError) {
        console.error('Gemini fallback also failed:', fallbackError);
        return NextResponse.json({ error: 'Both Groq and Gemini failed' }, { status: 500 });
      }
    }
  }

  // ── Final Impression ───────────────────────────────────────
  // LOW frequency (1x per session) → Gemini first for quality
  if (task === 'generate_impression') {
    try {
      const text = await callGemini(
        instruction,
        content,
        { temperature: 0.6, maxTokens: 800 }
      );
      return NextResponse.json({ text });
    } catch (error) {
      console.warn('Gemini failed for generate_impression, falling back to Groq...', error);
      try {
        const fallbackText = await callGroq(instruction, content, { temperature: 0.6, maxTokens: 800 });
        return NextResponse.json({ text: fallbackText });
      } catch (fallbackError) {
        console.error('Groq fallback also failed:', fallbackError);
        return NextResponse.json({ error: 'Both providers failed' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: 'Unknown task' }, { status: 400 });
}
