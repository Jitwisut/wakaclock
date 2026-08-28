'use client';

import * as React from 'react';

import { listCoworkingHistoryV2 } from '@/lib/wakaclock/endpoints-v2';
import { getBrowserTimezone } from '@/lib/wakaclock/presence-client';
import type { PresenceHistoryItem } from '@/lib/wakaclock/types';

export interface PresenceWeeklySummary {
  activeDays: number;
  durationSeconds: number;
  sessions: number;
}

export function dateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function useCoworkingHistory(enabled = true) {
  const [items, setItems] = React.useState<PresenceHistoryItem[]>([]);
  const [weeklySummary, setWeeklySummary] = React.useState<null | PresenceWeeklySummary>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<null | string>(null);

  const reload = React.useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const timezone = getBrowserTimezone();
      const today = new Date();
      const todayKey = dateKey(today, timezone);
      const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      const [todayHistory, weekHistory] = await Promise.all([
        listCoworkingHistoryV2({ from: todayKey, limit: 20, timezone, to: todayKey }),
        listCoworkingHistoryV2({
          from: dateKey(weekStart, timezone),
          limit: 100,
          timezone,
          to: todayKey,
        }),
      ]);
      setItems(todayHistory.items);
      setWeeklySummary({
        activeDays: new Set(
          weekHistory.items.map((item) =>
            dateKey(new Date(item.your_joined_at * 1000), timezone)
          )
        ).size,
        durationSeconds: weekHistory.items.reduce(
          (total, item) => total + item.duration_seconds,
          0
        ),
        sessions: weekHistory.items.length,
      });
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'History is unavailable');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return { error, items, loading, reload, weeklySummary };
}
