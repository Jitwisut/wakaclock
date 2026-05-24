import { type NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Proxy (formerly Middleware)
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard/default', request.url));
}

export const config = {
  matcher: ['/dashboard', '/'],
};
