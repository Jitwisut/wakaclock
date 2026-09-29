import { describe, expect, it } from 'vitest';

import {
  bucketHeartbeatCounts,
  displayEditor,
  EMPTY_HEARTBEAT_FILTER,
  facetLabel,
  heartbeatHour,
  isAiHeartbeat,
  isFilterActive,
  matchesHeartbeatFilter,
  splitEntityPath,
  summarizeHeartbeats,
} from '@/lib/wakaclock/heartbeat-stats';
import type { ActorType, HeartbeatItem } from '@/lib/wakaclock/types';

function at(hour: number, minute = 0) {
  return new Date(2026, 8, 23, hour, minute, 0).getTime() / 1000;
}

function hb(overrides: Partial<HeartbeatItem> = {}): HeartbeatItem {
  return {
    active_seconds: 30,
    ast_confidence: null,
    ast_language: null,
    branch: 'main',
    category: 'coding',
    cursor_position: null,
    dependencies: [],
    editor: 'vscode',
    entity: '/repo/src/main.rs',
    entity_type: 'file',
    is_write: false,
    language: 'Rust',
    line_number: null,
    lines: null,
    machine: 'mbp',
    operating_system: 'darwin',
    project: 'wakaclock',
    time: at(9),
    ...overrides,
  };
}

describe('summarizeHeartbeats', () => {
  it('keeps Codex attribution distinct from VS Code and never infers it from an editor', () => {
    const codex = hb({ actor_type: 'ai_verified', ai_agent: 'codex', editor: 'vscode' });
    const unknown = hb({ actor_type: 'unknown', ai_agent: 'codex', editor: 'codex-desktop' });
    const inferred = hb({ actor_type: 'ai_inferred', ai_agent: 'codex', editor: 'vscode' });
    const summary = summarizeHeartbeats([codex, unknown, inferred]);
    expect(summary.agents).toEqual([
      { count: 1, label: 'codex' },
      { count: 1, label: 'Unattributed AI' },
    ]);
    expect(summary.editors).toContainEqual({ count: 2, label: 'VS Code' });
    const filter = { ...EMPTY_HEARTBEAT_FILTER, agent: 'codex' };
    expect(matchesHeartbeatFilter(codex, filter)).toBe(true);
    expect(matchesHeartbeatFilter(unknown, filter)).toBe(false);
    expect(matchesHeartbeatFilter(inferred, filter)).toBe(false);
    expect(matchesHeartbeatFilter(codex, { ...EMPTY_HEARTBEAT_FILTER, query: 'codex' })).toBe(true);
    expect(matchesHeartbeatFilter(codex, { ...EMPTY_HEARTBEAT_FILTER, query: 'VS Code' })).toBe(
      true
    );
    expect(isFilterActive(filter)).toBe(true);
  });

  it('returns an empty summary for no rows', () => {
    const summary = summarizeHeartbeats([]);
    expect(summary.total).toBe(0);
    expect(summary.firstTime).toBeNull();
    expect(summary.lastTime).toBeNull();
    expect(summary.projects).toEqual([]);
  });

  it('counts events, never durations, and facet totals add up to the row count', () => {
    const rows = [
      hb({ is_write: true, time: at(9, 5) }),
      hb({ entity: '/repo/web/app.tsx', language: 'TypeScript', time: at(10) }),
      hb({ branch: 'feat', project: 'site', time: at(8, 30) }),
      hb({ branch: null, editor: '', language: null, project: '  ', time: at(11) }),
    ];
    const summary = summarizeHeartbeats(rows);

    expect(summary.total).toBe(4);
    expect(summary.writes).toBe(1);
    expect(summary.files).toBe(2);
    expect(summary.branches).toBe(2);
    expect(summary.firstTime).toBe(at(8, 30));
    expect(summary.lastTime).toBe(at(11));
    for (const facet of [summary.projects, summary.languages, summary.editors]) {
      expect(facet.reduce((sum, e) => sum + e.count, 0)).toBe(rows.length);
    }
    expect(summary.projects[0]).toEqual({ count: 2, label: 'wakaclock' });
    expect(summary.projects.map((p) => p.label)).toContain('Unassigned');
    expect(summary.editors.map((e) => e.label)).toEqual(['VS Code', 'Unknown']);
    expect(summary.categories).toEqual([{ count: 4, label: 'coding' }]);
  });

  it('breaks ties alphabetically', () => {
    const summary = summarizeHeartbeats([hb({ project: 'b' }), hb({ project: 'a' })]);
    expect(summary.projects.map((p) => p.label)).toEqual(['a', 'b']);
  });

  it('splits lines with the same actor rules as the server rollup', () => {
    const summary = summarizeHeartbeats([
      hb({
        actor_type: 'ai_verified',
        ai_lines_added: 10,
        ai_lines_deleted: 2,
        human_lines_added: 99,
      }),
      hb({ actor_type: 'ai_inferred', ai_lines_added: 5 }),
      hb({ actor_type: 'human', ai_lines_added: 99, human_lines_added: 3, human_lines_deleted: 1 }),
      hb({ actor_type: 'unknown', ai_lines_added: 4, human_lines_deleted: 6 }),
      hb({ ai_lines_added: 1 }),
      hb({ actor_type: 'human', unattributed_lines_added: 7, unattributed_lines_deleted: 8 }),
      hb({ actor_type: 'ai_verified', ai_lines_added: -3, ai_lines_deleted: Number.NaN }),
      // An actor outside the known set only contributes its explicit unattributed lines.
      hb({ actor_type: 'legacy' as ActorType, ai_lines_added: 50, unattributed_lines_added: 1 }),
    ]);

    expect(summary.aiEvents).toBe(3);
    expect(summary.aiLines).toEqual({ added: 15, deleted: 2 });
    expect(summary.humanLines).toEqual({ added: 3, deleted: 1 });
    expect(summary.unattributedLines).toEqual({ added: 13, deleted: 14 });
  });
});

