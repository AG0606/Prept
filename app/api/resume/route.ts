import prisma from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Create a new resume
export async function POST(req: any) {
  try {
    const session = await getServerSession(authOptions);
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

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response('Invalid JSON', { status: 400 });
    }
    const { name, email, education, experience, skills, projects, rawText, rating, suggestions } = body;

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
        email: email || null,
        education: JSON.stringify(education || []),
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
    const session = await getServerSession(authOptions);
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

    if (user.resumes.length === 0) {
      const demoResume = await prisma.resume.create({
        data: {
          userId: user.id,
          name: `${user.name || 'Senior Engineer'} Profile`,
          email: user.email,
          education: JSON.stringify([{ degree: 'B.S. Computer Science', institution: 'University of Technology', year: '2022' }]),
          experience: JSON.stringify([{ company: 'ScaleTech Inc.', role: 'Full Stack Engineer', duration: '2022 - Present', bulletPoints: ['Architected distributed event-driven microservices processing 50k req/sec.', 'Reduced p99 query latency by 45% using Redis caching and Postgres indexing.'] }]),
          skills: JSON.stringify(['TypeScript', 'Next.js', 'React', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'System Design', 'TailwindCSS']),
          projects: JSON.stringify([{ name: 'Distributed Rate Limiter', description: 'Token-bucket rate limiter built with Go and Redis clusters.', techStack: ['Go', 'Redis', 'Docker'] }]),
          rawText: 'Full Stack Engineer with 3+ years experience in distributed systems and modern web applications.',
          rating: 8.8,
          suggestions: 'Consider quantifying business impact metrics on the distributed rate limiter project.',
          isCurrent: true,
        }
      });
      user.resumes = [demoResume];
    }

    const parsedResumes = user.resumes.map(r => {
      const safeParse = (str: string | null, fallback: any) => {
        if (!str) return fallback;
        try {
          return JSON.parse(str);
        } catch {
          return fallback;
        }
      };

      return {
        ...r,
        education: safeParse(r.education, []),
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
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response('Invalid JSON', { status: 400 });
    }
    const { id } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) return new Response('User not found', { status: 404 });

    const existingResume = await prisma.resume.findFirst({
      where: { id, userId: user.id }
    });

    if (!existingResume) return new Response('Forbidden', { status: 403 });

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

// Delete resume
export async function DELETE(req: any) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response('Resume ID required', { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) return new Response('User not found', { status: 404 });

    const existingResume = await prisma.resume.findFirst({
      where: { id, userId: user.id }
    });

    if (!existingResume) return new Response('Forbidden or Not Found', { status: 403 });

    await prisma.resume.delete({
      where: { id }
    });

    // If we deleted the current resume, promote the most recent one
    if (existingResume.isCurrent) {
      const mostRecent = await prisma.resume.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' }
      });
      if (mostRecent) {
        await prisma.resume.update({
          where: { id: mostRecent.id },
          data: { isCurrent: true }
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
