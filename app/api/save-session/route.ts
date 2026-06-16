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

    let user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: session.user.email, name: session.user.name || 'User' }
      });
    }

    const { sessionId, jobProfile, mode, techSplit, hrSplit, codeSplit } = await req.json();

    if (!sessionId || !jobProfile) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find current resume for the user
    const currentResume = await prisma.resume.findFirst({
      where: { userId: user.id, isCurrent: true }
    });

    const interviewSession = await prisma.interviewSession.create({
      data: {
        id: sessionId,
        jobProfile,
        mode: mode || 'practice',
        techSplit: techSplit || 50,
        hrSplit: hrSplit || 25,
        codeSplit: codeSplit || 25,
        userId: user.id,
        resumeId: currentResume?.id || null
      }
    });

    return NextResponse.json({ success: true, session: interviewSession });
  } catch (error) {
    console.error('Failed to save session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
