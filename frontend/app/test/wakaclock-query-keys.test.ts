import { describe, expect, it } from 'vitest';

import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

describe('wakaclock query keys', () => {
  it('keeps dashboard analytics isolated by user and selected range', () => {
    const first = wakaclockKeys.dashboardAnalytics('user-a', '2026-09-01', '2026-09-08', 'UTC');
    const second = wakaclockKeys.dashboardAnalytics(
      'user-b',
      '2026-09-01',
      '2026-09-08',
      'Asia/Bangkok'
    );

    expect(first).not.toEqual(second);
    expect(first).toContain('user-a');
    expect(first).toContain('UTC');
    expect(second).toContain('user-b');
    expect(second).toContain('Asia/Bangkok');
  });
});

// The QueryClient hashes complete keys; every account-bound factory must keep the
// owner even when no optional filters are selected.
it('isolates every account-bound namespace and keeps deployment capabilities global', () => {
  const keys = Object.entries(wakaclockKeys).filter(
    ([name]) => !['all', 'capabilities'].includes(name)
  );
  const seen = new Set<string>();
  for (const [name, factory] of keys) {
    const make = factory as (...args: string[]) => readonly unknown[];
    const first = make('owner-a', 'filter-a', 'start', 'end', 'UTC');
    const second = make('owner-b', 'filter-a', 'start', 'end', 'UTC');
    expect(first, name).toContain('owner-a');
    expect(first, name).not.toEqual(second);
    expect(first, name).toEqual(make('owner-a', 'filter-a', 'start', 'end', 'UTC'));
    expect(seen.has(JSON.stringify(first)), name).toBe(false);
    seen.add(JSON.stringify(first));
  }
  expect(wakaclockKeys.capabilities()).toEqual(['wakaclock', 'capabilities']);
});
