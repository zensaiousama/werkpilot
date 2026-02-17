import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add early hints for critical resources
  response.headers.set('Link', [
    '</fitness-check>; rel=prefetch',
    '</_next/static/css>; rel=preload; as=style',
  ].join(', '));

  // Add timing headers for performance monitoring
  response.headers.set('Server-Timing', `edge;desc="Edge Processing"`);

  // Vary on network conditions for CDN caching
  const saveData = request.headers.get('save-data');
  if (saveData === 'on') {
    response.headers.set('Vary', 'Save-Data');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon-|sw.js|manifest.json|robots.txt|sitemap).*)',
  ],
};
