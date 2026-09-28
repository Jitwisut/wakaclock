import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CharacterSheetHero } from '@/app/dashboard/(auth)/wakaclock/components/character-sheet-hero';
import {
  leadingItem,
  OverviewInsights,
} from '@/app/dashboard/(auth)/wakaclock/components/overview-insights';
import {
  AnimatedDuration,
  OverviewMotion,
  Reveal,
} from '@/app/dashboard/(auth)/wakaclock/components/overview-motion';
import { OverviewToolbar } from '@/app/dashboard/(auth)/wakaclock/components/overview-toolbar';
import { StatusTiles } from '@/app/dashboard/(auth)/wakaclock/components/status-tiles';
import { DashboardPanelsProvider } from '@/components/dashboard-panels';

import type { BreakdownItem, DashboardAnalyticsResponse } from '@/lib/wakaclock/types';

/**
 * Covers the overview's new surfaces in isolation (see wakaclock-top-projects.test.tsx for
 * why the page itself is not mounted under coverage).
 */

const api = vi.hoisted(() => ({
  getAllTime: vi.fn(),
  getDashboardAnalytics: vi.fn(),
  getProjectAnalytics: vi.fn(),
  getStatusBar: vi.fn(),
}));

vi.mock('@/lib/wakaclock/endpoints', () => ({
  getAllTime: api.getAllTime,
  getBrowserTimezone: () => 'UTC',
  getDashboardAnalytics: api.getDashboardAnalytics,
  getProjectAnalytics: api.getProjectAnalytics,
  getStatusBar: api.getStatusBar,
}));

const store = vi.hoisted(() => ({
  userId: 'user-1' as null | string,
  username: 'dev' as null | string,
}));

vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (state: typeof store) => unknown) => selector(store),
}));

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/use-reduced-motion', () => ({ useReducedMotion: () => reduced.value }));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/wakaclock',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('start=2026-09-01&end=2026-09-28'),
}));

function lang(name: string, value: number, percentage: number): BreakdownItem {
  return {
    metric: 'time',
    name,
    percentage,
    text: `${value}s`,
    unit: 'seconds',
    value,
  } as unknown as BreakdownItem;
}

function analytics(
  overrides: Partial<DashboardAnalyticsResponse['summary']> = {},
  languages: BreakdownItem[] = []
) {
  return {
    breakdowns: { languages: { items: languages } },
    range: { days_included: 28, end: '2026-09-28', start: '2026-09-01', timezone: 'UTC' },
    summary: {
      active_day_average_seconds: 7200,
      calendar_day_average_seconds: 3600,
      previous_period: {
        current_seconds: 36000,
        direction: 'increase',
        percent: 25,
        previous_seconds: 28800,
      },
      ...overrides,
    },
  } as unknown as DashboardAnalyticsResponse;
}

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OverviewMotion>{ui}</OverviewMotion>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  store.userId = 'user-1';
  store.username = 'dev';
  reduced.value = false;
  Object.values(api).forEach((fn) => fn.mockReset());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('leadingItem', () => {
  it('picks the largest value regardless of API order', () => {
    expect(leadingItem([lang('Rust', 10, 10), lang('Go', 30, 30), lang('TS', 20, 20)])?.name).toBe(
      'Go'
    );
    expect(leadingItem([])).toBeUndefined();
  });
});

