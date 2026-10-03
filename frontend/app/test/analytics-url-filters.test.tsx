import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAnalyticsFilters } from '@/hooks/use-analytics-filters';
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/analytics',
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => nav.params,
}));
vi.mock('@/lib/wakaclock/format', () => ({
  todayDateString: () => '2026-10-02',
  daysAgoDateString: (n: number) => `days-ago-${n}`,
}));
beforeEach(() => {
  nav.params = new URLSearchParams();
});
afterEach(() => vi.restoreAllMocks());
it('preserves unrelated URL parameters while changing filters, dates and resetting', () => {
  nav.params = new URLSearchParams(
    'session=receipt&project_id=p&source=ai&actor_type=ai_verified&language=Rust&editor=Code&category=coding&operating_system=Mac&timezone=Asia%2FBangkok&start=2026-09-01&end=2026-09-30'
  );
  const { result } = renderHook(() => useAnalyticsFilters(7));
  expect(result.current.toRequest('UTC')).toEqual({
    start: '2026-09-01',
    end: '2026-09-30',
    timezone: 'Asia/Bangkok',
    project_id: 'p',
    source: 'ai',
    actor_type: 'ai_verified',
    language: 'Rust',
    editor: 'Code',
    category: 'coding',
    operating_system: 'Mac',
  });
  expect(result.current.toRequest('UTC', 'fixed').project_id).toBe('fixed');
  const target = new URL(result.current.href('/details'), 'https://test.invalid');
  expect(target.searchParams.get('actor_type')).toBe('ai_verified');
  expect(target.searchParams.get('operating_system')).toBe('Mac');
  expect(target.searchParams.get('session')).toBeNull();
  act(() => result.current.setFilter('source', 'human'));
  expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining('source=human'), {
    scroll: false,
  });
  act(() => result.current.setFilter('source', 'all'));
  expect(nav.replace.mock.lastCall?.[0]).not.toContain('source=');
  act(() => result.current.setFilter('language'));
  expect(nav.replace.mock.lastCall?.[0]).not.toContain('language=');
  act(() => result.current.setRange({ start: 'a', end: 'b' }));
  expect(nav.replace.mock.lastCall?.[0]).toContain('start=a&end=b');
  act(() => result.current.reset());
  expect(nav.replace).toHaveBeenLastCalledWith(
    '/analytics?session=receipt&start=days-ago-6&end=2026-10-02',
    { scroll: false }
  );
});
it('ignores invalid enums and blank strings, supports an empty URL and explicit href overrides', () => {
  nav.params = new URLSearchParams('source=bad&actor_type=bad&project_id=+&timezone=+');
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone: '' }) }) as Intl.DateTimeFormat
  );
  const view = renderHook(() => useAnalyticsFilters());
  expect(view.result.current.filters).toMatchObject({
    source: undefined,
    actorType: undefined,
    projectId: undefined,
    timezone: 'UTC',
    start: 'days-ago-29',
  });
  expect(view.result.current.href('/target', { timezone: '' })).toBe(
    '/target?start=days-ago-29&end=2026-10-02'
  );
  nav.params = new URLSearchParams();
  view.rerender();
  act(() => view.result.current.setFilter('source', 'all'));
  expect(nav.replace).toHaveBeenLastCalledWith('/analytics', { scroll: false });
});
it('falls back to UTC when browser timezone detection throws', () => {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
    throw new Error('unsupported');
  });
  expect(renderHook(() => useAnalyticsFilters()).result.current.filters.timezone).toBe('UTC');
});
