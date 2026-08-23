'use client';

import * as React from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/**
 * Gate for pages whose data only exists for an identified session.
 *
 * This used to render the credential form in place, which meant signing in happened inside
 * the authenticated shell — sidebar, header and all — for an app the visitor could not use
 * yet. It now sends them to the dedicated sign-in page and passes the path they wanted, so
 * they land back where they were going.
 */
export function RequireUser({ children }: { children: React.ReactNode }) {
  const hydrated = useWakaclockUserStore((state) => state.hydrated);
  const userId = useWakaclockUserStore((state) => state.userId);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.toString();
  const next = query ? `${pathname}?${query}` : pathname;

  React.useEffect(() => {
    // Waiting for hydration matters: before the stored session is read, a signed-in
    // visitor is indistinguishable from a signed-out one, and redirecting on that would
    // bounce everyone to the login page on every page load.
    if (hydrated && !userId) router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [hydrated, next, router, userId]);

  if (!userId) {
    return (
      <output
        aria-live="polite"
        className="text-muted-foreground flex min-h-96 items-center justify-center text-sm"
      >
        {hydrated ? 'Redirecting to sign in…' : null}
      </output>
    );
  }

  return children;
}
