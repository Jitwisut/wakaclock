import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useVisibleNavItems } from '@/hooks/use-visible-nav-items';
import type { NavGroup } from '@/components/layout/sidebar/nav-main';
const state = vi.hoisted(() => ({
  postgresEnabled: undefined as boolean | undefined,
  featureAvailability: undefined as Record<string, boolean> | undefined,
}));
vi.mock('@/hooks/use-capabilities', () => ({ useCapabilities: () => state }));
it('hides unconfirmed capabilities in both sidebar and command palette data, and removes empty groups', () => {
  const items: NavGroup[] = [
    { title: 'Public', items: [{ title: 'Home', href: '/' }] },
    {
      title: 'Conditional',
      items: [
        { title: 'Goals', href: '/goals', requiresPostgres: true },
        { title: 'AI', href: '/ai', requiresFeature: 'ai_analytics' },
      ],
    },
  ];
  const view = renderHook(() => useVisibleNavItems(items));
  expect(view.result.current).toEqual([items[0]]);
  state.postgresEnabled = true;
  state.featureAvailability = { ai_analytics: false };
  view.rerender();
  expect(view.result.current[1].items.map((i) => i.title)).toEqual(['Goals']);
  state.featureAvailability = { ai_analytics: true };
  view.rerender();
  expect(view.result.current).toEqual(items);
  state.postgresEnabled = false;
  state.featureAvailability = {};
  view.rerender();
  expect(view.result.current).toEqual([items[0]]);
});
it('uses the shared navigation definition when no override is supplied', () => {
  state.postgresEnabled = true;
  state.featureAvailability = {};
  const { result } = renderHook(() => useVisibleNavItems());
  expect(result.current.length).toBeGreaterThan(0);
  expect(result.current.flatMap((g) => g.items).every((item) => !item.requiresFeature)).toBe(true);
});
