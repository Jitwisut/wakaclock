'use client';

import * as React from 'react';

import {
  endMyPresenceFocusV2,
  getMyPresenceFocusV2,
  startMyPresenceFocusV2,
} from '@/lib/wakaclock/endpoints-v2';

/** Mirrors `FOCUS_MIN_SECONDS` / `FOCUS_MAX_SECONDS` in `redis_presence.rs`. */
export const FOCUS_MIN_SECONDS = 5 * 60;
export const FOCUS_MAX_SECONDS = 8 * 3600;

export function clampFocusSeconds(seconds: number): number {
  return Math.min(FOCUS_MAX_SECONDS, Math.max(FOCUS_MIN_SECONDS, Math.round(seconds)));
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Your focus block ("do not disturb until …"). Loaded once; roommates see it through the
 * room snapshot. `until` is unix seconds and is dropped locally the moment it passes.
 */
export function usePresenceFocus(enabled: boolean) {
  const [until, setUntil] = React.useState<null | number>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<null | string>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const focus = await getMyPresenceFocusV2();
        if (!cancelled) setUntil(focus?.until ?? null);
      } catch (requestError) {
        if (!cancelled) setError(message(requestError, 'Could not load focus mode'));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  React.useEffect(() => {
    if (until === null) return;
    const timer = window.setTimeout(() => setUntil(null), Math.max(0, until * 1000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [until]);

  const start = React.useCallback(async (seconds: number) => {
    setBusy(true);
    try {
      const focus = await startMyPresenceFocusV2(clampFocusSeconds(seconds));
      setUntil(focus?.until ?? null);
      setError(null);
      return true;
    } catch (requestError) {
      setError(message(requestError, 'Could not start focus mode'));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const end = React.useCallback(async () => {
    setBusy(true);
    try {
      await endMyPresenceFocusV2();
      setUntil(null);
      setError(null);
      return true;
    } catch (requestError) {
      setError(message(requestError, 'Could not end focus mode'));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { active: until !== null, busy, end, error, start, until };
}

export type PresenceFocusController = ReturnType<typeof usePresenceFocus>;
