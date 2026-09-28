'use client';

import * as React from 'react';

import {
  clearMyPresenceStatusV2,
  getMyPresenceStatusV2,
  setMyPresenceStatusV2,
} from '@/lib/wakaclock/endpoints-v2';
import type { PresenceStatusMessage } from '@/lib/wakaclock/types';

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Your own presence status message. Loaded once on mount; teammates see changes through
 * the room's SSE snapshot, so nothing here polls. A status past its `expires_at` is
 * treated as cleared locally too, without waiting for a reload.
 */
export function usePresenceStatus(enabled: boolean) {
  const [status, setStatus] = React.useState<null | PresenceStatusMessage>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<null | string>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const value = await getMyPresenceStatusV2();
        if (!cancelled) setStatus(value);
      } catch (requestError) {
        if (!cancelled) setError(message(requestError, 'Could not load your status'));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  React.useEffect(() => {
    if (!status) return;
    const remaining = status.expires_at * 1000 - Date.now();
    const timer = window.setTimeout(() => setStatus(null), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [status]);

  const save = React.useCallback(
    async (text: string, emoji: null | string, expiresInSeconds: number) => {
      setSaving(true);
      try {
        setStatus(await setMyPresenceStatusV2(text, emoji, expiresInSeconds));
        setError(null);
        return true;
      } catch (requestError) {
        setError(message(requestError, 'Could not save your status'));
        return false;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const clear = React.useCallback(async () => {
    setSaving(true);
    try {
      await clearMyPresenceStatusV2();
      setStatus(null);
      setError(null);
      return true;
    } catch (requestError) {
      setError(message(requestError, 'Could not clear your status'));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { clear, error, save, saving, status };
}

export type PresenceStatusController = ReturnType<typeof usePresenceStatus>;
