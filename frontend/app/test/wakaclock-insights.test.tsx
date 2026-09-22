import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insightsFixture,
  insightsStatsFixture,
} from '@/.storybook/stories/wakaclock/insights.fixtures';
import { DashboardPanelsProvider } from '@/components/dashboard-panels';
import {
  InsightsReport,
  InsightsWorkspace,
} from '@/components/wakaclock/insights/insights-workspace';
import { getInsights, getStats } from '@/lib/wakaclock/endpoints';

vi.mock('@/lib/wakaclock/endpoints', () => ({
  getInsights: vi.fn(),
  getStats: vi.fn(),
  getBrowserTimezone: () => 'Asia/Bangkok',
}));
vi.mock('@/lib/wakaclock/user-store', () => ({ useWakaclockUserStore: () => 'test-user' }));
function report(data = insightsFixture) {
  return render(
    <DashboardPanelsProvider>
      <InsightsReport data={data} stats={insightsStatsFixture} />
    </DashboardPanelsProvider>
  );
}
function workspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardPanelsProvider>
        <InsightsWorkspace />
      </DashboardPanelsProvider>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.mocked(getInsights)
    .mockReset()
    .mockImplementation(async (_user, type, range) => ({ ...insightsFixture, type, range }));
  vi.mocked(getStats).mockReset().mockResolvedValue(insightsStatsFixture);
});
describe('Insights', () => {
  it('selects any entry and calculates its share and average from real data', async () => {
    report();
    const user = userEvent.setup();
    const table = screen.getByRole('table');
    await user.click(within(table).getByRole('button', { name: /Shell/ }));
    const detail = screen.getByRole('complementary', { name: 'Selected insight' });
    expect(detail).toHaveTextContent('Shell');
    expect(detail).toHaveTextContent('1.9%');
    expect(detail).toHaveTextContent('20m');
    expect(detail).toHaveTextContent('82');
    expect(screen.getByRole('img')).toHaveAccessibleName(/Other 1.9%/);
  });
  it('searches and sorts without changing the whole-period share', async () => {
    report();
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Search entries' }), 'rust');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(within(screen.getByRole('table')).getByText('44.4%')).toBeVisible();
    await user.clear(screen.getByRole('textbox', { name: 'Search entries' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort entries' }), 'days');
    expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent(
      'TypeScript'
    );
    await user.type(screen.getByRole('textbox', { name: 'Search entries' }), 'missing');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(7);
  });
  it('loads more entries and keeps long branch names selectable', async () => {
    report({
      ...insightsFixture,
      type: 'branches',
      data: Array.from({ length: 15 }, (_, i) => ({
        ...insightsFixture.data[0],
        name: `feature/branch-${i}`,
        total_seconds: 1000 - i,
      })),
    });
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(13);
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(16);
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });
  it('distinguishes missing measurements from zero and avoids invalid percentages', () => {
    render(
      <DashboardPanelsProvider>
        <InsightsReport
          data={{
            ...insightsFixture,
            comparable_seconds: undefined,
            ai_additional_seconds: 0,
            ai_measured_seconds: undefined,
            data: [{ ...insightsFixture.data[0], total_seconds: 0, days: 0 }],
          }}
          statsError
        />
      </DashboardPanelsProvider>
    );
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    expect(screen.getByText(/Daily statistics could not load/)).toBeVisible();
    expect(screen.getByRole('complementary')).toHaveTextContent('0.0%');
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
  it('uses the selected period and all five dimensions in its queries', async () => {
    workspace();
    const user = userEvent.setup();
    await screen.findByRole('table');
    for (const [label, type] of [
      ['Projects', 'projects'],
      ['Editors', 'editors'],
      ['Systems', 'operating_systems'],
      ['Branches', 'branches'],
      ['Languages', 'languages'],
    ]) {
      await user.click(
        within(screen.getByRole('group', { name: 'Explore by' })).getByRole('button', {
          name: label,
        })
      );
      await screen.findByRole('table');
      expect(getInsights).toHaveBeenCalledWith('test-user', type, 'last_7_days');
    }
    await user.click(screen.getByRole('button', { name: '30 days' }));
    await screen.findByRole('table');
    expect(getInsights).toHaveBeenCalledWith('test-user', 'languages', 'last_30_days');
    expect(getStats).toHaveBeenCalledWith('test-user', 'last_30_days');
  });
  it('shows empty and error states with a working retry', async () => {
    vi.mocked(getInsights).mockRejectedValueOnce(new Error('offline'));
    workspace();
    await screen.findByText('Request failed');
    vi.mocked(getInsights).mockResolvedValue({ ...insightsFixture, data: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('Your next insight starts with a little activity')
    ).toBeVisible();
  });
});
