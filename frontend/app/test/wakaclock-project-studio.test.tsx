import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  aiFixture,
  fileFixtures,
  split,
  studioFixture,
} from '@/.storybook/stories/wakaclock/project-studio.fixtures';
import {
  ProjectAiPanel,
  ProjectDeepDive,
  ProjectFilesPanel,
} from '@/components/wakaclock/analytics/project-deep-dive';
import {
  ProjectRhythm,
  ProjectStudio,
  StudioBreakdown,
} from '@/components/wakaclock/analytics/project-studio';
import {
  getProjectAnalyticsBranches,
  getProjectAnalyticsDetail,
  getProjectAnalyticsFiles,
} from '@/lib/wakaclock/endpoints';
import type {
  ProjectAnalyticsDetailResponse,
  ProjectBranchesResponse,
  ProjectFilesResponse,
} from '@/lib/wakaclock/types';

vi.mock('@/lib/wakaclock/endpoints', () => ({
  getProjectAnalyticsBranches: vi.fn(),
  getProjectAnalyticsDetail: vi.fn(),
  getProjectAnalyticsFiles: vi.fn(),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (state: { userId: string }) => unknown) =>
    select({ userId: 'test-user' }),
}));

const range = { ...studioFixture.range, branch: 'all' };
const base = {
  range,
  schema_version: 2,
  generated_at: studioFixture.generated_at,
  data_version: 1,
};
const branchItems = ['main', 'feature/studio'].map((branch) => ({
  branch,
  total_seconds: 3600,
  heartbeat_count: 20,
  ai_changes: 4,
  human_changes: 3,
  ai_verified_changes: 4,
  ai_inferred_changes: 0,
  unknown_changes: null,
  unattributed_changes: null,
}));
const detail: ProjectAnalyticsDetailResponse = {
  ...base,
  ai: aiFixture,
  branches: branchItems,
  daily_activity: [],
  editors: [],
  languages: [],
  project: { project_id: 'demo', name: 'Demo', repository: null },
  summary: {
    active_days: 2,
    project_seconds: 7200,
    all_projects_seconds: 10000,
    last_activity_at: null,
  },
  top_files: fileFixtures,
};
const filePage: ProjectFilesResponse = {
  ...base,
  items: [fileFixtures[0]],
  next_cursor: 'page-2',
  metric: 'active_duration',
  unit: 'seconds',
  other_seconds: 2160,
  project_total_seconds: 7200,
  attribution_coverage_percent: null,
};
const branchPage: ProjectBranchesResponse = {
  ...base,
  items: branchItems,
  next_cursor: null,
  other_seconds: 0,
  attribution_coverage_percent: null,
};

function renderDeepDive() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectDeepDive
        projectId="demo"
        start={range.start}
        end={range.end}
        timezone="Asia/Bangkok"
        hasExplorerFilters
      />
    </QueryClientProvider>
  );
}

