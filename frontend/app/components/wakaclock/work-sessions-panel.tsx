'use client';

import { useState } from 'react';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { WorkSessionReceiptDrawer } from '@/components/wakaclock/work-session-receipt';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getProjectAnalytics } from '@/lib/wakaclock/endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';
import { getWorkSessions, sessionKeys } from '@/lib/wakaclock/work-sessions';

export function WorkSessionsPanel() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const { featureAvailability } = useCapabilities();
  const enabled = Boolean(userId && featureAvailability?.work_session_receipts);
  const { start, end, setRange } = useWakaclockRange(14);
  const [agent, setAgent] = useState('');
  const [project, setProject] = useState('');
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = params.get('session');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const filters = {
    start,
    end,
    timezone,
    agent: agent || undefined,
    project_id: project || undefined,
  };
  const sessions = useInfiniteQuery({
    queryKey: sessionKeys.list(userId, filters),
    queryFn: ({ pageParam }) => getWorkSessions(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
  });
  const projects = useQuery({
    queryKey: ['wakaclock', userId, 'receipt-projects', start, end, timezone],
    queryFn: () => getProjectAnalytics({ start, end, timezone, limit: 100 }),
    enabled,
  });
  const open = (id?: string) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set('session', id);
    else next.delete('session');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  if (!enabled) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Work sessions</CardTitle>
          <RangePicker onChange={setRange} value={{ start, end }} />
        </div>
        <p className="text-muted-foreground text-sm">
          Experimental · one native session per agent. Runtime certification is pending.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Agent{' '}
            <select
              className="rounded-md border p-2"
              onChange={(event) => setAgent(event.target.value)}
              value={agent}
            >
              <option value="">All agents</option>
              <option value="codex">Codex</option>
              <option value="claude-code">Claude Code</option>
            </select>
          </label>
          <label className="text-sm">
            Project{' '}
            <select
              className="rounded-md border p-2"
              onChange={(event) => setProject(event.target.value)}
              value={project}
            >
              <option value="">All projects</option>
              {projects.data?.items.map((item) => (
                <option key={item.project_id} value={item.project_id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {sessions.isLoading && <p role="status">Loading sessions…</p>}
        {sessions.isError && (
          <p role="alert">
            Could not load sessions.{' '}
            <Button onClick={() => void sessions.refetch()} variant="outline">
              Retry
            </Button>
          </p>
        )}
        {projects.isError && <p role="status">Project filters could not be loaded.</p>}
        {sessions.data && sessions.data.pages[0].items.length === 0 && (
          <p>No received usage sessions in this range.</p>
        )}
        <ul className="divide-y rounded-md border">
          {sessions.data?.pages
            .flatMap((page) => page.items)
            .map((session) => (
              <li key={session.id}>
                <button
                  className="hover:bg-muted flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left"
                  onClick={() => open(session.id)}
                  type="button"
                >
                  <span>
                    <span className="block font-medium">{session.agent}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(session.first_observed_at * 1000).toLocaleString()}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {session.usage_events} received usage events · {session.identity_status}
                  </span>
                </button>
              </li>
            ))}
        </ul>
        {sessions.hasNextPage && (
          <Button
            disabled={sessions.isFetchingNextPage}
            onClick={() => void sessions.fetchNextPage()}
            variant="outline"
          >
            More sessions
          </Button>
        )}
        {selected && (
          <WorkSessionReceiptDrawer
            id={selected}
            key={`${userId}:${selected}`}
            onClose={() => open()}
            userId={userId}
          />
        )}
      </CardContent>
    </Card>
  );
}
