import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rangeFor, TeamRhythm } from '@/components/presence/TeamRhythm';
import {
  hourLabel,
  intensityLevel,
  maxCell,
  peakLabel,
  type PresenceHeatmapData,
} from '@/lib/presence/presence-heatmap';
import { WakaclockError } from '@/lib/wakaclock/client';

const api = vi.hoisted(() => ({ heatmap: vi.fn(), list: vi.fn() }));

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  getOrganizationPresenceHeatmapV2: api.heatmap,
  listOrganizations: api.list,
}));

vi.mock('@/lib/wakaclock/presence-client', () => ({ getBrowserTimezone: () => 'UTC' }));

function grid(fill: (weekday: number, hour: number) => number = () => 0): number[][] {
  return Array.from({ length: 7 }, (_, weekday) =>
    Array.from({ length: 24 }, (__, hour) => fill(weekday, hour))
  );
}

function heatmap(overrides: Partial<PresenceHeatmapData> = {}): PresenceHeatmapData {
  return {
    cells: grid((weekday, hour) =>
      weekday === 3 && hour === 15 ? 7200 : weekday === 1 && hour === 9 ? 1800 : 0
    ),
    hidden_slots: 0,
    peak: { hour: 15, seconds: 7200, weekday: 3 },
    session_count: 4,
    suppressed: false,
    timezone: 'UTC',
    total_seconds: 9000,
    truncated: false,
    ...overrides,
  };
}

const orgA = { id: 'org-a', name: 'Personal', slug: 'personal' };
const orgB = { id: 'org-b', name: 'Team Org', slug: 'team-org' };

beforeEach(() => {
  api.heatmap.mockReset();
  api.list.mockReset();
});

describe('heatmap helpers', () => {
  it('scales intensity against the busiest cell', () => {
    expect(intensityLevel(0, 100)).toBe(0);
    expect(intensityLevel(10, 0)).toBe(0);
    expect(intensityLevel(10, 100)).toBe(1);
    expect(intensityLevel(30, 100)).toBe(2);
    expect(intensityLevel(60, 100)).toBe(3);
    expect(intensityLevel(100, 100)).toBe(4);
  });

  it('labels hours and the peak window', () => {
    expect(hourLabel(9)).toBe('09:00');
    expect(peakLabel({ hour: 23, seconds: 1, weekday: 6 })).toBe('Sundays, 23:00–00:00');
    expect(peakLabel(null)).toBeNull();
    expect(maxCell(grid((weekday, hour) => weekday * hour))).toBe(6 * 23);
  });

  it('builds an inclusive date range in the viewer timezone', () => {
    expect(rangeFor(14, new Date('2026-09-29T12:00:00Z'), 'UTC')).toEqual({
      from: '2026-09-16',
      timezone: 'UTC',
      to: '2026-09-29',
    });
  });
});

