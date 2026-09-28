'use client';

import * as React from 'react';

import { listCoworkingHistoryV2 } from '@/lib/wakaclock/endpoints-v2';
import { personalPresenceSummary } from '@/lib/wakaclock/office';
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
  const [previousSummary, setPreviousSummary] = React.useState<null | PresenceWeeklySummary>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<null | string>(null);

  const reload = React.useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const timezone = getBrowserTimezone();
      const today = new Date();
      const todayKey = dateKey(today, timezone);
      const day = 24 * 60 * 60 * 1000;
      const weekStart = new Date(today.getTime() - 6 * day);
      // The seven days before this week, for a like-for-like comparison.
      const previousEnd = new Date(today.getTime() - 7 * day);
      const previousStart = new Date(today.getTime() - 13 * day);
      const [todayHistory, weekHistory, previousHistory] = await Promise.all([
        listCoworkingHistoryV2({ from: todayKey, limit: 20, timezone, to: todayKey }),
        personalPresenceSummary({
          from: dateKey(weekStart, timezone),
          timezone,
          to: todayKey,
        }),
        personalPresenceSummary({
          from: dateKey(previousStart, timezone),
          timezone,
          to: dateKey(previousEnd, timezone),
        }),
      ]);
      setItems(todayHistory.items);
      setWeeklySummary(weekHistory);
      setPreviousSummary(previousHistory);
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

  return { error, items, loading, previousSummary, reload, weeklySummary };
}
