import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCalendarWeeks,
  buildLatestWeek,
  buildMonthlyActivity,
  CalendarHeatmap,
} from '@/components/wakaclock/analytics/activity-heatmaps';
import { SourceSummary } from '@/components/wakaclock/analytics/source-summary';
import { navItems, preserveAnalyticsQuery } from '@/components/layout/sidebar/nav-main';
import { useAnalyticsFilters } from '@/hooks/use-analytics-filters';
import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams(),
  pathname: '/dashboard/wakaclock/analytics/timeline',
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.params,
}));

function FilterProbe() {
  const { filters, href, reset, setFilter, setRange } = useAnalyticsFilters(30);
  return (
    <div>
      <span data-testid="project">{filters.projectId ?? 'all'}</span>
      <span data-testid="source">{filters.source ?? 'all'}</span>
      <span data-testid="timezone">{filters.timezone}</span>
      <a href={href('/dashboard/wakaclock/analytics/heatmap')}>Heatmap link</a>
      <button onClick={() => setFilter('language', 'Rust')} type="button">
        Set Rust
      </button>
      <button onClick={() => setRange({ start: '2026-08-10', end: '2026-08-12' })} type="button">
        Set range
      </button>
      <button onClick={reset} type="button">
        Reset
      </button>
    </div>
  );
}

function response(): AnalyticsExplorerResponse {
  return {
    applied_filters: {
      category: null,
      editor: null,
      language: null,
      operating_system: null,
      project_id: null,
      source: null,
    },
    breakdowns: {
      categories: [],
      editors: [],
      languages: [],
      operating_systems: [],
      projects: [],
    },
    calendar_heatmap: [
      {
        ai_seconds: 300,
        date: '2026-08-28',
        human_seconds: 600,
        other_seconds: 0,
        total_seconds: 900,
      },
    ],
    filter_options: {
      categories: [],
      editors: [],
      languages: [],
      operating_systems: [],
      projects: [],
    },
    generated_at: '2026-08-28T12:00:00Z',
    range: { days_included: 1, end: '2026-08-28', start: '2026-08-28', timezone: 'Asia/Bangkok' },
    schema_version: 1,
    summary: {
      active_days: 1,
      ai_seconds: 300,
      ai_share_percent: 33.333,
      human_seconds: 600,
      other_seconds: 0,
      total_seconds: 900,
    },
    time_heatmap: [],
    timeline: { bucket_seconds: 1800, items: [] },
  };
}

function multiMonthResponse(): AnalyticsExplorerResponse {
  const base = response();
  return {
    ...base,
    calendar_heatmap: [
      { ...base.calendar_heatmap[0], date: '2026-07-31', total_seconds: 1_800 },
      { ...base.calendar_heatmap[0], date: '2026-08-24', total_seconds: 3_600 },
      { ...base.calendar_heatmap[0], date: '2026-08-28', total_seconds: 7_200 },
    ],
    range: { ...base.range, days_included: 32, start: '2026-07-28' },
  };
}

