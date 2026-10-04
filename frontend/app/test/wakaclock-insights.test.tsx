import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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

const session = vi.hoisted(() => ({
  userId: 'test-user' as null | string,
  timezone: 'Asia/Bangkok' as undefined | string,
}));
vi.mock('@/lib/wakaclock/endpoints', () => ({
  getInsights: vi.fn(),
  getStats: vi.fn(),
  getBrowserTimezone: () => session.timezone,
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (state: { userId: null | string }) => unknown) => select(session),
}));
function report(data = insightsFixture) {
  return render(
    <DashboardPanelsProvider>
      <InsightsReport data={data} stats={insightsStatsFixture} />
    </DashboardPanelsProvider>
  );
}

it('keeps future breakdown types readable using a generic entry label', () => {
  report({ ...insightsFixture, type: 'future_dimension' });
  expect(screen.getByPlaceholderText('Find entries…')).toBeVisible();
  expect(screen.getByRole('columnheader', { name: 'Rank / Entries' })).toBeVisible();
});
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
  session.userId = 'test-user';
  session.timezone = 'Asia/Bangkok';
  vi.mocked(getInsights)
    .mockReset()
    .mockImplementation(async (_user, type, range) => ({ ...insightsFixture, type, range }));
  vi.mocked(getStats).mockReset().mockResolvedValue(insightsStatsFixture);
});

it('does not fetch private insights after signing out', () => {
  session.userId = null;
  workspace();
  expect(screen.getByRole('heading', { name: 'Insights' })).toBeVisible();
  expect(getInsights).not.toHaveBeenCalled();
  expect(getStats).not.toHaveBeenCalled();
});

it('loads insights with UTC fallback when browser timezone is unavailable', async () => {
  session.timezone = undefined;
  workspace();
  await screen.findByRole('table');
  expect(getInsights).toHaveBeenCalledWith('test-user', 'languages', 'last_7_days');
});

it('keeps daily statistics pending and missing AI measurements unavailable', () => {
  render(
    <DashboardPanelsProvider>
      <InsightsReport
        data={{ ...insightsFixture, ai_additional_seconds: undefined }}
        statsPending
      />
    </DashboardPanelsProvider>
  );
  expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  expect(screen.getByText('Additional measured AI').nextElementSibling).toHaveTextContent(
    'Unavailable'
  );
});

it('clears the report when a refreshed range contains no entries', () => {
  const view = report();
  expect(screen.getByRole('table')).toBeVisible();
  view.rerender(
    <DashboardPanelsProvider>
      <InsightsReport data={{ ...insightsFixture, data: [] }} />
    </DashboardPanelsProvider>
  );
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
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

it('sorts entries by name and heartbeat count and selects a legend entry', async () => {
  const data = {
    ...insightsFixture,
    data: [
      { ...insightsFixture.data[0], name: 'Zulu', total_seconds: 60, heartbeats: 1, days: 1 },
      { ...insightsFixture.data[0], name: 'Alpha', total_seconds: 60, heartbeats: 4, days: 1 },
    ],
  };
  report(data);
  const user = userEvent.setup();
  const sort = screen.getByRole('combobox', { name: 'Sort entries' });
  await user.selectOptions(sort, 'name');
  expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent('Alpha');
  await user.selectOptions(sort, 'heartbeats');
  expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent('Alpha');
  await user.selectOptions(sort, 'days');
  expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent('Alpha');
  const legend = screen
    .getAllByRole('button', { name: /Zulu/ })
    .find((button) => !button.closest('table'))!;
  await user.click(legend);
  expect(screen.getByRole('complementary', { name: 'Selected insight' })).toHaveTextContent('Zulu');
});

it('retries unavailable daily statistics without losing the insight report', async () => {
  vi.mocked(getStats).mockRejectedValueOnce(new Error('statistics offline'));
  workspace();
  await screen.findByRole('table');
  const retry = await screen.findByRole('button', { name: /Retry/i });
  await userEvent.click(retry);
  await waitFor(() =>
    expect(screen.queryByText(/Daily statistics could not load/)).not.toBeInTheDocument()
  );
  expect(getStats).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('table')).toBeVisible();
});
