import { type NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Proxy (formerly Middleware)
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */
/**
 * `/` now serves the marketing homepage (app/(marketing)/page.tsx) — only the bare
 * `/dashboard` path redirects into the product.
 */
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard/wakaclock', request.url));
}

export const config = {
  matcher: ['/dashboard'],
};
