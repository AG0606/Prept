import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ipMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

export function middleware(request: NextRequest) {
  // Only apply to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    let record = ipMap.get(ip);
    if (!record || now - record.lastReset > RATE_LIMIT_WINDOW_MS) {
      record = { count: 1, lastReset: now };
    } else {
      record.count++;
    }
    
    // Prevent unbounded memory growth by cleaning up occasionally (simplified)
    if (ipMap.size > 10000) {
      ipMap.clear();
    }
    
    ipMap.set(ip, record);

    if (record.count > MAX_REQUESTS_PER_WINDOW) {
      return new NextResponse(
        JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
