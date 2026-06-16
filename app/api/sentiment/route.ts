// ════════════════════════════════════════════════════════════
// Sentiment Analysis API Route — HuggingFace Proxy
// ════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const HF_MODEL = 'distilbert-base-uncased-finetuned-sst-2-english';
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { text } = await req.json();
  const hfToken = process.env.HF_TOKEN;

  if (!hfToken) {
    // Fallback: simple keyword-based sentiment
    return NextResponse.json(fallbackSentiment(text));
  }

  try {
    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text.slice(0, 512) }),
    });

    const result = await response.json();
    const labels = result[0] as { label: string; score: number }[];
    const positive = labels.find((l) => l.label === 'POSITIVE')?.score ?? 0.5;

    return NextResponse.json({
      positive,
      negative: 1 - positive,
      label: positive > 0.6 ? 'positive' : positive < 0.4 ? 'negative' : 'neutral',
    });
  } catch {
    return NextResponse.json(fallbackSentiment(text));
  }
}

function fallbackSentiment(text: string) {
  const positiveWords = /\b(great|excellent|love|amazing|good|success|achieved|proud|happy|excited)\b/gi;
  const negativeWords = /\b(bad|fail|terrible|hate|struggle|difficult|problem|issue|unfortunately)\b/gi;
  const posCount = (text.match(positiveWords) ?? []).length;
  const negCount = (text.match(negativeWords) ?? []).length;
  const total = posCount + negCount || 1;
  const positive = (posCount / total) * 0.6 + 0.2;
  return {
    positive,
    negative: 1 - positive,
    label: positive > 0.6 ? 'positive' : positive < 0.4 ? 'negative' : 'neutral',
  };
}