describe('Analytics Explorer frontend foundation', () => {
  beforeEach(() => {
    navigation.params = new URLSearchParams(
      'start=2026-08-01&end=2026-08-28&project_id=project-1&source=ai&timezone=UTC'
    );
    navigation.replace.mockReset();
  });

  it('keeps global filters in shareable links across analytics sections', () => {
    render(<FilterProbe />);

    expect(screen.getByTestId('project')).toHaveTextContent('project-1');
    expect(screen.getByTestId('source')).toHaveTextContent('ai');
    expect(screen.getByTestId('timezone')).toHaveTextContent('UTC');
    const href = screen.getByRole('link', { name: 'Heatmap link' }).getAttribute('href') ?? '';
    expect(href).toContain('start=2026-08-01');
    expect(href).toContain('end=2026-08-28');
    expect(href).toContain('project_id=project-1');
    expect(href).toContain('source=ai');
    expect(href).toContain('timezone=UTC');
  });

  it('updates one filter without dropping the current range or other filters', async () => {
    render(<FilterProbe />);
    await userEvent.click(screen.getByRole('button', { name: 'Set Rust' }));

    expect(navigation.replace).toHaveBeenCalledTimes(1);
    const target = String(navigation.replace.mock.calls[0]?.[0]);
    expect(target).toContain('start=2026-08-01');
    expect(target).toContain('end=2026-08-28');
    expect(target).toContain('project_id=project-1');
    expect(target).toContain('source=ai');
    expect(target).toContain('language=Rust');
  });

  it('changes the shared range through URL state', async () => {
    render(<FilterProbe />);
    await userEvent.click(screen.getByRole('button', { name: 'Set range' }));

    const target = String(navigation.replace.mock.calls[0]?.[0]);
    expect(target).toContain('start=2026-08-10');
    expect(target).toContain('end=2026-08-12');
    expect(target).toContain('project_id=project-1');
  });

  it('preserves global Analytics filters when navigating from the sidebar', () => {
    const href = preserveAnalyticsQuery(
      '/dashboard/wakaclock/analytics/timeline',
      'start=2026-08-01&end=2026-08-28&source=ai',
      '/dashboard/wakaclock/analytics/heatmap'
    );
    expect(href).toContain('start=2026-08-01');
    expect(href).toContain('end=2026-08-28');
    expect(href).toContain('source=ai');
  });

  it('keeps project drill-down context when sidebar navigation starts without project_id', () => {
    const href = preserveAnalyticsQuery(
      '/dashboard/wakaclock/analytics/projects/project-123',
      'start=2026-08-01&end=2026-08-28',
      '/dashboard/wakaclock/analytics/human-ai'
    );
    expect(href).toContain('project_id=project-123');
  });

  it('exposes the four Analytics submenu destinations in the sidebar', () => {
    const group = navItems.find((item) => item.title === 'Wakaclock');
    const analytics = group?.items.find((item) => item.title === 'Analytics');
    expect(analytics?.items?.map((item) => item.title)).toEqual([
      'Activity Timeline',
      'Human vs AI',
      'Projects',
      'Activity Heatmap',
    ]);
  });

  it('drills a calendar heatmap cell down to the selected date', async () => {
    const onSelectDate = vi.fn();
    render(<CalendarHeatmap data={response()} onSelectDate={onSelectDate} />);

    await userEvent.click(screen.getByRole('button', { name: /2026-08-28/ }));
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-28');
  });

  it('updates the inspected pixel when filtered data changes', async () => {
    const initial = response();
    const { container, rerender } = render(
      <CalendarHeatmap data={initial} onSelectDate={vi.fn()} />
    );
    await userEvent.hover(screen.getByRole('button', { name: /2026-08-28/ }));
    expect(container.querySelector('[aria-live]')).toHaveTextContent('2026-08-28');
    const updated = {
      ...initial,
      calendar_heatmap: initial.calendar_heatmap.map((day) => ({ ...day, total_seconds: 0 })),
    };
    rerender(<CalendarHeatmap data={updated} onSelectDate={vi.fn()} />);
    expect(container.querySelector('[aria-live] strong')).toHaveTextContent('0');
  });

  it('builds a Monday-through-Sunday calendar grid from the filtered range', () => {
    const weeks = buildCalendarWeeks(multiMonthResponse());
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.cells).toHaveLength(7);
    expect(weeks[0]?.cells[0]?.date).toBe('2026-07-27');
    expect(weeks.at(-1)?.cells[6]?.date).toBe('2026-08-30');
  });

  it('uses the latest calendar week for Weekly Activity', () => {
    const points = buildLatestWeek(multiMonthResponse());
    expect(points.map((point) => point.date)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ]);
    expect(points[0]?.totalSeconds).toBe(3_600);
    expect(points[4]?.totalSeconds).toBe(7_200);
  });

  it('aggregates Monthly Progress from real calendar durations', () => {
    expect(buildMonthlyActivity(multiMonthResponse())).toEqual([
      { key: '2026-07', label: 'Jul', totalSeconds: 1_800 },
      { key: '2026-08', label: 'Aug', totalSeconds: 10_800 },
    ]);
  });

  it('turns source summary cards into cross-filter actions', async () => {
    const onSelect = vi.fn();
    render(<SourceSummary data={response()} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /AI agent/ }));
    expect(onSelect).toHaveBeenCalledWith('ai');
    expect(screen.getByRole('button', { name: /Unknown: Unavailable/ })).toBeInTheDocument();
  });
});
