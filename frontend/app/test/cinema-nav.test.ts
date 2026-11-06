import { describe, expect, it } from 'vitest';

import { activeScene, cinemaScenes } from '@/components/layout/cinema/cinema-nav';
import { resolvePreset } from '@/lib/themes';

import type { NavGroup } from '@/components/layout/sidebar/nav-items';

const groups: NavGroup[] = [
  {
    title: 'AtoAxis',
    items: [
      { title: 'Overview', href: '/dashboard/wakaclock' },
      {
        title: 'Analytics',
        href: '/dashboard/wakaclock/analytics/timeline',
        items: [
          { title: 'Timeline', href: '/dashboard/wakaclock/analytics/timeline' },
          { title: 'Projects', href: '/dashboard/wakaclock/analytics/projects' },
        ],
      },
    ],
  },
  { title: 'More', items: [{ title: 'Settings', href: '/dashboard/wakaclock/settings' }] },
];

describe('cinemaScenes', () => {
  it('numbers the visible entries across groups without gaps', () => {
    expect(cinemaScenes(groups).map((scene) => `${scene.number} ${scene.item.title}`)).toEqual([
      '01 Overview',
      '02 Analytics',
      '03 Settings',
    ]);
  });
});

describe('activeScene', () => {
  const scenes = cinemaScenes(groups);

  it('picks the longest matching href, so nested routes beat Overview', () => {
    const found = activeScene('/dashboard/wakaclock/analytics/projects/abc', scenes);
    expect(found.scene?.item.title).toBe('Analytics');
    expect(found.subHref).toBe('/dashboard/wakaclock/analytics/projects');
  });

  it('marks the first view of a section as the sub-view when hrefs coincide', () => {
    const found = activeScene('/dashboard/wakaclock/analytics/timeline', scenes);
    expect(found.subHref).toBe('/dashboard/wakaclock/analytics/timeline');
  });

  it('has no sub-view for a section without children', () => {
    expect(activeScene('/dashboard/wakaclock/settings', scenes)).toMatchObject({
      scene: { number: '03' },
      subHref: null,
    });
    expect(activeScene('/dashboard/wakaclock', scenes).scene?.item.title).toBe('Overview');
  });

  it('never numbers a page without its own entry as Overview', () => {
    expect(activeScene('/dashboard/wakaclock/agents', scenes)).toEqual({
      scene: null,
      subHref: null,
    });
    expect(activeScene('/dashboard/wakaclock/settings/keys', scenes).scene?.item.title).toBe(
      'Settings'
    );
  });

  it('finds nothing outside the dashboard', () => {
    expect(activeScene('/pricing', scenes)).toEqual({ scene: null, subHref: null });
  });
});

describe('resolvePreset', () => {
  it('maps the retired Motion Native preset to Cinema and keeps the rest', () => {
    expect(resolvePreset('motion-native')).toBe('cinema');
    expect(resolvePreset('retro-pixel')).toBe('retro-pixel');
    expect(resolvePreset(undefined)).toBe('cinema');
    expect(resolvePreset('')).toBe('cinema');
  });
});
