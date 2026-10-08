import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TeamInsightsPanel,
  teamCostLabel,
} from '@/app/dashboard/(auth)/wakaclock/teams/components/team-insights-panel';
import { WakaclockError } from '@/lib/wakaclock/client';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

import type { TeamMetric } from '@/lib/wakaclock/team-types';

const api = vi.hoisted(() => ({
  consent: vi.fn(),
  export: vi.fn(),
  insights: vi.fn(),
  sharing: vi.fn(),
  teams: vi.fn(),
  work: vi.fn(),
}));
vi.mock('@/lib/wakaclock/team-endpoints', () => ({
  getTeamConsent: api.consent,
  getTeamInsights: api.insights,
  getTeamWorkItems: api.work,
  exportTeamInsights: api.export,
}));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  listOrganizationTeams: api.teams,
  updateOrganizationSharing: api.sharing,
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (s: { userId: string }) => unknown) =>
    selector({ userId: 'member-a' }),
}));

const metric: TeamMetric = {
  calculation_version: 'team_usage_v1',
  coverage: null,
  provenance: 'canonical_usage_facts',
  reason: 'privacy_suppressed',
  status: 'unavailable',
  updated_at: null,
  value: null,
};

function panel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TeamInsightsPanel
        organizationId="org"
        start="2026-10-08"
        end="2026-10-08"
        timezone="Asia/Bangkok"
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.consent.mockResolvedValue({
    aggregate_from: null,
    individual_from: null,
    share_aggregate: false,
    share_individual: false,
    version: 0,
    preview: {
      metadata: ['usage counters', 'confirmed work links'],
      excludes: ['source', 'diff', 'prompt'],
      minimum_contributors: 5,
      history_before_consent: false,
      downloaded_exports_recallable: false,
    },
  });
  api.teams.mockResolvedValue([]);
  api.work.mockResolvedValue([]);
});

describe('Team privacy and freshness presentation', () => {
  it('distinguishes observed zero from unavailable and privacy suppression', () => {
    expect(teamCostLabel(metric)).toBe('Withheld for privacy');
    expect(teamCostLabel({ ...metric, reason: 'pricing_unavailable' })).toBe('Unavailable');
    expect(teamCostLabel({ ...metric, value: 0, reason: null })).toBe('$0.00');
  });

  it('shows preview and unavailable data without presenting zero activity', async () => {
    api.insights.mockResolvedValue({
      start: '2026-10-08',
      end: '2026-10-08',
      timezone: 'Asia/Bangkok',
      estimated_ai_cost_microusd: metric,
      merged_pr_cost_microusd: { ...metric, reason: 'allocation_unavailable' },
      measurement_health: ['capture_unconfirmed'],
      provider_breakdown: [],
    });
    panel();
    expect(await screen.findByText(/Estimated AI cost: Withheld for privacy/)).toBeInTheDocument();
    expect(screen.getByText(/Earlier personal history stays private/)).toBeInTheDocument();
    expect(screen.getByLabelText('Include my metadata in team aggregates')).not.toBeChecked();
    expect(
      screen.getByLabelText('Share my identifiable session and confirmed work details')
    ).toBeDisabled();
    expect(screen.queryByText(/\$0.00/)).not.toBeInTheDocument();
  });

  it('keeps consent withdrawal available while rollout is disabled', async () => {
    api.insights.mockRejectedValue(new WakaclockError('Team is not enabled', 503));
    panel();
    expect(await screen.findByText('Team is not enabled')).toBeInTheDocument();
    expect(screen.getByLabelText('Include my metadata in team aggregates')).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Export consent-filtered CSV' })
    ).not.toBeInTheDocument();
  });

  it('separates account, tenant, team, dates and timezone in cache keys', () => {
    const key = wakaclockKeys.teamInsights('a', 'org', 's', 'e', 'UTC', 'team');
    for (const other of [
      wakaclockKeys.teamInsights('b', 'org', 's', 'e', 'UTC', 'team'),
      wakaclockKeys.teamInsights('a', 'other', 's', 'e', 'UTC', 'team'),
      wakaclockKeys.teamInsights('a', 'org', 's', 'e', 'UTC', 'other'),
      wakaclockKeys.teamInsights('a', 'org', 's', 'e', 'Asia/Bangkok', 'team'),
    ]) {
      expect(key).not.toEqual(other);
    }
  });
});
