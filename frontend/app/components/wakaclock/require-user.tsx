'use client';

import { AuthPanel } from '@/components/wakaclock/auth-panel';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/**
 * Every wakaclock endpoint (except /status_bar/today) resolves `user_id` from a
 * verified session — gate a page's data fetching behind being logged in, instead of
 * quietly querying with an empty/nil uuid.
 */
export function RequireUser({ children }: { children: React.ReactNode }) {
  const userId = useWakaclockUserStore((s) => s.userId);

  if (!userId) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <AuthPanel />
      </div>
    );
  }

  return children;
}