describe('Project Studio', () => {
  beforeEach(() => {
    vi.mocked(getProjectAnalyticsDetail).mockResolvedValue(detail);
    vi.mocked(getProjectAnalyticsBranches).mockResolvedValue(branchPage);
    vi.mocked(getProjectAnalyticsFiles).mockImplementation(async (_id, params) =>
      params.cursor ? { ...filePage, items: [fileFixtures[1]], next_cursor: null } : filePage
    );
  });

  it('handles an empty range without invalid averages or a fictitious busiest day', () => {
    render(
      <ProjectStudio
        name="Empty"
        data={{
          ...studioFixture,
          summary: { ...split(0), active_days: 0, ai_share_percent: null },
          calendar_heatmap: [],
        }}
      />
    );
    expect(screen.getByText('No activity in this range')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it('shows every language and supports clearing the selected language', async () => {
    const onSelect = vi.fn();
    const items = Array.from({ length: 9 }, (_, i) => ({
      key: `lang-${i}`,
      name: `Language ${i}`,
      total_seconds: i + 1,
    }));
    render(
      <StudioBreakdown
        eyebrow="Languages"
        title="Palette"
        items={items}
        onSelect={onSelect}
        selected="lang-8"
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(9);
    await userEvent.click(screen.getByRole('button', { name: /Language 8/ }));
    expect(onSelect).toHaveBeenCalledWith('');
    await userEvent.click(screen.getByRole('button', { name: /Language 0/ }));
    expect(onSelect).toHaveBeenLastCalledWith('lang-0');
  });

  it('preserves unavailable AI metrics instead of presenting them as measured zeros', () => {
    render(
      <ProjectAiPanel ai={{ ...aiFixture, sessions: 0, prompts: null, unknown_lines: null }} />
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(1);
    expect(screen.getByText('Unknown lines').parentElement).toHaveTextContent('Unavailable');
  });

  it('searches, sorts and inspects files without losing the full list', async () => {
    const load = vi.fn();
    render(
      <ProjectFilesPanel
        files={fileFixtures}
        totalSeconds={72420}
        hasMore
        loadingMore={false}
        onLoadMore={load}
      />
    );
    await userEvent.type(screen.getByRole('searchbox'), 'codex.rs');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.selectOptions(screen.getByLabelText('Sort loaded files'), 'ai');
    expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent('mod.rs');
    await userEvent.click(screen.getByRole('button', { name: /Inspect src\/main.rs/ }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Show all files' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(13);
    await userEvent.click(screen.getByRole('button', { name: 'Load more files' }));
    expect(load).toHaveBeenCalledOnce();
  });

  it('renders duplicate API file identities once, with no React key errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = { ...fileFixtures[0], path: 'main.rs' };
    render(
      <ProjectFilesPanel
        files={[file, { ...file, language: 'Unknown' }, file]}
        totalSeconds={72420}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />
    );
    expect(screen.getByText('1 files loaded')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /Inspect main.rs/ }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('stops an older API from repeating the same pagination cursor', async () => {
    vi.mocked(getProjectAnalyticsFiles).mockResolvedValue(filePage);
    renderDeepDive();
    await screen.findByRole('heading', { name: 'Your file landscape' });
    await userEvent.click(screen.getByRole('button', { name: 'Load more files' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Load more files' })).not.toBeInTheDocument()
    );
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(getProjectAnalyticsFiles).toHaveBeenCalledTimes(2);
  });

  it('passes dates and timezone to all endpoints, appends pages and scopes branch changes', async () => {
    renderDeepDive();
    await screen.findByRole('heading', { name: 'Your file landscape' });
    for (const endpoint of [
      getProjectAnalyticsDetail,
      getProjectAnalyticsFiles,
      getProjectAnalyticsBranches,
    ]) {
      expect(endpoint).toHaveBeenCalledWith(
        'demo',
        expect.objectContaining({ start: range.start, end: range.end, timezone: 'Asia/Bangkok' })
      );
    }
    expect(screen.getByText(/Overview filters are active above/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more files' }));
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3)
    );
    expect(getProjectAnalyticsFiles).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({ cursor: 'page-2' })
    );
    await userEvent.selectOptions(screen.getByLabelText('Branch'), 'feature/studio');
    await waitFor(() =>
      expect(getProjectAnalyticsFiles).toHaveBeenCalledWith(
        'demo',
        expect.objectContaining({ branch: 'feature/studio' })
      )
    );
    expect(getProjectAnalyticsDetail).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({ branch: 'feature/studio' })
    );
    expect(getProjectAnalyticsBranches).toHaveBeenCalledTimes(1);
    await screen.findByRole('table');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
  });

  it('keeps other sections usable when file loading fails and supports retry', async () => {
    vi.mocked(getProjectAnalyticsFiles).mockRejectedValueOnce(new Error('Offline'));
    renderDeepDive();
    await screen.findByText('Could not load files.');
    expect(
      screen.getByRole('heading', { name: 'A closer look at your co-pilots' })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry files' }));
    await screen.findByRole('heading', { name: 'Your file landscape' });
  });
});

it('renders a project rhythm from recorded hourly activity, with an explicit unavailable state', () => {
  const view = render(<ProjectRhythm data={studioFixture} />);
  expect(screen.getAllByRole('img')).toHaveLength(168);
  expect(screen.getByText(/recorded in your busiest weekly hour/)).toBeVisible();
  view.rerender(<ProjectRhythm data={{ ...studioFixture, time_heatmap: [] }} />);
  expect(screen.getByText('Hourly activity is not available for this selection.')).toBeVisible();
  view.rerender(
    <ProjectRhythm
      data={{
        ...studioFixture,
        time_heatmap: studioFixture.time_heatmap.map((cell) => ({ ...cell, total_seconds: 0 })),
      }}
    />
  );
  expect(screen.getByText('Your rhythm starts here')).toBeVisible();
  expect(screen.getByText('No activity in this selection.')).toBeVisible();
});
it('renders the busiest project day and handles an empty breakdown or measured zero without NaN', () => {
  const view = render(<ProjectStudio name="Lab" data={studioFixture} />);
  expect(screen.queryByText('No activity in this range')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Explore your files' })).toHaveAttribute(
    'href',
    '#project-files'
  );
  view.rerender(
    <ProjectStudio
      name="Lab"
      data={{
        ...studioFixture,
        range: { ...studioFixture.range, days_included: 0 },
        summary: { ...studioFixture.summary, active_days: 1 },
        calendar_heatmap: studioFixture.calendar_heatmap.map((day) => ({
          ...day,
          total_seconds: 0,
        })),
      }}
    />
  );
  expect(screen.getByText('Across 1 active day')).toBeVisible();
  expect(screen.getByText('0%')).toBeVisible();
  view.rerender(
    <StudioBreakdown title="Languages" eyebrow="Language use" items={[]} onSelect={vi.fn()} />
  );
  expect(screen.getByText('No activity recorded in this selection.')).toBeVisible();
  view.rerender(
    <StudioBreakdown
      title="Languages"
      eyebrow="Language use"
      items={[{ key: 'Rust', name: 'Rust', total_seconds: 0 }]}
      onSelect={vi.fn()}
    />
  );
  expect(screen.getByRole('button', { name: /Rust/ })).toHaveTextContent('0.0%');
});

describe('Project drill-down recovery', () => {
  beforeEach(() => {
    vi.mocked(getProjectAnalyticsDetail).mockResolvedValue(detail);
    vi.mocked(getProjectAnalyticsBranches).mockResolvedValue(branchPage);
    vi.mocked(getProjectAnalyticsFiles).mockResolvedValue({ ...filePage, next_cursor: null });
  });
  it('retries detail and branch failures independently without losing loaded files', async () => {
    vi.mocked(getProjectAnalyticsDetail).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(getProjectAnalyticsBranches).mockRejectedValueOnce(new Error('offline'));
    renderDeepDive();
    await screen.findByRole('table');
    await userEvent.click(await screen.findByRole('button', { name: 'Retry details' }));
    await screen.findByRole('heading', { name: 'A closer look at your co-pilots' });
    await userEvent.click(await screen.findByRole('button', { name: 'Retry branches' }));
    await screen.findByRole('option', { name: 'feature/studio' });
    expect(getProjectAnalyticsDetail).toHaveBeenCalledTimes(2);
    expect(getProjectAnalyticsBranches).toHaveBeenCalledTimes(2);
    expect(getProjectAnalyticsFiles).toHaveBeenCalledTimes(1);
  });
  it('loads branch pages and allows clicking a branch twice or resetting back to all', async () => {
    vi.mocked(getProjectAnalyticsBranches).mockImplementation(async (_id, params) =>
      params.cursor
        ? { ...branchPage, items: [{ ...branchItems[0], branch: '' }], next_cursor: null }
        : { ...branchPage, next_cursor: 'next-branch' }
    );
    renderDeepDive();
    await userEvent.click(await screen.findByRole('button', { name: 'Load more branches' }));
    expect(getProjectAnalyticsBranches).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({ cursor: 'next-branch' })
    );
    await screen.findByRole('option', { name: 'Unknown branch' });
    const branch = within(screen.getByRole('region', { name: 'Project branches' })).getByRole(
      'button',
      { name: /^main/ }
    );
    await userEvent.click(branch);
    expect(screen.getByLabelText('Branch')).toHaveValue('main');
    await userEvent.click(branch);
    expect(screen.getByLabelText('Branch')).toHaveValue('all');
    await userEvent.selectOptions(screen.getByLabelText('Branch'), 'feature/studio');
    await userEvent.click(screen.getByRole('button', { name: 'Reset branch' }));
    expect(screen.getByLabelText('Branch')).toHaveValue('all');
  });
  it('sorts loaded files by path and distinguishes no matches from unavailable totals', async () => {
    render(
      <ProjectFilesPanel
        files={fileFixtures}
        totalSeconds={0}
        hasMore={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
      />
    );
    await userEvent.selectOptions(screen.getByLabelText('Sort loaded files'), 'name');
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent(
      [...fileFixtures].sort((a, b) => a.path.localeCompare(b.path))[0].path
    );
    await userEvent.type(screen.getByRole('searchbox'), 'not-a-fixture');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1);
    expect(screen.getByText(/No loaded files match/)).toBeVisible();
  });
});
