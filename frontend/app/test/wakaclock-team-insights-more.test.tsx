import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { TeamInsightsPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-insights-panel';

import type { TeamMetric } from '@/lib/wakaclock/team-types';

const api = vi.hoisted(() => ({
  consent: vi.fn(),
  export: vi.fn(),
  insights: vi.fn(),
  receipt: vi.fn(),
  sharing: vi.fn(),
  teams: vi.fn(),
  work: vi.fn(),
  user: 'member-a' as null | string,
}));
vi.mock('@/lib/wakaclock/team-endpoints', () => ({
  getTeamConsent: api.consent,
  getTeamInsights: api.insights,
  getTeamWorkItems: api.work,
  getTeamWorkReceipt: api.receipt,
  exportTeamInsights: api.export,
}));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  listOrganizationTeams: api.teams,
  updateOrganizationSharing: api.sharing,
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (s: { userId: null | string }) => unknown) =>
    selector({ userId: api.user }),
}));

const metric = (value: null | number, extra: Partial<TeamMetric> = {}): TeamMetric => ({
  calculation_version: 'team_usage_v1',
  coverage: null,
  provenance: 'canonical_usage_facts',
  reason: value === null ? 'privacy_suppressed' : null,
  status: value === null ? 'unavailable' : 'observed',
  updated_at: null,
  value,
  ...extra,
});

const consent = (shareAggregate: boolean, shareIndividual: boolean) => ({
  aggregate_from: shareAggregate ? '2026-10-01' : null,
  individual_from: null,
  share_aggregate: shareAggregate,
  share_individual: shareIndividual,
  version: 3,
  preview: {
    metadata: ['usage counters'],
    excludes: ['source'],
    minimum_contributors: 5,
    history_before_consent: false,
    downloaded_exports_recallable: false,
  },
});

const report = {
  generation: 2,
  start: '2026-09-28',
  end: '2026-10-04',
  timezone: 'Asia/Bangkok',
  estimated_ai_cost_microusd: metric(2_500_000, {
    coverage: 0.875,
    updated_at: '2026-10-04T10:00:00Z',
  }),
  merged_pr_cost_microusd: metric(1_000_000),
  merged_pr_cost: {
    average_microusd: metric(500_000),
    calculation_version: 'merged_pr_cost_v1',
    complete_prs: metric(2),
    pricing_versions: ['2026-10'],
    with_cost: metric(3),
    without_cost: metric(null),
  },
  measurement_health: [],
  provider_breakdown: [
    { provider: 'anthropic', model: 'claude', cost_microusd: metric(2_500_000) },
  ],
};

const item = (kind: string, number: number) => ({
  closed_at: null,
  external_id: number,
  first_review_at: null,
  kind,
  merged_at: null,
  number,
  opened_at: '2026-10-01T00:00:00Z',
  ready_at: null,
  repository_id: 'repo-1',
  session_details: 'withheld',
  state: 'open',
  synced_at: '2026-10-04T00:00:00Z',
});

function panel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TeamInsightsPanel
        organizationId="org"
        start="2026-09-28"
        end="2026-10-04"
        timezone="Asia/Bangkok"
      />
    </QueryClientProvider>
  );
  return { client, view };
}

function toggle(details: HTMLElement, open: boolean) {
  (details as HTMLDetailsElement).open = open;
  fireEvent(details, new Event('toggle'));
}

