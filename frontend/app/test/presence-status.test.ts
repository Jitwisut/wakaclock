import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { usePresenceActivity } from '@/hooks/use-presence-activity';
import {
  countStates,
  diffSnapshots,
  formatPresenceDuration,
  percentChange,
  presenceHeadline,
} from '@/lib/presence/presence-status';
import type { PresenceV2Snapshot } from '@/lib/wakaclock/types';

function snapshot(overrides: Partial<PresenceV2Snapshot> = {}): PresenceV2Snapshot {
  return {
    room: {
      ended_at: null,
      expires_at: null,
      id: 'room-1',
      kind: 'adhoc',
      name: 'Room',
      team_id: null,
    },
    roster: [],
    server_time: 1000,
    sessions: [],
    version: 1,
    zones: [
      {
        center_x: 20,
        center_y: 20,
        height: 10,
        id: 'zone-a',
        label: 'Table A',
        room_id: 'room-1',
        sort_order: 0,
        width: 10,
      },
    ],
    ...overrides,
  };
}

const alice = {
  position: null,
  state: 'coding' as const,
  user_id: 'a',
  username: 'alice',
  zone_id: null,
};
const bob = {
  position: null,
  state: 'idle' as const,
  user_id: 'b',
  username: 'bob',
  zone_id: null,
};

function session(id: string, zoneId: string) {
  return {
    leaving_deadlines: {},
    participants: [
      { user_id: 'a', username: 'alice' },
      { user_id: 'b', username: 'bob' },
    ],
    session_id: id,
    started_at: 900,
    zone_id: zoneId,
  };
}

describe('presence status helpers', () => {
  it('counts each live state', () => {
    expect(countStates(['coding', 'idle', 'coding', 'offline'])).toEqual({
      coding: 2,
      idle: 1,
      offline: 1,
    });
  });

  it('writes a headline for every room shape', () => {
    expect(presenceHeadline({ coding: 0, idle: 0, offline: 0 })).toBe(
      'Nobody is in this room right now.'
    );
    expect(presenceHeadline({ coding: 1, idle: 0, offline: 0 })).toBe(
      'You have the room to yourself and you are coding.'
    );
    expect(presenceHeadline({ coding: 0, idle: 1, offline: 0 })).toBe(
      'You have the room to yourself.'
    );
    expect(presenceHeadline({ coding: 0, idle: 1, offline: 1 })).toBe(
      '2 people here · nobody is coding right now.'
    );
    expect(presenceHeadline({ coding: 1, idle: 1, offline: 0 })).toBe(
      '1 of 2 people here is coding right now.'
    );
    expect(presenceHeadline({ coding: 2, idle: 1, offline: 0 })).toBe(
      '2 of 3 people here are coding right now.'
    );
  });

  it('computes a percentage change only against a non-zero baseline', () => {
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(5, 0)).toBeNull();
  });

  it('formats durations in minutes and hours', () => {
    expect(formatPresenceDuration(-5)).toBe('0m');
    expect(formatPresenceDuration(125)).toBe('2m');
    expect(formatPresenceDuration(3 * 3600 + 5 * 60)).toBe('3h 5m');
  });
});

describe('diffSnapshots', () => {
  it('reports nothing for the first snapshot', () => {
    expect(diffSnapshots(null, snapshot())).toEqual([]);
  });

  it('reports joins, leaves and session starts and ends', () => {
    const before = snapshot({ roster: [alice], sessions: [session('s-old', 'zone-gone')] });
    const after = snapshot({
      roster: [bob],
      server_time: 1200,
      sessions: [session('s-new', 'zone-a')],
    });
    const previousZones = [
      ...before.zones,
      { ...before.zones[0], id: 'zone-gone', label: 'Old table' },
    ];

    const events = diffSnapshots({ ...before, zones: previousZones }, after);

    expect(events.map((event) => [event.kind, event.text])).toEqual([
      ['joined', 'bob joined the room'],
      ['left', 'alice left the room'],
      ['session_started', 'Co-working started at Table A · alice, bob'],
      ['session_ended', 'Co-working ended at Old table'],
    ]);
    expect(events.every((event) => event.at === 1200)).toBe(true);
  });

  it('ignores sessions and people present on both sides', () => {
    const steady = snapshot({ roster: [alice], sessions: [session('s', 'zone-a')] });

    expect(diffSnapshots(steady, { ...steady, server_time: 2000 })).toEqual([]);
  });

  it('falls back to a generic label for an unknown pod', () => {
    const events = diffSnapshots(snapshot(), snapshot({ sessions: [session('s', 'nowhere')] }));

    expect(events[0].text).toBe('Co-working started at a pod · alice, bob');
  });
});

describe('usePresenceActivity', () => {
  it('collects events across newer snapshots and resets on room change', () => {
    const { rerender, result } = renderHook(({ value }) => usePresenceActivity(value), {
      initialProps: { value: snapshot() as null | PresenceV2Snapshot },
    });
    expect(result.current).toEqual([]);

    act(() => rerender({ value: snapshot({ roster: [alice], version: 2 }) }));
    expect(result.current.map((event) => event.kind)).toEqual(['joined']);

    // Same version again (the stream re-sends every few seconds): nothing new.
    act(() => rerender({ value: snapshot({ roster: [alice, bob], version: 2 }) }));
    expect(result.current).toHaveLength(1);

    // A newer snapshot with no social change adds nothing either.
    act(() => rerender({ value: snapshot({ roster: [alice, bob], version: 3 }) }));
    expect(result.current).toHaveLength(1);

    act(() =>
      rerender({
        value: snapshot({
          room: { ...snapshot().room, id: 'room-2' },
          roster: [alice],
          version: 9,
        }),
      })
    );
    expect(result.current).toEqual([]);

    act(() => rerender({ value: null }));
    expect(result.current).toEqual([]);
  });
});
