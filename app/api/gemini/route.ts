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

  const groqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound'];
  let lastError: any = null;

  for (const model of groqModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          response_format: { type: 'json_object' },
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 1500,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq ${model} error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0]?.message?.content) {
        throw new Error(`Groq ${model} returned empty choices`);
      }
      return data.choices[0].message.content;
    } catch (err) {
      lastError = err;
      console.warn(`Groq model ${model} failed, trying next...`, err);
    }
  }

  throw lastError || new Error('All Groq models failed');
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
  const models = options?.model ? [options.model, 'gemini-3.6-flash', 'gemini-flash-latest'] : ['gemini-3.6-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: instruction,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: options?.temperature ?? 0.3,
          maxOutputTokens: options?.maxTokens ?? 1500,
        }
      });

      const result = await model.generateContent(content);
      return result.response.text();
    } catch (err) {
      lastError = err;
      console.warn(`Gemini model ${modelName} failed:`, err);
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

export async function POST(req: NextRequest) {
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
  const { task, content, instruction } = body;

  // ── Resume Parsing ─────────────────────────────────────────
  if (task === 'parse_resume') {
    const prompt = `${instruction}\n\nRESUME TEXT:\n${content}`;
    try {
      const text = await callGemini(
        'You are a resume parser. Return valid JSON only.',
        prompt,
        { model: 'gemini-3.6-flash', temperature: 0.2, maxTokens: 2000 }
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
  if (task === 'interview_turn') {
    try {
      const text = await callGroq(instruction, content, { temperature: 0.6, maxTokens: 800 });
      return NextResponse.json({ text });
    } catch (error) {
      console.warn('Groq failed for interview_turn, falling back to Gemini...', error);
      try {
        const text = await callGemini(instruction, content, { temperature: 0.6, maxTokens: 800 });
        return NextResponse.json({ text });
      } catch (fallbackError) {
        console.error('Gemini fallback also failed:', fallbackError);
        return NextResponse.json({ error: 'Both Groq and Gemini failed' }, { status: 500 });
      }
    }
  }

  // ── Final Impression ───────────────────────────────────────
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
