import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const { turns, jobProfile, candidateName } = body;

    if (!turns || turns.length === 0) {
      return NextResponse.json({
        impression: 'Not enough data to evaluate.',
        recommendations: ['Complete a full interview session for personalized feedback.'],
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        impression: 'Gemini API key not configured. Could not generate evaluation.',
        recommendations: ['Configure GEMINI_API_KEY to receive AI feedback.'],
      });
    }

    const turnSummaries = turns.map((t: any, i: number) => 
      `Q${i+1} [${t.questionType}]: ${t.question}\nAnswer Summary: ${t.answerSummary}\nScore: ${t.scores?.quality || 0}/10`
    ).join('\n\n');

    const prompt = `You are evaluating an interview session for candidate ${candidateName || 'Candidate'} applying for a ${jobProfile || 'Professional'} role.
Based on the following Q&A summaries, provide a final impression and 2-3 specific recommendations for improvement.

Interview Data:
${turnSummaries}

Return ONLY valid JSON in this exact format:
{
  "impression": "2-3 sentences summarizing their overall performance, technical depth, and communication skills.",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}
`;

    let text = '';

    // Primary: Gemini Flash (with model fallback)
    const geminiModels = ['gemini-3.6-flash', 'gemini-flash-latest'];
    for (const m of geminiModels) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: m,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          }
        });
        const result = await model.generateContent(prompt);
        text = result.response.text().trim();
        if (text) break;
      } catch (geminiError) {
        console.warn(`Gemini evaluate (${m}) failed, trying next...`, geminiError);
      }
    }

    // Secondary: Groq fallback
    if (!text) {
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey) {
        const groqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound'];
        for (const gm of groqModels) {
          try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: gm,
                messages: [
                  { role: 'system', content: 'You are an interview session evaluator. Return ONLY valid JSON with the requested fields.' },
                  { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3,
                max_tokens: 800,
              })
            });

            if (groqRes.ok) {
              const groqData = await groqRes.json();
              if (groqData.choices?.[0]?.message?.content) {
                text = groqData.choices[0].message.content.trim();
                break;
              }
            }
          } catch (groqError) {
            console.error(`Groq fallback (${gm}) failed:`, groqError);
          }
        }
      }
    }

    if (text.startsWith('```')) {
      text = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    
    try {
      const parsed = text ? JSON.parse(text) : null;
      return NextResponse.json({
        impression: parsed?.impression || 'The candidate demonstrated practical strengths and communication capability across the session.',
        recommendations: parsed?.recommendations || ['Practice structuring answers with the STAR method', 'Review core system design fundamentals'],
      });
    } catch {
      return NextResponse.json({
        impression: 'The candidate demonstrated a mix of strengths and areas for improvement across the session.',
        recommendations: ['Practice structuring answers with the STAR method', 'Review technical fundamentals for this role'],
      });
    }

  } catch (error) {
    console.error('Failed to evaluate session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
