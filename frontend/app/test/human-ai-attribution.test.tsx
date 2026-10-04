import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTORS,
  actorShares,
  dimensionMix,
  percentOf,
} from '@/app/dashboard/(auth)/wakaclock/analytics/human-ai/components/attribution';
import { AttributionMixList } from '@/app/dashboard/(auth)/wakaclock/analytics/human-ai/components/attribution-mix-list';
import { AttributionOverview } from '@/app/dashboard/(auth)/wakaclock/analytics/human-ai/components/attribution-overview';
import {
  AttributionTimeline,
  formatMeasure,
  formatShare,
  formatTime,
  granularityLabel,
  timelineRows,
} from '@/app/dashboard/(auth)/wakaclock/analytics/human-ai/components/attribution-timeline';
import HumanAiPage from '@/app/dashboard/(auth)/wakaclock/analytics/human-ai/page';
import type { AnalyticsFrameContext } from '@/components/wakaclock/analytics/analytics-frame';
import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { getAnalyticsExplorer } from '@/lib/wakaclock/endpoints';

const frame = vi.hoisted(() => ({ context: undefined as unknown }));

vi.mock('@/components/wakaclock/analytics/analytics-frame', () => ({
  AnalyticsFrame: ({ children }: { children: (context: unknown) => React.ReactNode }) =>
    children(frame.context),
}));

vi.mock('@/lib/wakaclock/endpoints', () => ({
  getAnalyticsExplorer: vi.fn(),
}));

function response(overrides: Partial<AnalyticsExplorerResponse> = {}): AnalyticsExplorerResponse {
  const split = {
    ai_inferred_seconds: 0,
    ai_seconds: 3_600,
    ai_verified_seconds: 3_600,
    human_seconds: 1_800,
    other_seconds: 1_800,
    total_seconds: 7_200,
    unknown_seconds: 1_800,
  };
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
      categories: [{ key: 'coding', name: 'coding', total_seconds: 7_200 }],
      editors: [],
      languages: [],
      operating_systems: [],
      projects: [
        { key: 'p-atlas', name: 'atlas', total_seconds: 5_400 },
        { key: 'p-beacon', name: 'beacon', total_seconds: 1_800 },
      ],
    },
    calendar_heatmap: [],
    filter_options: {
      categories: [],
      editors: [],
      languages: [],
      operating_systems: [],
      projects: [],
    },
    generated_at: '2026-09-30T00:00:00Z',
    range: { days_included: 30, end: '2026-09-30', start: '2026-09-01', timezone: 'UTC' },
    schema_version: 1,
    summary: { active_days: 2, ai_share_percent: 50, ...split },
    time_heatmap: [],
    timeline: {
      bucket_seconds: 86_400,
      items: [
        { bucket: '2026-09-01', label: '2026-09-01', ...split },
        {
          ai_seconds: 0,
          bucket: '2026-09-02',
          human_seconds: 0,
          label: '2026-09-02',
          other_seconds: 0,
          total_seconds: 0,
        },
      ],
    },
    ...overrides,
  };
}

/** A response holding only one actor's time, as the explorer returns for actor_type. */
function actorResponse(actor: string): AnalyticsExplorerResponse {
  const seconds: Record<string, [number, number]> = {
    ai_inferred: [0, 0],
    ai_verified: [3_600, 0],
    human: [900, 900],
    unknown: [900, 900],
  };
  const [atlas, beacon] = seconds[actor] ?? [0, 0];
  const base = response();
  return {
    ...base,
    breakdowns: {
      ...base.breakdowns,
      categories: [{ key: 'coding', name: 'coding', total_seconds: atlas + beacon }],
      projects: [
        { key: 'p-atlas', name: 'atlas', total_seconds: atlas },
        ...(beacon > 0 ? [{ key: 'p-beacon', name: 'beacon', total_seconds: beacon }] : []),
      ],
    },
  };
}

function context(overrides: Partial<AnalyticsFrameContext> = {}): AnalyticsFrameContext {
  return {
    data: response(),
    filters: { end: '2026-09-30', start: '2026-09-01', timezone: 'UTC' },
    href: (path: string) => `${path}?start=2026-09-01`,
    request: { end: '2026-09-30', start: '2026-09-01', timezone: 'UTC' },
    setFilter: vi.fn(),
    setRange: vi.fn(),
    userId: 'user-1',
    ...overrides,
  } as unknown as AnalyticsFrameContext;
}

