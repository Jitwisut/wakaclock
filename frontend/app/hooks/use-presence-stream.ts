'use client';

import * as React from 'react';

import {
  createPresenceStreamTicketV2,
  joinPresenceRoomV2,
  presenceStreamUrlV2,
} from '@/lib/wakaclock/endpoints-v2';
import { getPresenceClientId } from '@/lib/wakaclock/presence-client';
import type { PresenceV2Snapshot } from '@/lib/wakaclock/types';

export type PresenceStreamStatus = 'connecting' | 'live' | 'offline' | 'stale';

export function usePresenceStream(roomId: null | string, inviteToken?: null | string) {
  const [snapshot, setSnapshot] = React.useState<null | PresenceV2Snapshot>(null);
  const [status, setStatus] = React.useState<PresenceStreamStatus>('offline');
  const [reconnectStopped, setReconnectStopped] = React.useState(false);
  const [reconnectNonce, setReconnectNonce] = React.useState(0);

  const applySnapshot = React.useCallback((next: PresenceV2Snapshot) => {
    setSnapshot((current) => (!current || next.version >= current.version ? next : current));
  }, []);

  React.useEffect(() => {
    if (!roomId) {
      setSnapshot(null);
      setStatus('offline');
      return;
    }
    let disposed = false;
    let source: EventSource | null = null;
    let retryTimer: null | number = null;
    let attempts = 0;
    let retryStartedAt = Date.now();

    const scheduleReconnect = () => {
      if (disposed || retryTimer !== null) return;
      if (Date.now() - retryStartedAt >= 10 * 60 * 1000) {
        setReconnectStopped(true);
        setStatus('offline');
        return;
      }
      attempts += 1;
      const delay = [1000, 2000, 5000, 10_000][Math.min(attempts - 1, 3)] ?? 30_000;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void connect();
      }, delay + Math.round(Math.random() * 250));
    };

    const connect = async () => {
      setStatus('connecting');
      try {
        const clientId = getPresenceClientId();
        const joined = await joinPresenceRoomV2(roomId, inviteToken ?? undefined, clientId);
        if (disposed) return;
        applySnapshot(joined);
        const { ticket } = await createPresenceStreamTicketV2(roomId);
        if (disposed) return;
        source = new EventSource(presenceStreamUrlV2(roomId, ticket));
        source.addEventListener('open', () => {
          attempts = 0;
          retryStartedAt = Date.now();
          setReconnectStopped(false);
          setStatus('live');
        });
        source.addEventListener('snapshot', (event) => {
          try {
            applySnapshot(JSON.parse(event.data) as PresenceV2Snapshot);
            setStatus('live');
          } catch {
            setStatus('stale');
          }
        });
        source.addEventListener('error', () => {
          source?.close();
          source = null;
          setStatus('stale');
          scheduleReconnect();
        });
      } catch {
        if (disposed) return;
        setStatus('stale');
        scheduleReconnect();
      }
    };

    void connect();
    return () => {
      disposed = true;
      source?.close();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [applySnapshot, inviteToken, reconnectNonce, roomId]);

  const reconnect = React.useCallback(() => {
    setReconnectStopped(false);
    setReconnectNonce((value) => value + 1);
  }, []);

  return { applySnapshot, reconnect, reconnectStopped, snapshot, status };
}
