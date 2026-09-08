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
