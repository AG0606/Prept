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

    const { turns, jobProfile, candidateName } = await req.json();

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      }
    });

    const turnSummaries = turns.map((t: any, i: number) => 
      `Q${i+1} [${t.questionType}]: ${t.question}\nAnswer Summary: ${t.answerSummary}\nScore: ${t.scores?.quality || 0}/10`
    ).join('\n\n');

    const prompt = `You are evaluating an interview session for candidate ${candidateName} applying for a ${jobProfile} role.
Based on the following Q&A summaries, provide a final impression and 2-3 specific recommendations for improvement.

Interview Data:
${turnSummaries}

Return ONLY valid JSON in this exact format:
{
  "impression": "2-3 sentences summarizing their overall performance, technical depth, and communication skills.",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if (text.startsWith('```')) {
      text = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    
    try {
      const parsed = JSON.parse(text);
      return NextResponse.json({
        impression: parsed.impression,
        recommendations: parsed.recommendations || [],
      });
    } catch {
      return NextResponse.json({
        impression: 'The candidate demonstrated a mix of strengths and areas for improvement across the session.',
        recommendations: ['Practice structuring answers', 'Review technical fundamentals for this role'],
      });
    }

  } catch (error) {
    console.error('Failed to evaluate session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
