// ── Werkpilot Dashboard — Next.js Middleware ─────────────────────────
// Runs on every request before the route handler.
// - Protects all routes except /login and /api/auth/*
// - Adds request timing headers
// - Rate limiting headers for API routes
// - CORS handling for API routes

import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'wp-session';

// Routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/api/auth'];

// Rate limit state (in-memory, resets on deployment)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

// Periodic cleanup
if (typeof globalThis !== 'undefined') {
  // Using a global flag to prevent multiple intervals in dev mode
  const g = globalThis as unknown as { __wpRateLimitCleanup?: boolean };
  if (!g.__wpRateLimitCleanup) {
    g.__wpRateLimitCleanup = true;
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of rateLimitMap) {
        if (now > entry.resetAt) rateLimitMap.delete(key);
      }
    }, 30_000);
  }
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  );
}

export function middleware(request: NextRequest) {
  const start = Date.now();
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // ─── CORS Preflight for API routes ────────────────────────────
  if (isApiRoute(pathname) && request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // ─── Rate Limiting for API routes ─────────────────────────────
  if (isApiRoute(pathname)) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '127.0.0.1';

    const key = `${ip}:${pathname}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (entry && now < entry.resetAt) {
      entry.count += 1;
      if (entry.count > RATE_LIMIT) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return NextResponse.json(
          { success: false, error: 'Too many requests' },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(RATE_LIMIT),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(entry.resetAt),
            },
          },
        );
      }
    } else {
      rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    }
  }

  // ─── Auth Check ───────────────────────────────────────────────
  if (!isPublicPath(pathname)) {
    const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

    if (!sessionToken) {
      // API routes get 401, page routes get redirected
      if (isApiRoute(pathname)) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 },
        );
      }

      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Basic token structure check (full validation in API routes)
    const parts = sessionToken.split('.');
    if (parts.length !== 2) {
      if (isApiRoute(pathname)) {
        return NextResponse.json(
          { success: false, error: 'Invalid session' },
          { status: 401 },
        );
      }

      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      // Clear invalid cookie
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
  }

  // ─── Continue with headers ────────────────────────────────────
  const response = NextResponse.next();

  // Request timing
  const elapsed = Date.now() - start;
  response.headers.set('X-Response-Time', `${elapsed}ms`);

  // CORS headers for API routes
  if (isApiRoute(pathname)) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With',
    );

    // Rate limit info headers
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '127.0.0.1';
    const key = `${ip}:${pathname}`;
    const entry = rateLimitMap.get(key);
    if (entry) {
      response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT));
      response.headers.set(
        'X-RateLimit-Remaining',
        String(Math.max(0, RATE_LIMIT - entry.count)),
      );
      response.headers.set('X-RateLimit-Reset', String(entry.resetAt));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
