import prisma from '@/lib/db';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        interviews: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: session.user.email, name: session.user.name || 'User' },
        include: { interviews: true }
      });
    }

    return new Response(JSON.stringify({ interviews: user.interviews }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error fetching history:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
