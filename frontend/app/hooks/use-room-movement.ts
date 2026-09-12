'use client';

import * as React from 'react';

import { updatePresenceMemberV2 } from '@/lib/wakaclock/endpoints-v2';
import { getPresenceClientId } from '@/lib/wakaclock/presence-client';
import type { PresenceV2Snapshot } from '@/lib/wakaclock/types';

interface UseRoomMovementArgs {
  onError?: () => void;
  onSnapshot: (snapshot: PresenceV2Snapshot) => void;
  roomId: null | string;
  snapshot: null | PresenceV2Snapshot;
}

export function useRoomMovement({ onError, onSnapshot, roomId, snapshot }: UseRoomMovementArgs) {
  const sequenceRef = React.useRef(0);
  const generationRef = React.useRef(0);
  const timerRef = React.useRef<null | number>(null);
  const pendingRef = React.useRef<{
    position: { x: number; y: number };
    roomId: string;
    zoneId: null | string;
  } | null>(null);

  const move = React.useCallback(
    (position: { x: number; y: number }) => {
      if (!roomId || !snapshot) return;
      const zone = snapshot.zones.find(
        (candidate) =>
          position.x >= candidate.center_x - candidate.width / 2 &&
          position.x <= candidate.center_x + candidate.width / 2 &&
          position.y >= candidate.center_y - candidate.height / 2 &&
          position.y <= candidate.center_y + candidate.height / 2
      );
      pendingRef.current = { position, roomId, zoneId: zone?.id ?? null };
      if (timerRef.current !== null) return;

      const flush = () => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        timerRef.current = null;
        if (!pending) return;
        const generation = generationRef.current;
        sequenceRef.current += 1;
        void updatePresenceMemberV2(pending.roomId, {
          client_id: getPresenceClientId(),
          client_seq: sequenceRef.current,
          position: pending.position,
          zone_id: pending.zoneId,
        })
          .then((next) => {
            if (generation === generationRef.current) onSnapshot(next);
            return next;
          })
          .catch(() => {
            if (generation === generationRef.current) onError?.();
          });
      };
      flush();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (pendingRef.current) flush();
      }, 250);
    },
    [onError, onSnapshot, roomId, snapshot]
  );

  React.useEffect(() => {
    generationRef.current += 1;
    pendingRef.current = null;
    sequenceRef.current = 0;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      generationRef.current += 1;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [roomId]);

  return { move };
}
