'use client';
import * as React from 'react';

import { useIsMutating, useQuery } from '@tanstack/react-query';

import { QueryState } from '@/components/wakaclock/query-state';
import { listOrganizationTeams } from '@/lib/wakaclock/endpoints-v2';
import { getGithubConnection } from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getCurrentToken } from '@/lib/wakaclock/session';
import {
  exportTeamWeeklySummary,
  getTeamWeeklySummary,
} from '@/lib/wakaclock/team-summary-endpoints';
import type { TeamSummaryQuery } from '@/lib/wakaclock/team-summary-types';
import { closedWeeks } from '@/lib/wakaclock/team-weeks';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

function SummaryResult({ org, query }: { org: string; query: TeamSummaryQuery }) {
  const token = useWakaclockUserStore((s) => s.token);
  const user = useWakaclockUserStore((s) => s.userId) ?? '';
  const [cursor, setCursor] = React.useState<string>();
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState(false);
  const controller = React.useRef<AbortController | null>(null);
  React.useLayoutEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    []
  );
  const report = useQuery({
    queryKey: [user, org, 'weekly-summary', query, cursor],
    queryFn: () => getTeamWeeklySummary(org, { ...query, actions_after: cursor }),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const data = !report.isError && !report.isFetching && !exportError ? report.data : undefined;
  // A new read, failed projection, or action page invalidates a pending export
  // even when the signed-in account is unchanged.
  React.useLayoutEffect(() => {
    controller.current?.abort();
  }, [cursor, report.isError, report.isFetching, report.data]);
  async function download() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setExporting(true);
    setExportError(false);
    try {
      const csv = await exportTeamWeeklySummary(org, query, request.signal);
      if (request.signal.aborted || getCurrentToken() !== token) return;
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'atoaxis-team-weekly-summary.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      if (!request.signal.aborted) setExportError(true);
    } finally {
      if (controller.current === request) setExporting(false);
    }
  }
  return (
    <QueryState error={report.error} isLoading={report.isLoading}>
      {exportError && (
        <div>
          <p role="alert">
            Export unavailable or changed; previous report hidden. Reload and try again.
          </p>
          <button
            onClick={() => {
              setExportError(false);
              void report.refetch();
            }}
          >
            Reload weekly summary
          </button>
        </div>
      )}
      {data && (
        <div className="space-y-3">
          <p>
            {data.week_start} · {data.timezone} · {data.data_status}
          </p>
          <p>
            Updated: {data.checked_at}. Measurement health:{' '}
            {data.measurement_health.join(', ') || 'unconfirmed'}.
          </p>
          <div className="overflow-auto">
            <table>
              <caption>Admitted weekly metrics; unavailable values are not zero</caption>
              <thead>
                <tr>
                  <th>Metric / scope</th>
                  <th>Value / unit</th>
                  <th>Status / coverage</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {data.cells.map((c) => (
                  <tr key={`${c.metric}:${c.dimension}`}>
                    <td>
                      {c.metric} · {c.dimension}
                    </td>
                    <td>
                      {c.value ?? 'Unavailable'} · {c.unit}
                    </td>
                    <td>
                      {c.status} ·{' '}
                      {c.coverage === null ? 'Unconfirmed' : `${(c.coverage * 100).toFixed(1)}%`}
                      {c.reason && ` · ${c.reason}`}
                    </td>
                    <td>
                      {c.provenance} · {c.updated_at ?? 'freshness unconfirmed'} ·{' '}
                      {c.calculation_version}
                      {c.provider_definition_version && ` · ${c.provider_definition_version}`}
                      {c.unit === 'micro_usd' &&
                        ` · pricing ${c.pricing_versions.length > 0 ? c.pricing_versions.join(', ') : 'unconfirmed'}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h5>Improvement actions · current metadata</h5>
          <p>
            Status observed at {data.action_snapshot_at ?? 'unconfirmed'}; this is not historical
            task status for the report week.
          </p>
          <ul>
            {data.actions.map((a) => (
              <li key={a.id}>
                {a.title} · {a.status} · owner {a.owner_id} · revision {a.revision}
              </li>
            ))}
          </ul>
          {data.actions.length === 0 && <p>No matching actions on this page.</p>}
          {cursor && <button onClick={() => setCursor(undefined)}>First action page</button>}
          {data.actions_next_cursor && (
            <button onClick={() => setCursor(data.actions_next_cursor ?? undefined)}>
              Next action page
            </button>
          )}
          <button disabled={exporting} onClick={() => void download()}>
            Export full weekly summary CSV
          </button>
          <p>
            CSV includes all matching actions and uses the same privacy decision. No personal
            ranking or causal conclusion is produced.
          </p>
        </div>
      )}
    </QueryState>
  );
}

export function TeamSummaryPanel({
  organizationId,
  organizationTimezone,
}: {
  organizationId: string;
  organizationTimezone: string;
}) {
  const user = useWakaclockUserStore((s) => s.userId) ?? '';
  const [family, setFamily] = React.useState<TeamSummaryQuery['family']>('team_cost');
  const timezone = family === 'copilot' ? 'UTC' : organizationTimezone;
  const weeks = closedWeeks(timezone);
  const [selected, setSelected] = React.useState('');
  const week = weeks.find((w) => w.start === selected)?.start ?? weeks[0]?.start;
  const [team, setTeam] = React.useState('');
  const sharing = useIsMutating({ mutationKey: ['team-sharing', user, organizationId] });
  const connection = useQuery({
    queryKey: wakaclockKeys.teamGithub(user, organizationId),
    queryFn: () => getGithubConnection(organizationId),
    enabled: Boolean(user),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const teams = useQuery({
    queryKey: wakaclockKeys.organizationTeams(user, organizationId),
    queryFn: () => listOrganizationTeams(organizationId),
    enabled: Boolean(user),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const canRead = Boolean(
    user &&
    !sharing &&
    !connection.isError &&
    !connection.isFetching &&
    connection.data &&
    (family !== 'copilot' ||
      (connection.data.copilot_weekly_reports &&
        connection.data.copilot_daily?.configuration?.enabled)) &&
    (team
      ? !teams.isError && !teams.isFetching && teams.data?.some((t) => t.id === team)
      : connection.data.can_manage)
  );
  return (
    <section aria-label="Team weekly summary" className="space-y-3 rounded border p-3">
      <h4>Weekly summary</h4>
      <p>
        Completed weeks only. Copilot counters use Monday–Sunday UTC separately from organization
        cost reports. Data health and metric coverage are separate.
      </p>
      <label>
        Report family{' '}
        <select
          aria-label="Summary family"
          onChange={(e) => setFamily(e.target.value as typeof family)}
          value={family}
        >
          <option value="team_cost">Estimated AI cost</option>
          <option value="copilot">Copilot provider counters · UTC</option>
        </select>
      </label>{' '}
      <label>
        Scope{' '}
        <select aria-label="Summary team" onChange={(e) => setTeam(e.target.value)} value={team}>
          <option disabled={!connection.data?.can_manage} value="">
            {connection.data?.can_manage ? 'Organization' : 'Select your team'}
          </option>
          {!teams.isError &&
            teams.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </label>{' '}
      <label>
        Completed week{' '}
        <select
          aria-label="Summary week"
          onChange={(e) => setSelected(e.target.value)}
          value={week}
        >
          {weeks.map((w) => (
            <option key={w.start} value={w.start}>
              {w.start}–{w.end} · {timezone}
            </option>
          ))}
        </select>
      </label>
      {(connection.isError || teams.isError) && (
        <p role="alert">Current scope unavailable. Previous report hidden.</p>
      )}
      {canRead && week && (
        <SummaryResult
          key={`${user}:${organizationId}:${family}:${timezone}:${week}:${team}`}
          org={organizationId}
          query={{ family, timezone, week_start: week, team_id: team || undefined }}
        />
      )}
      {!canRead && <p>Current scope or provider evidence is not ready.</p>}
    </section>
  );
}
