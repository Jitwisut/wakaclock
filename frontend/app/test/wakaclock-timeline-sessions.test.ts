import { describe, expect, it } from 'vitest';

import { buildTimelineSessions } from '@/lib/wakaclock/timeline-sessions';
import type { DurationBlock } from '@/lib/wakaclock/types';

function block(start: number, end: number, overrides: Partial<DurationBlock> = {}): DurationBlock {
  return {
    start,
    end,
    duration_seconds: end - start,
    project: 'wakaclock',
    entity: 'main.rs',
    language: 'Rust',
    category: 'coding',
    heartbeat_count: 1,
    ...overrides,
  };
}

describe('project timeline sessions', () => {
  it('combines file, language and category changes into one session without mutating API data', () => {
    const blocks = [
      block(120, 180, { entity: 'test.ts', language: 'TypeScript', category: 'testing' }),
      block(0, 60),
      block(60, 120, { entity: 'lib.rs' }),
    ];
    const original = structuredClone(blocks);
    expect(buildTimelineSessions(blocks)).toEqual([
      {
        project: 'wakaclock',
        start: 0,
        end: 180,
        duration_seconds: 180,
        heartbeat_count: 3,
        languages: ['Rust', 'TypeScript'],
        categories: ['coding', 'testing'],
      },
    ]);
    expect(blocks).toEqual(original);
  });

  it.each(['wakaclock', 'atoaxis-parity-probe', 'another-project'])(
    'groups brief switches for %s without counting another project or gaps',
    (project) => {
      const sessions = buildTimelineSessions([
        block(0, 60, { project }),
        block(60, 120, { project: 'other' }),
        block(120, 180, { project }),
        block(180, 240, { project: null }),
        block(240, 300, { project }),
      ]);
      expect(sessions).toHaveLength(3);
      expect(sessions[0]).toMatchObject({
        project,
        start: 0,
        end: 300,
        duration_seconds: 180,
        heartbeat_count: 3,
      });
      expect(sessions.reduce((sum, session) => sum + session.duration_seconds, 0)).toBe(300);
    }
  );

  it('joins gaps up to five minutes and preserves longer breaks', () => {
    const sessions = buildTimelineSessions([block(0, 60), block(360, 420), block(721, 781)]);
    expect(
      sessions.map(({ start, end, duration_seconds }) => [start, end, duration_seconds])
    ).toEqual([
      [0, 420, 120],
      [721, 781, 60],
    ]);
  });

  it('does not double count overlaps inside a group with gaps', () => {
    const sessions = buildTimelineSessions([block(0, 60), block(120, 240), block(180, 300)]);
    expect(sessions[0]).toMatchObject({ start: 0, end: 300, duration_seconds: 240 });
  });

  it('unions overlapping intervals without extending the session or double counting time', () => {
    const sessions = buildTimelineSessions([
      block(0, 180, { language: null }),
      block(30, 60),
      block(120, 240),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ end: 240, duration_seconds: 240, heartbeat_count: 3 });
  });

  it('handles empty days', () => {
    expect(buildTimelineSessions([])).toEqual([]);
  });
});