function renderPage(value: AnalyticsFrameContext) {
  frame.context = value;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HumanAiPage />
    </QueryClientProvider>
  );
}

describe('attribution helpers', () => {
  it('shares each actor of the total and treats a missing field as zero', () => {
    const shares = actorShares({
      ai_seconds: 0,
      human_seconds: 300,
      other_seconds: 0,
      total_seconds: 600,
      unknown_seconds: 300,
    });
    expect(shares.map((share) => [share.actor.key, share.seconds, share.percent])).toEqual([
      ['human', 300, 50],
      ['ai_verified', 0, 0],
      ['ai_inferred', 0, 0],
      ['unknown', 300, 50],
    ]);
    expect(
      actorShares({ ai_seconds: 0, human_seconds: 0, other_seconds: 0, total_seconds: 0 })[0]
        ?.percent
    ).toBe(0);
    expect(percentOf(1, 0)).toBe(0);
    expect(percentOf(1, 4)).toBe(25);
  });

  it('builds a per-item mix only once every actor has answered', () => {
    const items = response().breakdowns.projects;
    const pick = (value: AnalyticsExplorerResponse) => value.breakdowns.projects;
    expect(dimensionMix(items, { human: actorResponse('human') }, pick)).toBeNull();

    const byActor = Object.fromEntries(ACTORS.map((actor) => [actor.key, actorResponse(actor.key)]));
    const mix = dimensionMix(items, byActor, pick);
    expect(mix?.[0]).toEqual({
      key: 'p-atlas',
      name: 'atlas',
      seconds: { ai_inferred: 0, ai_verified: 3_600, human: 900, unknown: 900 },
      total: 5_400,
    });
    // An actor with no time in a project contributes zero rather than a gap.
    expect(mix?.[1]?.seconds.ai_verified).toBe(0);
  });
});

describe('AttributionOverview', () => {
  it('states the split, filters from the legend and links to Measurement Trust', async () => {
    const onSelect = vi.fn();
    render(
      <AttributionOverview data={response()} onSelect={onSelect} trustHref="/trust?x=1" />
    );
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getAllByText('25.0%')).toHaveLength(2);
    expect(screen.getByText('No activity in this range')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See how it is measured' })).toHaveAttribute(
      'href',
      '/trust?x=1'
    );
    expect(screen.queryByText(/only · Clear/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /AI verified/ }));
    expect(onSelect).toHaveBeenCalledWith('ai_verified');
  });

  it('clears an active actor from its legend entry or the filter chip', async () => {
    const onSelect = vi.fn();
    render(
      <AttributionOverview
        data={response()}
        onSelect={onSelect}
        selected="human"
        trustHref="/trust"
      />
    );
    const human = screen.getByRole('button', { name: /^Human/ });
    expect(human).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(human);
    expect(onSelect).toHaveBeenLastCalledWith(undefined);

    await userEvent.click(screen.getByRole('button', { name: 'Showing Human only · Clear' }));
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});

