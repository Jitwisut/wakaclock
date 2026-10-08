'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { listOrganizationTeams, updateOrganizationSharing } from '@/lib/wakaclock/endpoints-v2';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  exportTeamInsights,
  getTeamConsent,
  getTeamInsights,
  getTeamWorkItems,
  getTeamWorkReceipt,
} from '@/lib/wakaclock/team-endpoints';
import type { TeamMetric, TeamWorkItem } from '@/lib/wakaclock/team-types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function teamCostLabel(metric: TeamMetric): string {
  if (metric.value === null) {
    return metric.reason === 'privacy_suppressed' ? 'Withheld for privacy' : 'Unavailable';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  }).format(metric.value / 1_000_000);
}

function WorkReceiptPanel({
  userId,
  organizationId,
  item,
  teamId,
}: {
  item: TeamWorkItem;
  organizationId: string;
  teamId?: string;
  userId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const receipt = useQuery({
    queryKey: wakaclockKeys.teamReceipt(
      userId,
      organizationId,
      item.repository_id,
      item.external_id,
      teamId
    ),
    queryFn: () => getTeamWorkReceipt(organizationId, item.repository_id, item.external_id, teamId),
    enabled: open && Boolean(userId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: open ? 30_000 : false,
    retry: false,
  });
  const data = receipt.isError || receipt.isFetching ? undefined : receipt.data;
  return (
    <details className="mt-2 rounded border p-2" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {item.kind === 'pull_request' ? 'PR' : 'Issue'} #{item.number} · {item.state} · view
        evidence
      </summary>
      {open && (
        <QueryState error={receipt.error} isLoading={receipt.isLoading}>
          {data && (
            <div className="mt-2 space-y-1">
              <p>
                Cost: {teamCostLabel(data.estimated_cost_microusd)} ·{' '}
                {data.estimated_cost_microusd.status}
              </p>
              <p>Sharing: {data.sharing}. Unshared details are withheld.</p>
              {data.sessions.map((session) => (
                <p key={session.link_id}>
                  Session {session.session_id.slice(0, 12)} · {session.link_evidence} ·{' '}
                  {session.allocation} · {teamCostLabel(session.cost_microusd)}
                </p>
              ))}
            </div>
          )}
        </QueryState>
      )}
    </details>
  );
}

export function TeamInsightsPanel({
  organizationId,
  start,
  end,
  timezone,
}: {
  end: string;
  organizationId: string;
  start: string;
  timezone: string;
}) {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const client = useQueryClient();
  const [teamId, setTeamId] = React.useState<string | undefined>();
  const consentKey = wakaclockKeys.teamConsent(userId, organizationId);
  const insightsKey = wakaclockKeys.teamInsights(
    userId,
    organizationId,
    start,
    end,
    timezone,
    teamId
  );
  const workKey = wakaclockKeys.teamWorkItems(userId, organizationId, teamId);
  const consent = useQuery({
    queryKey: consentKey,
    queryFn: () => getTeamConsent(organizationId),
    enabled: Boolean(userId),
    gcTime: 0,
    staleTime: 0,
  });
  const teams = useQuery({
    queryKey: wakaclockKeys.organizationTeams(userId, organizationId),
    queryFn: () => listOrganizationTeams(organizationId),
    enabled: Boolean(userId),
  });
  const insights = useQuery({
    queryKey: insightsKey,
    queryFn: () => getTeamInsights(organizationId, start, end, timezone, teamId),
    enabled: Boolean(userId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const work = useQuery({
    queryKey: workKey,
    queryFn: () => getTeamWorkItems(organizationId, teamId),
    enabled: Boolean(userId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const sharing = useMutation({
    mutationFn: (value: { share_aggregate: boolean; share_individual: boolean }) =>
      updateOrganizationSharing(organizationId, value),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: insightsKey });
      client.removeQueries({ queryKey: insightsKey });
      await client.cancelQueries({
        queryKey: [...wakaclockKeys.all, 'team-receipt', userId, organizationId],
      });
      client.removeQueries({
        queryKey: [...wakaclockKeys.all, 'team-receipt', userId, organizationId],
      });
      client.removeQueries({ queryKey: wakaclockKeys.teamHealth(userId, organizationId) });
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: consentKey }),
        client.invalidateQueries({ queryKey: insightsKey }),
      ]);
    },
  });
  const exportScope = `${userId}:${organizationId}:${teamId ?? ''}:${start}:${end}:${timezone}:${consent.data?.version}:${insights.data?.generation}`;
  const currentExportScope = React.useRef<null | string>(exportScope);
  currentExportScope.current =
    sharing.isPending ||
    consent.isFetching ||
    consent.isError ||
    insights.isFetching ||
    insights.isError
      ? null
      : exportScope;
  React.useEffect(
    () => () => {
      currentExportScope.current = null;
    },
    []
  );
  const download = useMutation({
    mutationFn: async () => ({
      scope: exportScope,
      csv: await exportTeamInsights(organizationId, start, end, timezone, teamId),
    }),
    onSuccess: ({ csv, scope }) => {
      if (currentExportScope.current !== scope) return;
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'atoaxis-team.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
  const report =
    sharing.isPending || insights.isError || insights.isFetching ? undefined : insights.data;
  const workItems = sharing.isPending || work.isError || work.isFetching ? undefined : work.data;

  return (
    <div className="space-y-4" key={`${userId}:${organizationId}`}>
      <section aria-label="Sharing preview" className="rounded-md border p-3">
        <p className="font-medium">Your sharing choices</p>
        <QueryState error={consent.error} isLoading={consent.isLoading}>
          {!consent.isError && !consent.isFetching && consent.data && (
            <div className="mt-2 space-y-2">
              <p>Preview: {consent.data.preview.metadata.join(', ')}.</p>
              <p className="text-muted-foreground">
                Excluded: {consent.data.preview.excludes.join(', ')}. Sharing starts when you opt
                in. Earlier personal history stays private.
              </p>
              <p>
                Team totals require at least {consent.data.preview.minimum_contributors} actual
                contributors. Small groups and complementary totals are withheld.
              </p>
              <label className="flex items-center gap-2">
                <input
                  checked={consent.data.share_aggregate}
                  disabled={sharing.isPending}
                  onChange={(e) =>
                    sharing.mutate({
                      share_aggregate: e.target.checked,
                      share_individual: e.target.checked && consent.data!.share_individual,
                    })
                  }
                  type="checkbox"
                />{' '}
                Include my metadata in team aggregates
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={consent.data.share_individual}
                  disabled={sharing.isPending || !consent.data.share_aggregate}
                  onChange={(e) =>
                    sharing.mutate({ share_aggregate: true, share_individual: e.target.checked })
                  }
                  type="checkbox"
                />{' '}
                Share my identifiable session and confirmed work details
              </label>
              {consent.data.aggregate_from && (
                <p className="text-muted-foreground">
                  Aggregate sharing since {consent.data.aggregate_from} · consent version{' '}
                  {consent.data.version}
                </p>
              )}
              <p className="text-muted-foreground">
                Withdrawal blocks future reads. Files already downloaded cannot be recalled.
              </p>
              {sharing.isError && <p role="alert">Could not save sharing choice. Please retry.</p>}
            </div>
          )}
        </QueryState>
      </section>
      <section aria-label="Team evidence" className="rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">AI cost and work evidence</p>
          <select
            aria-label="Report team"
            className="rounded border p-2"
            onChange={(e) => setTeamId(e.target.value || undefined)}
            value={teamId ?? ''}
          >
            <option value="">Organization (owner/admin)</option>
            {teams.data?.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-muted-foreground mt-2">
          {start}–{end} · {timezone}. Costs are estimates from received usage, separate from
          subscription charges.
        </p>
        <QueryState error={insights.error} isLoading={insights.isLoading}>
          {report && (
            <div className="mt-3 space-y-2">
              <p>Estimated AI cost: {teamCostLabel(report.estimated_ai_cost_microusd)}</p>
              <p>Confirmed cost for merged PRs: {teamCostLabel(report.merged_pr_cost_microusd)}</p>
              <p>
                Data: {report.estimated_ai_cost_microusd.status} · coverage{' '}
                {report.estimated_ai_cost_microusd.coverage === null
                  ? 'unavailable'
                  : `${(report.estimated_ai_cost_microusd.coverage * 100).toFixed(1)}%`}
              </p>
              <p className="text-muted-foreground">
                Source: {report.estimated_ai_cost_microusd.provenance} · updated{' '}
                {report.estimated_ai_cost_microusd.updated_at ?? 'unavailable'}
              </p>
              {report.measurement_health.length > 0 && (
                <p role="status">
                  Data completeness is unconfirmed. Capture, delivery and integration must be
                  verified independently.
                </p>
              )}
              {report.provider_breakdown.map((provider) => (
                <p key={`${provider.provider}:${provider.model}`}>
                  {provider.provider} / {provider.model}: {teamCostLabel(provider.cost_microusd)}
                </p>
              ))}
              <Button disabled={download.isPending} onClick={() => download.mutate()}>
                Export consent-filtered CSV
              </Button>
              {download.isError && <p role="alert">Export unavailable. Refresh and retry.</p>}
            </div>
          )}
        </QueryState>
        <QueryState error={work.error} isLoading={work.isLoading}>
          {workItems?.map((item) => (
            <WorkReceiptPanel
              item={item}
              key={`${userId}:${organizationId}:${teamId}:${item.repository_id}:${item.external_id}`}
              organizationId={organizationId}
              teamId={teamId}
              userId={userId}
            />
          ))}
          {workItems?.length === 0 && (
            <p className="mt-2">
              No synchronized work items. Connect the GitHub App to selected repositories first.
            </p>
          )}
        </QueryState>
        <p className="text-muted-foreground mt-3">
          A merge confirms a PR was merged. Deployment and business outcomes need separate evidence.
          Team is in controlled rollout; checkout remains unavailable.
        </p>
      </section>
    </div>
  );
}
