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
import { createOrganization, listOrganizations } from '@/lib/wakaclock/endpoints-v2';
import type { Organization } from '@/lib/wakaclock/measurement-types';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import {
  MyOrganizationInvites,
  OrganizationInvitesPanel,
  ORGANIZATIONS_QUERY_KEY,
} from './components/organization-invites';
import { OrganizationTeamsPanel } from './components/organization-teams-panel';
import { TeamInsightsPanel } from './components/team-insights-panel';

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{organization.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <OrganizationTeamsPanel organizationId={organization.id} />
        <OrganizationInvitesPanel organizationId={organization.id} />
        <TeamInsightsPanel
          end={end}
          organizationId={organization.id}
          start={start}
          timezone={timezone}
        />
      </CardContent>
    </Card>
  );
}

export default function TeamsPage() {
  const client = useQueryClient();
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [name, setName] = React.useState('');
  const { start, end, setRange } = useWakaclockRange(7);
  const timezone = getBrowserTimezone() ?? 'UTC';
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
