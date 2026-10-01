import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DurationTimeline } from '@/app/dashboard/(auth)/wakaclock/components/duration-timeline';
import { getDurations } from '@/lib/wakaclock/endpoints';
import { formatEpochRange, formatEpochTime } from '@/lib/wakaclock/format';
import type { DurationBlock } from '@/lib/wakaclock/types';

vi.mock('@/lib/wakaclock/endpoints', () => ({ getDurations: vi.fn() }));
vi.mock('@/lib/wakaclock/user-store', () => ({ useWakaclockUserStore: () => 'test-user' }));

describe('DurationTimeline sessions', () => {
  it('renders one solid bar and table row per session with a whole-session tooltip', async () => {
    const start = new Date('2026-09-22T11:00:00+07:00').getTime() / 1000;
    const block = (offset: number, overrides: Partial<DurationBlock> = {}): DurationBlock => ({
      start: start + offset,
      end: start + offset + 600,
      duration_seconds: 600,
      project: 'wakaclock',
      entity: 'main.rs',
      language: 'Rust',
      category: 'coding',
      heartbeat_count: 2,
      ...overrides,
    });
    vi.mocked(getDurations).mockResolvedValue({
      date: '2026-09-22',
      total: 4,
      range_start: start - 11 * 3600,
      range_end: start + 13 * 3600,
      timezone: 'Asia/Bangkok',
      data: [
        block(0),
        block(600, { entity: 'app.ts', language: 'TypeScript' }),
        block(1200, { category: 'testing' }),
        block(3600),
      ],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <DurationTimeline />
      </QueryClientProvider>
    );

    const bars = await screen.findAllByRole('button', { name: /^wakaclock,/ });
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAccessibleName(
      `wakaclock, ${formatEpochRange(start, start + 1800)}, 30m`
    );
    expect(bars[0]).toHaveStyle({ width: `${(1800 / 86400) * 100}%` });
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('Rust, TypeScript')).toBeVisible();
    expect(within(rows[1]).getByText('coding, testing')).toBeVisible();
    expect(within(rows[1]).getByText('6')).toBeVisible();
    await userEvent.hover(bars[0]);
    const tooltip = await screen.findByTestId('tooltip-content');
    expect(tooltip).toHaveTextContent('RECORDED SESSION');
    expect(tooltip).toHaveTextContent('30m');
    expect(tooltip).toHaveTextContent(formatEpochTime(start));
    expect(tooltip).toHaveTextContent(formatEpochTime(start + 1800));
    expect(tooltip).toHaveTextContent('75.0%');
    expect(tooltip).toHaveTextContent('6 heartbeats');
    await userEvent.hover(bars[1]);
    expect(await screen.findByTestId('tooltip-content')).toHaveTextContent('10m');
    expect(screen.getAllByTestId('tooltip-content')).toHaveLength(1);
    await userEvent.unhover(bars[1]);
    await userEvent.click(bars[0]);
    await userEvent.tab();
    expect(await screen.findByTestId('tooltip-content')).toHaveTextContent('10m');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
  });
  it('gives every interleaved project one bar, row and working session tooltip', async () => {
    const start = new Date('2026-09-22T16:00:00+07:00').getTime() / 1000;
    const projects = ['wakaclock', 'atoaxis-parity-probe', 'another-project'];
    vi.mocked(getDurations).mockResolvedValue({
      date: '2026-09-22',
      total: 9,
      range_start: start - 16 * 3600,
      range_end: start + 8 * 3600,
      data: Array.from({ length: 9 }, (_, index) => ({
        start: start + index * 60,
        end: start + (index + 1) * 60,
        duration_seconds: 60,
        project: projects[index % 3],
        entity: `file-${index}.rs`,
        language: 'Rust',
        category: 'coding',
        heartbeat_count: 1,
      })),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <DurationTimeline />
      </QueryClientProvider>
    );
    const bars = await screen.findAllByRole('button', { name: /^(wakaclock|atoaxis-parity-probe|another-project),/ });
    expect(bars).toHaveLength(3);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4);
    const user = userEvent.setup();
    for (const [index, project] of projects.entries()) {
      expect(bars[index]).toHaveAccessibleName(
        `${project}, ${formatEpochRange(start + index * 60, start + (index + 7) * 60)}, 3m`
      );
      expect(within(rows[index + 1]).getByText(project)).toBeVisible();
      expect(within(rows[index + 1]).getByText('3m')).toBeVisible();
      await user.hover(bars[index]);
      const tooltip = await screen.findByTestId('tooltip-content');
      expect(tooltip).toHaveTextContent(project);
      expect(tooltip).toHaveTextContent('100.0%');
      expect(tooltip).toHaveTextContent('4m between activity');
      expect(screen.getAllByTestId('tooltip-content')).toHaveLength(1);
    }
  });
});