describe('OverviewInsights', () => {
  it('renders the headline and all four insight cards with a linked top project', async () => {
    api.getDashboardAnalytics.mockResolvedValue(
      analytics({}, [lang('Rust', 100, 62.5), lang('Go', 50, 31.25)])
    );
    api.getProjectAnalytics.mockResolvedValue({
      items: [{ name: 'wakaclock', project_id: 'p-1', total_seconds: 5400 }],
      next_cursor: null,
    });

    wrap(<OverviewInsights />);

    expect(await screen.findByText('Change vs previous 28 days')).toBeInTheDocument();
    expect(screen.getAllByText('+25.0%')).toHaveLength(2);
    expect(screen.getByText(/logged across the last 28 days/)).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.getByText('100s · 62.5% of this range')).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'wakaclock' });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/analytics/projects/p-1?start=2026-09-01')
    );
    expect(screen.getByText('1h 30m in this range')).toBeInTheDocument();
  });

  it.each([
    ['decrease', -10, '-10.0%'],
    ['unchanged', 0, 'No change'],
    ['new_activity', null, 'New activity'],
  ] as const)('shows the %s trend', async (direction, percent, text) => {
    api.getDashboardAnalytics.mockResolvedValue(
      analytics({
        previous_period: { current_seconds: 60, direction, percent, previous_seconds: 0 },
      })
    );
    api.getProjectAnalytics.mockResolvedValue({ items: [], next_cursor: null });

    wrap(<OverviewInsights />);

    expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
    expect(screen.getByText('No languages recorded in this range')).toBeInTheDocument();
    expect(await screen.findByText('No named projects in this range')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('says "day" for a one-day range', async () => {
    const data = analytics();
    data.range.days_included = 1;
    api.getDashboardAnalytics.mockResolvedValue(data);
    api.getProjectAnalytics.mockResolvedValue({ items: [], next_cursor: null });

    wrap(<OverviewInsights />);

    expect(await screen.findByText(/logged across the last 1 day\b/)).toBeInTheDocument();
  });

  it('shows the empty state when the range has no activity', async () => {
    api.getDashboardAnalytics.mockResolvedValue(analytics({ calendar_day_average_seconds: 0 }));
    api.getProjectAnalytics.mockResolvedValue({ items: [], next_cursor: null });

    wrap(<OverviewInsights />);

    expect(await screen.findByText('Nothing to highlight yet')).toBeInTheDocument();
  });

  it('does not fetch before a user is known, and falls back to UTC', () => {
    store.userId = null;
    const spy = vi
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ timeZone: '' } as Intl.ResolvedDateTimeFormatOptions);

    wrap(<OverviewInsights />);
    spy.mockRestore();

    expect(api.getDashboardAnalytics).not.toHaveBeenCalled();
    expect(api.getProjectAnalytics).not.toHaveBeenCalled();
  });
});

