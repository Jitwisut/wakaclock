'use client';

import * as React from 'react';

import { listPresenceRooms } from '@/lib/wakaclock/endpoints-v2';
import type { PresenceV2Room } from '@/lib/wakaclock/types';

export function usePresenceRooms(enabled = true) {
  const [rooms, setRooms] = React.useState<PresenceV2Room[]>([]);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<null | string>(null);

  const reload = React.useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setRooms(await listPresenceRooms());
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Presence is unavailable');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return { error, loading, reload, rooms };
}

