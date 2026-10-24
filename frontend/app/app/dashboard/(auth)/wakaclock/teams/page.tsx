'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RequireUser } from '@/components/wakaclock/require-user';
import { RequiresPostgres } from '@/components/wakaclock/requires-postgres';
import { createOrganization, listOrganizations } from '@/lib/wakaclock/endpoints-v2';
import type { Organization } from '@/lib/wakaclock/measurement-types';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getTeamMeasurementHealth } from '@/lib/wakaclock/team-endpoints';
import { closedWeeks } from '@/lib/wakaclock/team-weeks';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import {
  MyOrganizationInvites,
  OrganizationInvitesPanel,
  ORGANIZATIONS_QUERY_KEY,
} from './components/organization-invites';
import { OrganizationTeamsPanel } from './components/organization-teams-panel';
import { TeamActionsPanel } from './components/team-actions-panel';
import { TeamBillingSetupPanel } from './components/team-billing-setup-panel';
import { TeamComparisonPanel } from './components/team-comparison-panel';
import { TeamGithubPanel } from './components/team-github-panel';
import { TeamInsightsPanel } from './components/team-insights-panel';
import { TeamOnboardingPanel } from './components/team-onboarding-panel';
import { TeamSummaryPanel } from './components/team-summary-panel';
import { TeamTrustPanel } from './components/team-trust-panel';

function OrganizationCard({ organization }: { organization: Organization }) {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const health = useQuery({
    queryKey: wakaclockKeys.teamHealth(userId, organization.id),
    queryFn: () => getTeamMeasurementHealth(organization.id),
    enabled: Boolean(userId),
    retry: false,
    gcTime: 0,
  });
  const timezone = health.isError ? undefined : health.data?.report_timezone;
  const weeks = timezone ? closedWeeks(timezone) : [];
  const [selected, setSelected] = React.useState('');
  const week = weeks.find((w) => w.start === selected) ?? weeks[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{organization.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <TeamOnboardingPanel
          key={`setup:${userId}:${organization.id}`}
          organizationId={organization.id}
        />
        <TeamBillingSetupPanel organizationId={organization.id} />
        <OrganizationTeamsPanel organizationId={organization.id} />
        <OrganizationInvitesPanel organizationId={organization.id} />
        <TeamTrustPanel organizationId={organization.id} />
        <TeamGithubPanel key={`${userId}:${organization.id}`} organizationId={organization.id} />
        <QueryState error={health.error} isLoading={health.isLoading}>
          {week && timezone && (
            <>
              <select
                aria-label="Completed report week"
                className="rounded border p-2"
                onChange={(e) => setSelected(e.target.value)}
                value={week.start}
              >
                {weeks.map((w) => (
                  <option key={w.start} value={w.start}>
                    {w.start}–{w.end} · {timezone}
                  </option>
                ))}
              </select>
              {health.data?.capabilities?.weekly_comparison && (
                <TeamComparisonPanel
                  key={`compare:${userId}:${organization.id}`}
                  organizationId={organization.id}
                  organizationTimezone={timezone}
                />
              )}
              {health.data?.capabilities?.weekly_summary && (
                <TeamSummaryPanel
                  key={`summary:${userId}:${organization.id}`}
                  organizationId={organization.id}
                  organizationTimezone={timezone}
                />
              )}
              {health.data?.capabilities?.improvement_actions && (
                <TeamActionsPanel organizationId={organization.id} timezone={timezone} />
              )}
              <TeamInsightsPanel
                end={week.end}
                key={`${userId}:${organization.id}:${timezone}`}
                organizationId={organization.id}
                start={week.start}
                timezone={timezone}
              />
            </>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

export default function TeamsPage() {
  const client = useQueryClient();
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [name, setName] = React.useState('');
  const organizations = useQuery({
    queryKey: wakaclockKeys.organizations(userId),
    queryFn: listOrganizations,
    enabled: Boolean(userId),
  });
  const create = useMutation({
    mutationFn: () => createOrganization(name),
    onSuccess: async () => {
      setName('');
      await client.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
  return (
    <div className="space-y-4">
      <WakaclockPageHeader
        description="Team reports include only members who choose to share. Individual totals need a second opt-in."
        title="Teams"
      />
      <RequireUser>
        <RequiresPostgres feature="Teams">
          <MyOrganizationInvites />
          <Card>
            <CardHeader>
              <CardTitle>Create an organization</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                aria-label="Organization name"
                className="max-w-xs"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
                Create
              </Button>
              {create.isError && <p role="alert">Could not create organization.</p>}
            </CardContent>
          </Card>
          <QueryState error={organizations.error} isLoading={organizations.isLoading}>
            <div className="grid gap-4 lg:grid-cols-2">
              {!organizations.isError &&
                !organizations.isFetching &&
                organizations.data?.map((organization) => (
                  <OrganizationCard
                    key={`${userId}:${organization.id}`}
                    organization={organization}
                  />
                ))}
            </div>
          </QueryState>
        </RequiresPostgres>
      </RequireUser>
    </div>
  );
}
