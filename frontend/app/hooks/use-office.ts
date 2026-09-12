'use client';
import * as React from 'react';

import {
  getOffice,
  officeCommand,
  type OfficeCommand,
  type OfficeState,
} from '@/lib/wakaclock/office';

export function useOffice(room: null | string) {
  const [data, setData] = React.useState<null | OfficeState>(null);
  const [error, setError] = React.useState<null | string>(null);
  const [pending, setPending] = React.useState(false);
  const generation = React.useRef(0);
  const requestSequence = React.useRef(0);
  const reload = React.useCallback(async () => {
    if (!room) return;
    const { current } = generation;
    const request = ++requestSequence.current;
    try {
      const next = await getOffice(room);
      if (current === generation.current && request === requestSequence.current) {
        setData(next);
        setError(null);
      }
    } catch (error_) {
      if (current === generation.current && request === requestSequence.current) {
        setError(error_ instanceof Error ? error_.message : 'Office connection failed');
      }
    }
  }, [room]);
  React.useEffect(() => {
    generation.current += 1;
    setData(null);
    setPending(false);
    setError(null);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!document.hidden) await reload();
      if (!stopped) timer = setTimeout(() => void tick(), 2000);
    };
    void tick();
    return () => {
      stopped = true;
      generation.current += 1;
      clearTimeout(timer);
    };
  }, [reload]);
  const send = React.useCallback(
    async (command: OfficeCommand) => {
      if (!room) throw new Error('Join a room first');
      const started = generation.current;
      setPending(true);
      try {
        const result = await officeCommand(room, command);
        if (started === generation.current) await reload();
        return result;
      } finally {
        if (started === generation.current) setPending(false);
      }
    },
    [room, reload]
  );
  return { data, error, pending, send, reload };
}
export type OfficeController = ReturnType<typeof useOffice>;
