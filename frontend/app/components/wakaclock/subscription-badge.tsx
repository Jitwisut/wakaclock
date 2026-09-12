'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { getCurrentUser } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/**
 * Header indicator for trial/subscription state. Shares its query key with
 * UserSwitcher's GET /users/current call, so this adds no extra network request.
 */
export function SubscriptionBadge() {
  const userId = useWakaclockUserStore((s) => s.userId);

  const { data } = useQuery({
    queryKey: wakaclockKeys.currentUser(userId ?? 'none'),
    queryFn: () => getCurrentUser(userId as string),
    enabled: Boolean(userId),
  });

  if (!userId || !data) return null;

  const { subscription_status, trial_ends_at } = data.data;

  if (subscription_status === 'active') {
    return null;
  }

  const daysLeft = Math.ceil((trial_ends_at * 1000 - Date.now()) / (24 * 60 * 60 * 1000));

  if (subscription_status === 'trialing' && daysLeft > 0) {
    return (
      <Badge asChild variant={daysLeft <= 3 ? 'destructive' : 'outline'}>
        <Link
          aria-label={`Trial: ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
          href="/dashboard/wakaclock/settings"
        >
          <span className="sm:hidden">{daysLeft}d trial</span>
          <span className="hidden sm:inline">
            Trial: {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
          </span>
        </Link>
      </Badge>
    );
  }

  return (
    <Badge asChild variant="destructive">
      <Link aria-label="Trial ended — subscribe" href="/dashboard/wakaclock/settings">
        <span className="sm:hidden">Subscribe</span>
        <span className="hidden sm:inline">Trial ended — subscribe</span>
      </Link>
    </Badge>
  );
}
