'use client';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryState } from '@/components/wakaclock/query-state';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getDashboardAnalytics } from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { OVERVIEW_RANGE_DAYS } from './overview-toolbar';

export function BrowsingPanel() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const { start, end } = useWakaclockRange(OVERVIEW_RANGE_DAYS);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { data, error, isLoading } = useQuery({
    enabled: Boolean(userId),
    queryFn: () => getDashboardAnalytics({ end, start, timezone }),
    queryKey: wakaclockKeys.dashboardAnalytics(userId, start, end, timezone),
  });
  const browsing = data?.browsing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focused browsing time</CardTitle>
        <CardDescription>
          Measured time across connected browsers in this range, separate from Coding and AI Active.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState error={error} isLoading={isLoading} skeletonClassName="h-32 w-full">
          {browsing ? (
            <div className="space-y-4">
              <p className="text-2xl font-semibold">
                {formatDurationShort(browsing.total_seconds)}
              </p>
              {browsing.total_seconds === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Enable tracking in the AtoAxis browser extension to see your website activity
                  here.
                </p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-3">
                  {[
                    { items: browsing.domains, title: 'Websites' },
                    { items: browsing.projects, title: 'Projects' },
                    { items: browsing.daily, title: 'Daily time' },
                  ].map(({ items, title }) => (
                    <section aria-label={title} key={title}>
                      <h3 className="mb-2 text-sm font-medium">{title}</h3>
                      <ul className="space-y-2 text-sm">
                        {items.map((item) => (
                          <li className="flex justify-between gap-3" key={item.name}>
                            <span className="min-w-0 break-all">{item.name}</span>
                            <span className="shrink-0 tabular-nums">
                              {formatDurationShort(item.seconds)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Browser metrics are unavailable on this server version.
            </p>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