describe('OverviewToolbar', () => {
  it('drives the shared range params and links to Customize', () => {
    wrap(<OverviewToolbar />);

    expect(screen.getByRole('region', { name: 'Overview range' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Customize/ })).toHaveAttribute(
      'href',
      '/dashboard/wakaclock/settings'
    );
    fireEvent.click(screen.getByRole('radio', { name: '7d' }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('start='), { scroll: false });
  });
});

describe('overview motion', () => {
  it('reveals children and announces only the settled duration', () => {
    wrap(
      <Reveal delay={0.1}>
        <AnimatedDuration seconds={3900} />
      </Reveal>
    );

    expect(screen.getByText('1h 5m', { selector: '.sr-only' })).toBeInTheDocument();
  });

  it('jumps straight to the value under reduced motion', () => {
    reduced.value = true;

    wrap(
      <Reveal>
        <AnimatedDuration seconds={120} />
      </Reveal>
    );

    expect(screen.getAllByText('2m')).toHaveLength(2);
  });
});

describe('CharacterSheetHero', () => {
  function statusBar(overrides: Record<string, unknown> = {}) {
    return {
      active_coverage: 'measured',
      active_seconds: 1800,
      heartbeat_count: 42,
      total_seconds: 2000,
      ...overrides,
    };
  }

  it('shows measured time, heartbeats, quest progress and level', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 9, 0));
    api.getStatusBar.mockResolvedValue(statusBar());
    api.getAllTime.mockResolvedValue({
      data: {
        active_coverage: 'measured',
        active_seconds: 36000,
        days_with_activity: 3,
        since: null,
        total_seconds: 1,
      },
    });

    wrap(<CharacterSheetHero />);

    expect(await screen.findByText('30m', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Good morning, dev/ })).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: "Today's quest progress" })).toHaveAttribute(
      'aria-valuenow',
      '25'
    );
    expect(screen.getByText('30m of 2h')).toBeInTheDocument();
    expect(await screen.findByText('Level 4')).toBeInTheDocument();
  });

  it('falls back to the WakaTime-compatible text and marks a complete quest', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 14, 0));
    store.username = null;
    api.getStatusBar.mockResolvedValue(
      statusBar({ active_coverage: 'partial', human_readable: '3 hrs', total_seconds: 10800 })
    );
    api.getAllTime.mockResolvedValue({
      data: { days_with_activity: 1, since: null, total_seconds: 3600 },
    });

    wrap(<CharacterSheetHero />);

    expect(await screen.findByText('3 hrs')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /^Good afternoon — you've coded today$/ })
    ).toBeInTheDocument();
    expect(screen.getByText('WakaTime-compatible')).toBeInTheDocument();
    expect(screen.getByText('Quest complete!')).toBeInTheDocument();
  });

  it('shows 0m when the status bar has no text, and greets in the evening', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 21, 0));
    api.getStatusBar.mockResolvedValue({});
    api.getAllTime.mockResolvedValue({ data: { days_with_activity: 0, since: null } });

    wrap(<CharacterSheetHero />);

    expect(await screen.findByText('0m', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Good evening/ })).toBeInTheDocument();
    expect(screen.getByText('0s of 2h')).toBeInTheDocument();
  });

  it('treats measured coverage without seconds as zero and waits for a user', async () => {
    api.getStatusBar.mockResolvedValue({ active_coverage: 'measured' });
    api.getAllTime.mockResolvedValue({
      data: { active_coverage: 'measured', days_with_activity: 0, since: null },
    });

    wrap(<CharacterSheetHero />);

    expect(await screen.findByText('0s', { selector: '.sr-only' })).toBeInTheDocument();
    expect(await screen.findByText('Level 1')).toBeInTheDocument();
  });

  it('does not fetch before a user is known', () => {
    store.userId = null;

    wrap(<CharacterSheetHero />);

    expect(api.getStatusBar).not.toHaveBeenCalled();
  });

  it('shows placeholders while loading', () => {
    api.getStatusBar.mockReturnValue(new Promise(() => {}));
    api.getAllTime.mockReturnValue(new Promise(() => {}));

    wrap(<CharacterSheetHero />);

    expect(screen.getByText('Code for 2h')).toBeInTheDocument();
    expect(screen.getByText('··')).toBeInTheDocument();
  });

  it('follows a mouse pointer with light and tilt, ignores touch, and resets on leave', async () => {
    api.getStatusBar.mockResolvedValue(statusBar());
    api.getAllTime.mockResolvedValue({
      data: { days_with_activity: 0, since: null, total_seconds: 0 },
    });

    wrap(<CharacterSheetHero />);

    const hero = await screen.findByRole('region', { name: /coded today/ });
    const orb = within(hero)
      .getByRole('progressbar', { name: "Today's quest progress" })
      .closest('div')!.parentElement as HTMLElement;
    const stage = orb.parentElement as HTMLElement;

    act(() => {
      fireEvent.pointerMove(hero, { clientX: 40, clientY: 20, pointerType: 'mouse' });
    });
    expect(hero.style.getPropertyValue('--mx')).toBe('40px');

    act(() => {
      fireEvent.pointerMove(stage, { clientX: 10, clientY: 10, pointerType: 'mouse' });
    });
    expect(orb.style.getPropertyValue('--ry')).not.toBe('');

    act(() => {
      fireEvent.pointerMove(stage, { clientX: 90, clientY: 90, pointerType: 'touch' });
    });
    expect(hero.style.getPropertyValue('--mx')).toBe('10px');

    act(() => {
      fireEvent.pointerLeave(stage);
    });
    expect(orb.style.getPropertyValue('--rx')).toBe('0deg');
  });

  it('keeps still under reduced motion', async () => {
    reduced.value = true;
    api.getStatusBar.mockResolvedValue(statusBar());
    api.getAllTime.mockResolvedValue({
      data: { days_with_activity: 0, since: null, total_seconds: 0 },
    });

    wrap(<CharacterSheetHero />);

    const hero = await screen.findByRole('region', { name: /coded today/ });
    const orb = within(hero)
      .getByRole('progressbar', { name: "Today's quest progress" })
      .closest('div')!.parentElement as HTMLElement;
    act(() => {
      fireEvent.pointerMove(hero, { clientX: 40, clientY: 20, pointerType: 'mouse' });
      fireEvent.pointerMove(orb.parentElement as HTMLElement, {
        clientX: 10,
        clientY: 10,
        pointerType: 'mouse',
      });
    });
    expect(hero.style.getPropertyValue('--mx')).toBe('');
    expect(orb.style.getPropertyValue('--ry')).toBe('');
  });
});

