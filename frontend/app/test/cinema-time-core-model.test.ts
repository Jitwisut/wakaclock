import { describe, expect, it } from 'vitest';

import {
  buildTimeCore,
  OTHER_PROJECTS_LABEL,
  oklchToHex,
  TIME_CORE_MAX_RINGS,
} from '@/lib/wakaclock/time-core';

import type { DurationBlock, DurationsResponse } from '@/lib/wakaclock/types';

const START = 1_793_984_400; // a midnight, as the server reports range_start

function block(project: null | string, startHour: number, minutes: number): DurationBlock {
  const start = START + startHour * 3600;
  return {
    category: 'coding',
    duration_seconds: minutes * 60,
    end: start + minutes * 60,
    entity: 'file.ts',
    heartbeat_count: 3,
    language: 'TypeScript',
    project,
    start,
  };
}

function response(
  data: DurationBlock[],
  extra: Partial<DurationsResponse> = {}
): DurationsResponse {
  return {
    data,
    date: '2026-11-06',
    range_end: START + 24 * 3600,
    range_start: START,
    total: 0,
    ...extra,
  };
}

describe('buildTimeCore', () => {
  it('places each session on its project ring at the hour it happened', () => {
    const model = buildTimeCore(response([block('web', 6, 60), block('api', 12, 30)]));
    expect(model.totalSeconds).toBe(90 * 60);
    expect(model.sessionCount).toBe(2);
    expect(model.rings.map((ring) => ring.label)).toEqual(['web', 'api']);
    const [web] = model.rings[0].arcs;
    expect(web.startAngle).toBeCloseTo(Math.PI / 2);
    expect(web.endAngle).toBeCloseTo(Math.PI / 2 + (Math.PI * 2) / 24);
    expect(model.rings[1].arcs[0].startAngle).toBeCloseTo(Math.PI);
    expect(model.rings[0].color).toMatch(/^#[\da-f]{6}$/);
    expect(model.rings[0].cssColor).toMatch(/^oklch\(/);
  });

  it("uses the server's Activity with timeout figure for the headline", () => {
    const blocks = [block('web', 6, 60)];
    expect(
      buildTimeCore(response(blocks, { wakatime_compatible_seconds: 4000 })).totalSeconds
    ).toBe(4000);
    expect(buildTimeCore(response(blocks, { total_seconds: 3700 })).totalSeconds).toBe(3700);
    expect(
      buildTimeCore(response(blocks, { total_seconds: 3700, wakatime_compatible_seconds: 0 }))
        .totalSeconds
    ).toBe(0);
  });

  it('counts time outside any project in the total but draws it on no ring', () => {
    const model = buildTimeCore(
      response([block(null, 3, 20), block('  ', 4, 10), block('web', 9, 30)])
    );
    expect(model.totalSeconds).toBe(60 * 60);
    expect(model.hiddenSeconds).toBe(30 * 60);
    expect(model.rings).toHaveLength(1);
  });

  it('merges projects beyond the ring budget into one "Other projects" ring', () => {
    const blocks = Array.from({ length: TIME_CORE_MAX_RINGS + 2 }, (_, index) =>
      block(`p${index}`, index, 60 - index)
    );
    const model = buildTimeCore(response(blocks));
    expect(model.rings).toHaveLength(TIME_CORE_MAX_RINGS);
    const other = model.rings.at(-1)!;
    expect(other.label).toBe(OTHER_PROJECTS_LABEL);
    expect(other.arcs.map((arc) => arc.project)).toEqual(['p5', 'p6', 'p7']);
    expect(other.totalSeconds).toBe((55 + 54 + 53) * 60);
  });

  it('keeps every project when they fit, ordering ties by name', () => {
    const model = buildTimeCore(response([block('b', 1, 30), block('a', 2, 30)]));
    expect(model.rings.map((ring) => ring.label)).toEqual(['a', 'b']);
  });

  it('shows the human/AI split only when the server says the day was measured', () => {
    const split = {
      active_ai_only_seconds: 600,
      active_human_only_seconds: 1200,
      active_overlap_seconds: 300,
      active_seconds: 2100,
    };
    expect(
      buildTimeCore(response([block('web', 1, 30)], { ...split, active_coverage: 'measured' }))
        .attribution
    ).toEqual({ aiOnlySeconds: 600, humanOnlySeconds: 1200, overlapSeconds: 300 });
    const partial = buildTimeCore(
      response([block('web', 1, 30)], { ...split, active_coverage: 'partial' })
    );
    expect(partial.attribution).toBeNull();
    expect(partial.measuredActiveSeconds).toBe(2100);
    expect(
      buildTimeCore(
        response([block('web', 1, 30)], {
          active_coverage: 'measured',
          active_human_only_seconds: 1,
        })
      ).attribution
    ).toBeNull();
  });

  it('falls back to the local day when the server sends no range', () => {
    const model = buildTimeCore({ data: [], date: '2026-11-06', total: 0 });
    expect(model.rangeEnd - model.rangeStart).toBe(24 * 3600);
    expect(new Date(model.rangeStart * 1000).getHours()).toBe(0);
    expect(model.measuredActiveSeconds).toBeNull();
    expect(model.totalSeconds).toBe(0);
    const bad = buildTimeCore(response([], { range_end: START - 1 }));
    expect(bad.rangeEnd).toBe(START + 24 * 3600);
  });

  it('clamps sessions that spill past the range onto the dial', () => {
    const model = buildTimeCore(response([block('web', 23.5, 90)]));
    expect(model.rings[0].arcs[0].endAngle).toBeCloseTo(Math.PI * 2);
  });

  it('treats a missing data array as an empty day', () => {
    const model = buildTimeCore({ date: '2026-11-06', total: 0 } as DurationsResponse);
    expect(model.rings).toEqual([]);
  });
});

describe('oklchToHex', () => {
  it('converts OKLCH to sRGB hex', () => {
    expect(oklchToHex('oklch(100% 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0% 0 0)')).toBe('#000000');
    expect(oklchToHex('oklch(0.628 0.2577 29.23)')).toBe('#ff0000');
  });

  it('returns a neutral steel for anything it cannot parse', () => {
    expect(oklchToHex('red')).toBe('#8a939e');
  });
});
