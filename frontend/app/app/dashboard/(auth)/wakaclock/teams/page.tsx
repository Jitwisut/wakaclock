'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { RequiresPostgres } from '@/components/wakaclock/requires-postgres';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getBrowserTimezone } from '@/lib/wakaclock/endpoints';
import {
  createOrganization,
  getOrganizationAnalytics,
  getOrganizationSharing,
  listOrganizations,
  updateOrganizationSharing,
} from '@/lib/wakaclock/endpoints-v2';
import { formatDurationShort, formatPercent } from '@/lib/wakaclock/format';
import type { Organization } from '@/lib/wakaclock/measurement-types';

import {
  MyOrganizationInvites,
  OrganizationInvitesPanel,
  ORGANIZATIONS_QUERY_KEY,
} from './components/organization-invites';
import { OrganizationTeamsPanel } from './components/organization-teams-panel';

function OrganizationCard({
  end,
  organization,
  start,
  timezone,
}: {
  end: string;
  organization: Organization;
  start: string;
  timezone: string;
}) {
  const client = useQueryClient();
  const sharingKey = ['org-sharing', organization.id];
  const analyticsKey = ['org-analytics', organization.id, start, end, timezone];
  const sharing = useQuery({
    queryKey: sharingKey,
    queryFn: () => getOrganizationSharing(organization.id),
  });
  const analytics = useQuery({
    queryKey: analyticsKey,
    queryFn: () => getOrganizationAnalytics(organization.id, start, end, timezone),
  });
  const update = useMutation({
    mutationFn: (value: { share_aggregate: boolean; share_individual: boolean }) =>
      updateOrganizationSharing(organization.id, value),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: sharingKey }),
        client.invalidateQueries({ queryKey: analyticsKey }),
      ]);
    },
  });
  const report = analytics.data?.measurement;
  const percent = report?.line_change_denominator
    ? (report.attributed_line_changes * 100) / report.line_change_denominator
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{organization.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <OrganizationTeamsPanel organizationId={organization.id} />
        <OrganizationInvitesPanel organizationId={organization.id} />
        <div className="rounded-md border p-3">
          <p className="font-medium">Your sharing choices</p>
          <p className="text-muted-foreground mt-1">
            Both options start off. Team totals use only members who explicitly share.
          </p>
          <QueryState error={sharing.error} isLoading={sharing.isLoading}>
            {sharing.data && (
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    checked={sharing.data.share_aggregate}
                    disabled={update.isPending}
                    onChange={(event) =>
                      update.mutate({
                        share_aggregate: event.target.checked,
                        share_individual: event.target.checked && sharing.data.share_individual,
                      })
                    }
                    type="checkbox"
                  />
                  Include my activity in team totals
                </label>
                <label className="flex items-center gap-2">
                  <input
                    checked={sharing.data.share_individual}
                    disabled={!sharing.data.share_aggregate || update.isPending}
                    onChange={(event) =>
                      update.mutate({
                        share_aggregate: true,
                        share_individual: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  Let organization admins see my individual totals
                </label>
                {update.isError && <p role="alert">Could not save sharing choice. Please retry.</p>}
              </div>
            )}
          </QueryState>
        </div>
        <div className="rounded-md border p-3">
          <p className="font-medium">Consented team activity</p>
          <QueryState error={analytics.error} isLoading={analytics.isLoading}>
            {report && (
              <div className="mt-2 space-y-1">
                <p>Contributing members: {report.consenting_members}</p>
                <p>
                  Reported time:{' '}
                  {report.total_seconds == null
                    ? 'unavailable'
                    : formatDurationShort(report.total_seconds)}
                </p>
                <p>
                  Observed evidence:{' '}
                  {report.proven_seconds == null
                    ? 'unavailable'
                    : formatDurationShort(report.proven_seconds)}
                </p>
                <p>
                  Bridged time:{' '}
                  {report.inferred_seconds == null
                    ? 'unavailable'
                    : formatDurationShort(report.inferred_seconds)}
                </p>
                <p>
                  Line attribution coverage:{' '}
                  {percent == null ? 'unavailable' : formatPercent(percent)}
                </p>
                {report.small_team_inference_warning && (
                  <p className="text-amber-700 dark:text-amber-300">
                    In a small team, an aggregate may reveal one member’s activity by inference.
                    Share only if you accept that risk.
                  </p>
                )}
                {report.individual.map((person) => (
                  <p key={person.user_id}>
                    Member {person.user_id.slice(0, 8)}: {formatDurationShort(person.total_seconds)}{' '}
                    (individual sharing enabled)
                  </p>
                ))}
              </div>
            )}
          </QueryState>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeamsPage() {
  const client = useQueryClient();
  const [name, setName] = React.useState('');
  const { start, end, setRange } = useWakaclockRange(7);
  const timezone = getBrowserTimezone() ?? 'UTC';
  const organizations = useQuery({ queryKey: ORGANIZATIONS_QUERY_KEY, queryFn: listOrganizations });
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
        actions={<RangePicker onChange={setRange} value={{ start, end }} />}
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
              {organizations.data?.map((organization) => (
                <OrganizationCard
                  end={end}
                  key={organization.id}
                  organization={organization}
                  start={start}
                  timezone={timezone}
                />
              ))}
            </div>
          </QueryState>
        </RequiresPostgres>
      </RequireUser>
    </div>
  );
}