describe('StatusTiles', () => {
  function renderTiles(hidden: string[] = []) {
    return wrap(
      <DashboardPanelsProvider initialHidden={hidden}>
        <StatusTiles />
      </DashboardPanelsProvider>
    );
  }

  it('shows lifetime totals only while the hero is visible', async () => {
    api.getAllTime.mockResolvedValue({
      data: {
        active_coverage: 'measured',
        active_seconds: 7200,
        days_with_activity: 5,
        since: '2026-09-01T00:00:00Z',
      },
    });

    renderTiles();

    expect(await screen.findByText('All-time active coding')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(
      screen.getByText(new Date('2026-09-01T00:00:00Z').toLocaleDateString())
    ).toBeInTheDocument();
    expect(screen.queryByText('Today')).toBeNull();
    expect(api.getStatusBar).not.toHaveBeenCalled();
  });

  it('falls back to the WakaTime-compatible all-time text', async () => {
    api.getAllTime.mockResolvedValue({
      data: { active_coverage: 'measured', text: 'x', since: null },
    });

    renderTiles();

    expect(await screen.findByText('0s')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('uses the all-time text or 0m when active time is not measured', async () => {
    api.getAllTime.mockResolvedValueOnce({
      data: { days_with_activity: 1, since: null, text: '9 hrs' },
    });

    renderTiles();

    expect(await screen.findByText('9 hrs')).toBeInTheDocument();
    expect(screen.getByText('since first heartbeat')).toBeInTheDocument();
  });

  it('shows 0m and 0 days when all-time data is missing', async () => {
    api.getAllTime.mockResolvedValue({ data: {} });

    renderTiles();

    expect(await screen.findByText('0m')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('brings Today and the quest back when the hero is hidden', async () => {
    api.getAllTime.mockResolvedValue({ data: { days_with_activity: 0, since: null } });
    api.getStatusBar.mockResolvedValue({
      active_coverage: 'measured',
      active_seconds: 3600,
      heartbeat_count: 7,
    });

    renderTiles(['overview.character-sheet']);

    expect(await screen.findByText('1h')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('7 heartbeats · Active')).toBeInTheDocument();
    expect(screen.getByText('1h of 2h')).toBeInTheDocument();
  });

  it('uses the status-bar text when active time is not measured', async () => {
    api.getAllTime.mockResolvedValue({ data: { days_with_activity: 0, since: null } });
    api.getStatusBar.mockResolvedValueOnce({ human_readable: '45 mins', total_seconds: 2700 });

    renderTiles(['overview.character-sheet']);

    expect(await screen.findByText('45 mins')).toBeInTheDocument();
    expect(screen.getByText('0 heartbeats · WakaTime-compatible')).toBeInTheDocument();
  });

  it('shows 0m for an empty status bar and zero for measured time without seconds', async () => {
    api.getAllTime.mockResolvedValue({ data: { days_with_activity: 0, since: null } });
    api.getStatusBar.mockResolvedValue({});

    const { unmount } = renderTiles(['overview.character-sheet']);
    expect(await screen.findByText('0 heartbeats · WakaTime-compatible')).toBeInTheDocument();
    expect(screen.getAllByText('0m').length).toBeGreaterThan(0);
    unmount();

    api.getStatusBar.mockResolvedValue({ active_coverage: 'measured' });
    renderTiles(['overview.character-sheet']);
    expect(await screen.findByText('0 heartbeats · Active')).toBeInTheDocument();
  });

  it('waits for a user before fetching', () => {
    store.userId = null;

    renderTiles(['overview.character-sheet']);

    expect(api.getAllTime).not.toHaveBeenCalled();
    expect(api.getStatusBar).not.toHaveBeenCalled();
  });
});
