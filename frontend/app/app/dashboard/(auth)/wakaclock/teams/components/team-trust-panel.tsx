'use client';
import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { QueryState } from '@/components/wakaclock/query-state';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getTeamMeasurementHealth } from '@/lib/wakaclock/team-endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function TeamTrustPanel({ organizationId }: { organizationId: string }) {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const query = useQuery({
    queryKey: wakaclockKeys.teamHealth(userId, organizationId),
    queryFn: () => getTeamMeasurementHealth(organizationId),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const data = query.isError || query.isFetching ? undefined : query.data;
  React.useEffect(() => {
    if (!data && !query.isError) return;
    const key = `team-trust:${userId}:${organizationId}`;
    const state = data
      ? JSON.stringify([
          data.own.capture.status,
          data.own.capture.reason,
          data.own.delivery.status,
          data.own.delivery.reason,
          data.restore.status,
        ])
      : 'unavailable';
    const previous = sessionStorage.getItem(key);
    if (previous !== null && previous !== state) {
      toast('Team data health changed. Review Trust for details.');
    }
    sessionStorage.setItem(key, state);
  }, [data, query.isError, userId, organizationId]);
  return (
    <section aria-label="Team Trust" className="rounded-md border p-3">
      <p className="font-medium">Trust · data readiness</p>
      <QueryState error={query.error} isLoading={query.isLoading}>
        {data && (
          <div className="mt-2 space-y-1">
            <p>
              Your capture: {data.own.capture.status} · {data.own.capture.reason}
            </p>
            <p>
              Your delivery: {data.own.delivery.status} · {data.own.delivery.reason}
            </p>
            <p>Team capture and delivery: withheld until group privacy checks are certified.</p>
            <p>
              GitHub sync: {data.team.integration.status} · {data.team.integration.reason}
            </p>
            <p>
              Retention: {data.team.retention.status} ·{' '}
              {data.team.retention.updated_at ?? 'evidence unavailable'}
            </p>
            <p>Restore protection: {data.restore.status}</p>
            <p className="text-muted-foreground">
              An empty queue does not confirm complete capture. Checked {data.checked_at}.
            </p>
          </div>
        )}
      </QueryState>
    </section>
  );
}