describe('AttributionTimeline', () => {
  it('formats both measures and names the bucket size', () => {
    expect(formatMeasure('share', 42.4)).toBe('42%');
    expect(formatShare(99.6)).toBe('100%');
    expect(formatTime(3_600)).toBe(formatMeasure('time', 3_600));
    expect(granularityLabel(86_400)).toBe('Daily');
    expect(granularityLabel(3_600)).toBe('Hourly');
    expect(granularityLabel(1_800)).toBe('30-minute');
  });

  it('turns buckets into seconds or shares, with empty buckets at zero', () => {
    const data = response();
    expect(timelineRows(data, 'time')[0]).toMatchObject({
      ai_verified_seconds: 3_600,
      human_seconds: 1_800,
      label: '2026-09-01',
    });
    expect(timelineRows(data, 'share')[0]).toMatchObject({
      ai_verified_seconds: 50,
      unknown_seconds: 25,
    });
    expect(timelineRows(data, 'share')[1]).toMatchObject({ ai_inferred_seconds: 0, human_seconds: 0 });
  });

  it('switches between time and share', async () => {
    render(<AttributionTimeline data={response()} />);
    expect(screen.getByText(/Bar height is the canonical time/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('button', { name: 'Share' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Each bar is 100% of that bucket/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(screen.getByRole('button', { name: 'Time' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('AttributionMixList', () => {
  const items = response().breakdowns.projects;

  it('draws each item mix and reports its AI share', async () => {
    const onSelect = vi.fn();
    const byActor = Object.fromEntries(ACTORS.map((actor) => [actor.key, actorResponse(actor.key)]));
    render(
      <AttributionMixList
        description="d"
        items={items}
        loading={false}
        mix={dimensionMix(items, byActor, (value) => value.breakdowns.projects)}
        onSelect={onSelect}
        title="By project"
      />
    );
    expect(screen.getByText(/67% AI/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /atlas/ }));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('shows a skeleton while loading, plain totals without a mix, and an empty state', () => {
    const { container, rerender } = render(
      <AttributionMixList
        description="d"
        items={items}
        loading
        mix={null}
        onSelect={vi.fn()}
        title="By project"
      />
    );
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.queryByText(/% AI/)).not.toBeInTheDocument();

    rerender(
      <AttributionMixList description="d" items={items} loading={false} onSelect={vi.fn()} title="t" />
    );
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();

    rerender(
      <AttributionMixList description="d" items={[]} loading={false} onSelect={vi.fn()} title="t" />
    );
    expect(screen.getByText('No activity matches these filters.')).toBeInTheDocument();
  });
});

describe('Human vs AI page', () => {
  beforeEach(() => {
    vi.mocked(getAnalyticsExplorer).mockImplementation(async (request) =>
      actorResponse(request.actor_type ?? '')
    );
  });

  it('loads one response per actor and renders every section', async () => {
    const setFilter = vi.fn();
    renderPage(context({ setFilter }));

    expect(screen.getByText('Where your time went')).toBeInTheDocument();
    expect(screen.getByText('Attribution over time')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/67% AI/).length).toBeGreaterThan(0));
    expect(getAnalyticsExplorer).toHaveBeenCalledTimes(ACTORS.length);
    expect(vi.mocked(getAnalyticsExplorer).mock.calls.map(([request]) => request.actor_type)).toEqual(
      ACTORS.map((actor) => actor.key)
    );

    await userEvent.click(screen.getByRole('button', { name: /AI verified/ }));
    expect(setFilter).toHaveBeenCalledWith('actor_type', 'ai_verified');
    await userEvent.click(screen.getByRole('button', { name: /beacon/ }));
    expect(setFilter).toHaveBeenCalledWith('project_id', 'p-beacon');
    await userEvent.click(screen.getAllByRole('button', { name: /coding/ })[0] as HTMLElement);
    expect(setFilter).toHaveBeenCalledWith('category', 'coding');
  });

  it('skips the per-actor requests when an actor filter is already applied', () => {
    renderPage(
      context({
        filters: {
          actorType: 'human',
          end: '2026-09-30',
          start: '2026-09-01',
          timezone: 'UTC',
        } as AnalyticsFrameContext['filters'],
      })
    );
    expect(getAnalyticsExplorer).not.toHaveBeenCalled();
    expect(screen.getAllByText(/for the selected attribution/)).toHaveLength(2);
  });

  it('shows the empty state when nothing matches and handles a missing AI share', () => {
    const empty = response();
    renderPage(
      context({
        data: {
          ...empty,
          summary: { ...empty.summary, active_days: 0, ai_share_percent: null, total_seconds: 0 },
        },
      })
    );
    expect(screen.getByText('No attributed activity matches the current filters.')).toBeInTheDocument();
  });

  it('renders a dash for an unavailable AI share and zero average without active days', () => {
    const base = response();
    renderPage(
      context({
        data: { ...base, summary: { ...base.summary, active_days: 0, ai_share_percent: null } },
        filters: {
          actorType: 'human',
          end: '2026-09-30',
          start: '2026-09-01',
          timezone: 'UTC',
        } as AnalyticsFrameContext['filters'],
      })
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getAllByText('0s').length).toBeGreaterThan(0);
  });
});
