import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
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
    const { sessionId, turn } = body;

    if (!sessionId || !turn) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId: user.id }
    });

    if (!interviewSession) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const savedTurn = await prisma.turn.create({
      data: {
        questionId: turn.questionId || 'unknown',
        question: turn.question || '',
        questionType: turn.questionType || 'behavioral',
        answerSummary: turn.answerSummary || '',
        fullAnswer: turn.fullAnswer || turn.answerSummary || '',
        qualityScore: turn.scores?.quality ?? 0,
        sentiment: turn.scores?.sentiment || 'neutral',
        fillerDensity: turn.scores?.fillerDensity ?? 0,
        gaps: JSON.stringify(turn.gaps || []),
        followUpAsked: turn.followUpAsked || false,
        interviewSessionId: sessionId
      }
    });

    // Update overall score on the session
    const allTurns = await prisma.turn.findMany({
      where: { interviewSessionId: sessionId }
    });
    if (allTurns.length > 0) {
      const avgScore = allTurns.reduce((sum, t) => sum + t.qualityScore, 0) / allTurns.length;
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { overallScore: Math.round(avgScore * 10) / 10 }
      });
    }

    return NextResponse.json({ success: true, turn: savedTurn });
  } catch (error) {
    console.error('Failed to save turn:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