beforeEach(() => {
  api.user = 'member-a';
  for (const fn of Object.values(api)) if (typeof fn === 'function') fn.mockReset();
  api.consent.mockResolvedValue(consent(true, true));
  api.teams.mockResolvedValue([{ id: 'team-1', name: 'Platform' }]);
  api.insights.mockResolvedValue(report);
  api.work.mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it('reads nothing until the session has an owner', () => {
  api.user = null;
  panel();
  expect(api.consent).not.toHaveBeenCalled();
  expect(api.insights).not.toHaveBeenCalled();
  expect(api.work).not.toHaveBeenCalled();
});

it('saves each sharing choice, keeps individual sharing tied to aggregates and reports failures', async () => {
  api.sharing
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error('no'));
  panel();
  expect(
    await screen.findByText(/Aggregate sharing since 2026-10-01 · consent version/)
  ).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Include my metadata in team aggregates'));
  await waitFor(() =>
    expect(api.sharing).toHaveBeenCalledWith('org', {
      share_aggregate: false,
      share_individual: false,
    })
  );

  fireEvent.click(
    await screen.findByLabelText('Share my identifiable session and confirmed work details')
  );
  await waitFor(() =>
    expect(api.sharing).toHaveBeenCalledWith('org', {
      share_aggregate: true,
      share_individual: false,
    })
  );

  api.consent.mockResolvedValue(consent(false, false));
  fireEvent.click(await screen.findByLabelText('Include my metadata in team aggregates'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save sharing choice');
});

it('re-reads insights for a selected team and returns to the organization view', async () => {
  panel();
  await screen.findByText(/Estimated AI cost:/);
  const select = screen.getByLabelText('Report team');
  expect(await screen.findByRole('option', { name: 'Platform' })).toBeInTheDocument();
  fireEvent.change(select, { target: { value: 'team-1' } });
  await waitFor(() =>
    expect(api.insights).toHaveBeenLastCalledWith(
      'org',
      '2026-09-28',
      '2026-10-04',
      'Asia/Bangkok',
      'team-1'
    )
  );
  fireEvent.change(select, { target: { value: '' } });
  await waitFor(() =>
    expect(api.insights).toHaveBeenLastCalledWith(
      'org',
      '2026-09-28',
      '2026-10-04',
      'Asia/Bangkok',
      undefined
    )
  );
});

it('shows merged-PR cost, coverage and providers, and exports the current scope', async () => {
  const createObjectURL = vi.fn(() => 'blob:team');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  api.export.mockResolvedValueOnce('team,cost\n').mockRejectedValueOnce(new Error('gone'));
  panel();
  expect(
    await screen.findByText(/PRs with known cost: 3 · Without cost: withheld/)
  ).toBeInTheDocument();
  expect(screen.getByText(/PR count:\s*2/)).toBeInTheDocument();
  expect(screen.getByText(/coverage 87.5%/)).toBeInTheDocument();
  expect(screen.getByText(/updated 2026-10-04T10:00:00Z/)).toBeInTheDocument();
  expect(screen.getByText(/anthropic \/ claude: \$2.50/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Export consent-filtered CSV' }));
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
  expect(click).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:team');

  fireEvent.click(screen.getByRole('button', { name: 'Export consent-filtered CSV' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Export unavailable');
  click.mockRestore();
});

it('withholds PR counts that the server suppresses', async () => {
  api.insights.mockResolvedValue({
    ...report,
    merged_pr_cost: {
      ...report.merged_pr_cost,
      with_cost: metric(null),
      complete_prs: metric(null),
      without_cost: metric(4),
    },
  });
  panel();
  expect(
    await screen.findByText(/PRs with known cost: withheld · Without cost: 4/)
  ).toBeInTheDocument();
  expect(screen.getByText(/PR count:\s*withheld/)).toBeInTheDocument();
});

it('opens work evidence on demand and hides it again when collapsed', async () => {
  api.work.mockResolvedValue([item('pull_request', 7), item('issue', 8)]);
  api.receipt
    .mockResolvedValueOnce({
      estimated_cost_microusd: metric(250_000),
      sharing: 'individual',
      sessions: [
        {
          link_id: 'link-1',
          session_id: 'session-abcdefghijkl',
          link_evidence: 'branch_match',
          allocation: 'full',
          cost_microusd: metric(250_000),
        },
      ],
    })
    .mockRejectedValueOnce(new Error('Receipt unavailable'));
  panel();
  const pr = (await screen.findByText(/PR #7 · open · view/)).closest('details') as HTMLElement;
  const issue = screen.getByText(/Issue #8 · open · view/).closest('details') as HTMLElement;
  expect(api.receipt).not.toHaveBeenCalled();

  toggle(pr, true);
  expect(await screen.findByText(/Session session-abcd · branch_match · full/)).toBeInTheDocument();
  expect(screen.getByText(/Sharing: individual/)).toBeInTheDocument();
  expect(api.receipt).toHaveBeenCalledWith('org', 'repo-1', 7, undefined);
  toggle(pr, false);
  await waitFor(() => expect(screen.queryByText(/Sharing: individual/)).toBeNull());

  toggle(issue, true);
  expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
  await act(async () => {});
});

it('opting in to aggregates keeps the earlier individual choice off', async () => {
  api.consent.mockResolvedValue(consent(false, false));
  api.sharing.mockResolvedValue({});
  panel();
  fireEvent.click(await screen.findByLabelText('Include my metadata in team aggregates'));
  await waitFor(() =>
    expect(api.sharing).toHaveBeenCalledWith('org', {
      share_aggregate: true,
      share_individual: false,
    })
  );
});
