import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const interview = await prisma.interviewSession.findUnique({
      where: { id },
      include: {
        turns: { orderBy: { createdAt: 'asc' } },
        resume: true
      }
    });

    if (!interview) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (interview.userId !== (session.user as any).id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Map Prisma turns back to the state shape expected by the UI
    const mappedTurns = interview.turns.map(t => {
      let gaps = [];
      try {
        gaps = JSON.parse(t.gaps);
      } catch (e) {
        gaps = [];
      }
      return {
        questionId: t.questionId,
        question: t.question,
        questionType: t.questionType,
        answerSummary: t.answerSummary,
        fullAnswer: t.fullAnswer,
        scores: {
          quality: t.qualityScore,
          sentiment: t.sentiment,
          fillerDensity: t.fillerDensity,
          dominantEmotion: 'neutral', // emotion history not saved in db currently
          wpm: 0
        },
        gaps,
        followUpAsked: t.followUpAsked
      };
    });

    return NextResponse.json({
      ...interview,
      turns: mappedTurns
    });
  } catch (error) {
    console.error('Error fetching interview:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
