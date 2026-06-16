import prisma from '@/lib/db';
import { getServerSession } from 'next-auth';

// Create a new resume
export async function POST(req: any) {
  try {
    const session = await getServerSession();
    if (!session || !session.user || !session.user.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    let user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    // Handle DB wipe by recreating user from valid session
    if (!user) {
      user = await prisma.user.create({
        data: { email: session.user.email, name: session.user.name || 'User' }
      });
    }

    const body = await req.json();
    const { name, experience, skills, projects, rawText, rating, suggestions } = body;

    // Unset current for other resumes
    await prisma.resume.updateMany({
      where: { userId: user.id },
      data: { isCurrent: false }
    });

    // Create the new resume
    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        name: name || user.name || 'Resume',
        experience: JSON.stringify(experience || []),
        skills: JSON.stringify(skills || []),
        projects: JSON.stringify(projects || []),
        rawText: rawText || '',
        rating: typeof rating === 'number' ? rating : (typeof rating === 'string' ? parseFloat(rating) || null : null),
        suggestions: suggestions || null,
        isCurrent: true
      }
    });

    return new Response(JSON.stringify(resume), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error saving resume:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Get all resumes
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !session.user || !session.user.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { resumes: { orderBy: { updatedAt: 'desc' } } }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: session.user.email, name: session.user.name || 'User' },
        include: { resumes: true }
      });
    }

    const parsedResumes = user.resumes.map(r => {
      const safeParse = (str: string, fallback: any) => {
        try {
          return JSON.parse(str);
        } catch {
          return fallback;
        }
      };

      return {
        ...r,
        experience: safeParse(r.experience, []),
        skills: safeParse(r.skills, []),
        projects: safeParse(r.projects, []),
      };
    });

    return new Response(JSON.stringify({ resumes: parsedResumes }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error fetching resume:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Set resume as current
export async function PUT(req: any) {
  try {
    const session = await getServerSession();
    if (!session || !session.user || !session.user.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { id } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) return new Response('User not found', { status: 404 });

    await prisma.resume.updateMany({
      where: { userId: user.id },
      data: { isCurrent: false }
    });

    await prisma.resume.update({
      where: { id },
      data: { isCurrent: true }
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error updating resume:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
