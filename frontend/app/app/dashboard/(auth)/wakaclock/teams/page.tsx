'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RequireUser } from '@/components/wakaclock/require-user';
import { RequiresPostgres } from '@/components/wakaclock/requires-postgres';
import { listOrganizations } from '@/lib/wakaclock/endpoints-v2';
import type { Organization } from '@/lib/wakaclock/measurement-types';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getTeamMeasurementHealth } from '@/lib/wakaclock/team-endpoints';
import { closedWeeks } from '@/lib/wakaclock/team-weeks';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { MyOrganizationInvites, OrganizationInvitesPanel } from './components/organization-invites';
import { OrganizationTeamsPanel } from './components/organization-teams-panel';
import { TeamActionsPanel } from './components/team-actions-panel';
import { TeamBillingSetupPanel } from './components/team-billing-setup-panel';
import { TeamComparisonPanel } from './components/team-comparison-panel';
import { TeamGithubPanel } from './components/team-github-panel';
import { TeamInsightsPanel } from './components/team-insights-panel';
import { TeamOnboardingPanel } from './components/team-onboarding-panel';
import { TeamOrganizationCreatePanel } from './components/team-organization-create-panel';
import { TeamOrganizationRecoveryPanel } from './components/team-organization-recovery-panel';
import { TeamSummaryPanel } from './components/team-summary-panel';
import { TeamTrustPanel } from './components/team-trust-panel';

function OrganizationCard({ organization }: { organization: Organization }) {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const sessionToken = useWakaclockUserStore((s) => s.token);
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
        <TeamOrganizationRecoveryPanel
          key={`birth:${userId}:${organization.id}`}
          organizationId={organization.id}
          sessionToken={sessionToken}
          userId={userId}
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
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const sessionToken = useWakaclockUserStore((s) => s.token);
  const organizations = useQuery({
    queryKey: wakaclockKeys.organizations(userId),
    queryFn: listOrganizations,
    enabled: Boolean(userId),
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
          <TeamOrganizationCreatePanel
            key={`create:${userId}`}
            sessionToken={sessionToken}
            userId={userId}
          />
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