describe('bucketHeartbeatCounts', () => {
  it('buckets by local clock and keeps every event', () => {
    const rows = [
      { time: at(0, 1) },
      { time: at(0, 4) },
      { time: at(13, 30) },
      { time: at(23, 59) },
    ];
    const fiveMinute = bucketHeartbeatCounts(rows, 5);
    expect(fiveMinute).toHaveLength(288);
    expect(fiveMinute[0]).toBe(2);
    expect(fiveMinute[(13 * 60 + 30) / 5]).toBe(1);
    expect(fiveMinute[287]).toBe(1);

    const hourly = bucketHeartbeatCounts(rows, 60);
    expect(hourly).toHaveLength(24);
    expect(hourly.reduce((a, b) => a + b, 0)).toBe(rows.length);
    expect(heartbeatHour({ time: at(13, 30) })).toBe(13);
  });
});

describe('filters', () => {
  const rows = [
    hb({ actor_type: 'ai_verified', entity: '/repo/src/lib.rs', is_write: true, time: at(9) }),
    hb({ editor: 'codex-desktop', language: 'TypeScript', project: 'site', time: at(14) }),
    hb({ branch: 'release', project: null, time: at(14, 20) }),
  ];

  function count(patch: Partial<typeof EMPTY_HEARTBEAT_FILTER>) {
    return rows.filter((row) =>
      matchesHeartbeatFilter(row, { ...EMPTY_HEARTBEAT_FILTER, ...patch })
    ).length;
  }

  it('matches everything with the empty filter', () => {
    expect(isFilterActive(EMPTY_HEARTBEAT_FILTER)).toBe(false);
    expect(count({})).toBe(3);
  });

  it('applies each facet', () => {
    expect(count({ writesOnly: true })).toBe(1);
    expect(count({ aiOnly: true })).toBe(1);
    expect(count({ project: 'site' })).toBe(1);
    expect(count({ project: 'Unassigned' })).toBe(1);
    expect(count({ language: 'TypeScript' })).toBe(1);
    expect(count({ editor: 'Codex Desktop' })).toBe(1);
    expect(count({ hour: 14 })).toBe(2);
    expect(count({ query: 'LIB.rs' })).toBe(1);
    expect(count({ query: 'release' })).toBe(1);
    expect(count({ query: '   ' })).toBe(3);
    expect(count({ query: 'nothing-here' })).toBe(0);
  });

  it('reports when any filter is active', () => {
    for (const patch of [
      { aiOnly: true },
      { writesOnly: true },
      { editor: 'x' },
      { hour: 0 },
      { language: 'x' },
      { project: 'x' },
      { query: 'x' },
    ]) {
      expect(isFilterActive({ ...EMPTY_HEARTBEAT_FILTER, ...patch })).toBe(true);
    }
  });
});

describe('labels', () => {
  it('names editors and blank facets', () => {
    expect(displayEditor('vscode')).toBe('VS Code');
    expect(displayEditor('codex-desktop')).toBe('Codex Desktop');
    expect(displayEditor(' zed ')).toBe('zed');
    expect(displayEditor(null)).toBe('Unknown');
    expect(facetLabel(undefined)).toBe('Unknown');
  });

  it('classifies AI actors', () => {
    expect(isAiHeartbeat({ actor_type: 'ai_verified' })).toBe(true);
    expect(isAiHeartbeat({ actor_type: 'ai_inferred' })).toBe(true);
    expect(isAiHeartbeat({ actor_type: 'human' })).toBe(false);
    expect(isAiHeartbeat({})).toBe(false);
  });

  it('splits entity paths', () => {
    expect(splitEntityPath('/repo/src/main.rs')).toEqual({ dir: '/repo/src', name: 'main.rs' });
    expect(splitEntityPath(String.raw`C:\repo\app.ts`)).toEqual({
      dir: 'C:\\repo',
      name: 'app.ts',
    });
    expect(splitEntityPath('/repo/dir/')).toEqual({ dir: '/repo', name: 'dir' });
    expect(splitEntityPath('github.com')).toEqual({ dir: '', name: 'github.com' });
    expect(splitEntityPath('///')).toEqual({ dir: '', name: '///' });
  });
});
