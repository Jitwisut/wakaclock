'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';

import { QueryState } from '@/components/wakaclock/query-state';
import { RequireUser } from '@/components/wakaclock/require-user';
import { getHeartbeats } from '@/lib/wakaclock/endpoints';
import { todayDateString } from '@/lib/wakaclock/format';
import {
  bucketHeartbeatCounts,
  EMPTY_HEARTBEAT_FILTER,
  type HeartbeatFilter,
  summarizeHeartbeats,
} from '@/lib/wakaclock/heartbeat-stats';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { HeartbeatItem, HeartbeatListResponse } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { CompositionCard, type CompositionFacet } from './components/composition-card';
import { HeartbeatInspector } from './components/heartbeat-inspector';
import { HeartbeatStream } from './components/heartbeat-stream';
import { HourlyRhythm } from './components/hourly-rhythm';
import { PulseMonitor } from './components/pulse-monitor';
import { StatTiles } from './components/stat-tiles';

const NO_ROWS: HeartbeatItem[] = [];

/**
 * `HeartbeatItem` has no unique id from the API, and entity+time+cursor can
 * genuinely collide (two idle heartbeats in the same file within a second), so
 * the occurrence count disambiguates. Unlike an array index, these keys survive
 * a late (offline-queue) heartbeat being inserted mid-list on refetch.
 */
function rowKeys(rows: readonly HeartbeatItem[]) {
  const seen = new Map<string, number>();
  return rows.map((hb) => {
    const base = `${hb.entity}|${hb.time}|${hb.cursor_position ?? ''}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return `${base}|${occurrence}`;
  });
}

interface LiveState {
  beat: number;
  data: HeartbeatListResponse | undefined;
  fresh: ReadonlySet<string>;
  keys: ReadonlySet<string>;
  scope: string;
}

/** Marks rows that arrived since the previous poll of the same day, for the arrival animation. */
function useArrivals(scope: string, data: HeartbeatListResponse | undefined, keys: string[]) {
  const [live, setLive] = React.useState<LiveState>({
    beat: 0,
    data: undefined,
    fresh: new Set(),
    keys: new Set(),
    scope,
  });

  if (data !== live.data || scope !== live.scope) {
    const sameScope = scope === live.scope && live.data !== undefined;
    const fresh = sameScope ? keys.filter((key) => !live.keys.has(key)) : [];
    setLive({
      beat: live.beat + (fresh.length > 0 ? 1 : 0),
      data,
      fresh: fresh.length > 0 || !sameScope ? new Set(fresh) : live.fresh,
      keys: new Set(keys),
      scope,
    });
  }

  return live;
}

function HeartbeatsWorkspace() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [date, setDate] = React.useState(todayDateString());
  const [timezone, setTimezone] = React.useState<null | string>(null);
  const [filter, setFilter] = React.useState<HeartbeatFilter>(EMPTY_HEARTBEAT_FILTER);
  const [inspect, setInspect] = React.useState<{ key: string; open: boolean } | null>(null);

  React.useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.heartbeats(userId, date, timezone ?? undefined),
    queryFn: () => getHeartbeats(userId, date, timezone ?? undefined),
    enabled: Boolean(userId && timezone),
    refetchInterval: 5000,
  });

  const rows = data?.data ?? NO_ROWS;
  const keys = React.useMemo(() => rowKeys(rows), [rows]);
  const summary = React.useMemo(() => summarizeHeartbeats(rows), [rows]);
  const hourly = React.useMemo(() => bucketHeartbeatCounts(rows, 60), [rows]);
  const live = useArrivals(`${userId}|${date}|${timezone}`, data, keys);

  const facets: Record<CompositionFacet, null | string> = {
    agent: filter.agent,
    editor: filter.editor,
    language: filter.language,
    project: filter.project,
  };

  // Looked up by key, not index, so a late heartbeat landing mid-list on refetch
  // cannot swap the row being inspected.
  const inspected = inspect ? (rows[keys.indexOf(inspect.key)] ?? null) : null;

  function changeDate(next: string) {
    setDate(next);
    setInspect(null);
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PulseMonitor
        beat={live.beat}
        date={date}
        isToday={date === todayDateString()}
        onDateChange={changeDate}
        rows={rows}
        summary={summary}
        timezone={timezone}
        total={data?.total ?? rows.length}
      />

      <QueryState
        emptyDescription="Send a test heartbeat above, or point wakaclock-cli at this backend."
        emptyTitle="No heartbeats on this day"
        error={error}
        isEmpty={timezone !== null && !isLoading && !error && rows.length === 0}
        isLoading={timezone === null || isLoading}
        skeletonClassName="h-[520px] w-full rounded-2xl"
      >
        <div className="flex flex-col gap-4 sm:gap-5">
          <StatTiles summary={summary} />
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-3">
              <HourlyRhythm
                hourly={hourly}
                onSelect={(hour) => setFilter((f) => ({ ...f, hour }))}
                selected={filter.hour}
              />
            </div>
            <div className="min-w-0 lg:col-span-2">
              <CompositionCard
                active={facets}
                onToggle={(facet, value) =>
                  setFilter((f) => ({ ...f, [facet]: f[facet] === value ? null : value }))
                }
                summary={summary}
              />
            </div>
          </div>
          <HeartbeatStream
            filter={filter}
            freshKeys={live.fresh}
            keys={keys}
            onFilterChange={setFilter}
            onOpen={(index) => setInspect({ key: keys[index], open: true })}
            rows={rows}
          />
        </div>
      </QueryState>

      <HeartbeatInspector
        heartbeat={inspected}
        onOpenChange={(open) => setInspect((current) => (current ? { ...current, open } : null))}
        open={inspect?.open ?? false}
      />
    </div>
  );
}

export default function HeartbeatsPage() {
  return (
    <RequireUser>
      <HeartbeatsWorkspace />
    </RequireUser>
  );
}