describe('TeamRhythm', () => {
  it('shows the busiest time and a labelled grid, and switches range', async () => {
    api.list.mockResolvedValue([orgB]);
    api.heatmap.mockResolvedValue(heatmap());
    render(<TeamRhythm />);

    expect(await screen.findByText('Thursdays, 15:00–16:00')).toBeInTheDocument();
    expect(screen.getByText(/2h 30m across 4 sessions/)).toBeInTheDocument();
    expect(screen.getAllByRole('cell')).toHaveLength(168);
    expect(screen.getByRole('cell', { name: 'Thu 15:00: 2h 0m together' })).toHaveAttribute(
      'data-level',
      '4'
    );
    expect(screen.getByRole('cell', { name: 'Tue 09:00: 30m together' })).toHaveAttribute(
      'data-level',
      '1'
    );
    expect(screen.queryByRole('combobox', { name: 'Organization' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /12 weeks/ }));
    await waitFor(() => expect(api.heatmap).toHaveBeenCalledTimes(2));
    const [, params] = api.heatmap.mock.calls[1];
    expect(params.timezone).toBe('UTC');
    expect(screen.getByRole('button', { name: /12 weeks/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh team co-working' }));
    await waitFor(() => expect(api.heatmap).toHaveBeenCalledTimes(3));
  });

  it('skips an organization without a team on first load, then honours a manual pick', async () => {
    api.list.mockResolvedValue([orgA, orgB]);
    api.heatmap.mockImplementation(async (id: string) => {
      if (id === 'org-a')
        throw new WakaclockError('you must be an active developer member of a team', 403);
      return heatmap({ hidden_slots: 1, session_count: 1, truncated: true });
    });
    render(<TeamRhythm />);

    expect(await screen.findByText(/across 1 session$/)).toBeInTheDocument();
    expect(screen.getByText(/pick a shorter range/)).toBeInTheDocument();
    expect(screen.getByText(/1 hour slot with a single session is left blank/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Organization' })).toHaveValue('org-b');

    fireEvent.change(screen.getByRole('combobox', { name: 'Organization' }), {
      target: { value: 'org-a' },
    });
    expect(await screen.findByText(/not on a team in this organization/)).toBeInTheDocument();
  });

  it('says so when no organization has a team', async () => {
    api.list.mockResolvedValue([orgA]);
    api.heatmap.mockRejectedValue(new WakaclockError('forbidden', 403));
    render(<TeamRhythm />);

    expect(await screen.findByText(/not on a team in this organization/)).toBeInTheDocument();
  });

  it('explains the privacy floor when suppressed, and an empty range', async () => {
    api.list.mockResolvedValue([orgB]);
    api.heatmap.mockResolvedValueOnce(
      heatmap({ cells: null, peak: null, suppressed: true, total_seconds: null })
    );
    render(<TeamRhythm />);
    expect(await screen.findByText(/at least three people have shared/)).toBeInTheDocument();

    api.heatmap.mockResolvedValueOnce(heatmap({ cells: null, peak: null, total_seconds: 0 }));
    fireEvent.click(screen.getByRole('button', { name: '2 weeks' }));
    expect(
      await screen.findByText('No shared co-working sessions in this range yet.')
    ).toBeInTheDocument();

    api.heatmap.mockResolvedValueOnce(heatmap({ cells: null, peak: null, total_seconds: null }));
    fireEvent.click(screen.getByRole('button', { name: '4 weeks' }));
    await waitFor(() => expect(api.heatmap).toHaveBeenCalledTimes(3));
    expect(
      await screen.findByText('No shared co-working sessions in this range yet.')
    ).toBeInTheDocument();
  });

  it('renders an empty grid when a non-empty total comes without cells', async () => {
    api.list.mockResolvedValue([orgB]);
    api.heatmap.mockResolvedValue(
      heatmap({ cells: null, hidden_slots: 3, session_count: null, total_seconds: 60 })
    );
    render(<TeamRhythm />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryAllByRole('cell')).toHaveLength(0);
    expect(
      screen.getByText(/3 hour slots with a single session are left blank/)
    ).toBeInTheDocument();
    expect(screen.getByText(/across 0 sessions/)).toBeInTheDocument();
  });

  it('shows errors with a retry', async () => {
    api.list.mockResolvedValue([orgB]);
    api.heatmap
      .mockRejectedValueOnce(new Error('ClickHouse query error'))
      .mockResolvedValue(heatmap());
    render(<TeamRhythm />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('ClickHouse query error');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Thursdays, 15:00–16:00')).toBeInTheDocument();

    api.heatmap.mockRejectedValueOnce('nope');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh team co-working' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load team co-working');
  });

  it('handles having no organizations and failing to list them', async () => {
    api.list.mockResolvedValueOnce([]);
    const { unmount } = render(<TeamRhythm />);
    expect(await screen.findByText(/Join an organization team/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh team co-working' })).toBeNull();
    unmount();

    api.list.mockRejectedValueOnce(new Error('Postgres is required'));
    const failing = render(<TeamRhythm />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Postgres is required');
    failing.unmount();

    api.list.mockRejectedValueOnce('nope');
    render(<TeamRhythm />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your organizations');
  });

  it('shows a skeleton while loading and ignores responses after unmount', async () => {
    let resolveList!: (value: (typeof orgB)[]) => void;
    api.list.mockReturnValueOnce(new Promise((r) => (resolveList = r)));
    const first = render(<TeamRhythm />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading team co-working');
    first.unmount();
    resolveList([orgB]);

    let rejectList!: (error: Error) => void;
    api.list.mockReturnValueOnce(new Promise((_, r) => (rejectList = r)));
    const second = render(<TeamRhythm />);
    second.unmount();
    rejectList(new Error('late'));

    let resolveHeatmap!: (value: PresenceHeatmapData) => void;
    let rejectHeatmap!: (error: Error) => void;
    api.list.mockResolvedValue([orgB]);
    api.heatmap
      .mockReturnValueOnce(new Promise((r) => (resolveHeatmap = r)))
      .mockReturnValueOnce(new Promise((_, r) => (rejectHeatmap = r)));
    const third = render(<TeamRhythm />);
    await waitFor(() => expect(api.heatmap).toHaveBeenCalledTimes(1));
    third.unmount();
    resolveHeatmap(heatmap());
    const fourth = render(<TeamRhythm />);
    await waitFor(() => expect(api.heatmap).toHaveBeenCalledTimes(2));
    fourth.unmount();
    rejectHeatmap(new Error('late'));
  });
});
