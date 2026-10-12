'use client';
import * as React from 'react';

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { listOrganizationTeams } from '@/lib/wakaclock/endpoints-v2';
import * as github from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function closedUtcWeeks(now = new Date()): string[] {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7) - 7);
  return Array.from({ length: 51 }, (_, i) => {
    const start = new Date(day);
    start.setUTCDate(start.getUTCDate() - i * 7);
    return start.toISOString().slice(0, 10);
  });
}
export function CopilotWeeklyPanel({
  organizationId,
  connection,
}: {
  connection: github.GithubConnection;
  organizationId: string;
}) {
  const user = useWakaclockUserStore((s) => s.userId) ?? '';
  const weeks = closedUtcWeeks();
  const [week, setWeek] = React.useState(weeks[0]);
  const [team, setTeam] = React.useState('');
  const allowed = Boolean(
    user && connection.copilot_weekly_reports && connection.copilot_daily?.configuration?.enabled
  );
  const teams = useQuery({
    queryKey: wakaclockKeys.organizationTeams(user, organizationId),
    queryFn: () => listOrganizationTeams(organizationId),
    enabled: allowed,
    gcTime: 0,
    retry: false,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const scopeAuthorized =
    allowed &&
    (team
      ? !teams.isError && !teams.isFetching && Boolean(teams.data?.some((t) => t.id === team))
      : connection.can_manage);
  const report = useQuery({
    queryKey: wakaclockKeys.copilotWeekly(user, organizationId, week, team || undefined),
    queryFn: () => github.getCopilotWeeklyReport(organizationId, week, team || undefined),
    enabled: scopeAuthorized,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 30_000,
  });
  const data = scopeAuthorized && !report.isError && !report.isFetching ? report.data : undefined;
  const scope = `${user}:${organizationId}:${week}:${team}:${data?.generation}:${data?.source_revision}:${data?.publication_id}`;
  const live = React.useRef<null | string>(null);
  live.current = data && connection.copilot_weekly_csv ? scope : null;
  React.useEffect(
    () => () => {
      live.current = null;
    },
    []
  );
  React.useEffect(() => {
    if (!data) return;
    const key = `copilot-weekly-health:${user}:${organizationId}:${team}:${week}`;
    const next = `${data.status}:${data.ingestion_status}`;
    const previous = sessionStorage.getItem(key);
    if (previous && previous !== next) toast(`Copilot report: ${data.status}`);
    sessionStorage.setItem(key, next);
  }, [data, user, organizationId, team, week]);
  const download = useMutation({
    mutationFn: async () => ({
      scope,
      csv: await github.exportCopilotWeeklyReport(organizationId, week, team || undefined),
    }),
    onSuccess: ({ scope: captured, csv }) => {
      if (live.current !== captured) return;
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'atoaxis-copilot-weekly.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
  return (
    <section aria-label="Copilot weekly Team report" className="space-y-3 rounded border p-3">
      <h4>Copilot Team report · Monday–Sunday UTC</h4>
      <p>Copilot provider days stay in UTC. Other organization reports keep their own timezone.</p>
      <label>
        Closed UTC week{' '}
        <select
          aria-label="Copilot UTC week"
          onChange={(e) => setWeek(e.target.value)}
          value={week}
        >
          {weeks.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        Scope{' '}
        <select
          aria-label="Copilot report team"
          onChange={(e) => setTeam(e.target.value)}
          value={team}
        >
          <option disabled={!connection.can_manage} value="">
            {connection.can_manage ? 'Organization' : 'Select your team'}
          </option>
          {!teams.isError &&
            teams.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </label>
      {teams.isError && <p role="alert">Could not load team permissions. Refresh and retry.</p>}
      {!allowed && <p>Weekly report disabled or provider integration unavailable.</p>}
      <QueryState error={report.error} isLoading={report.isLoading}>
        {data && (
          <>
            <p role="status">
              Report: {data.status} · provider reports: {data.ingestion_status} · capture:{' '}
              {data.capture_status}
            </p>
            <p>
              {data.window_start}–{data.window_end} (exclusive) · UTC. Organization timezone:{' '}
              {data.organization_timezone}.
            </p>
            <p>
              Observed counters only. Missing data is not zero. Small groups and unsafe
              complementary totals are withheld.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption>Copilot feature counters; no session, PR or cost allocation</caption>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Counter</th>
                    <th>Observed value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cells.map((c) => (
                    <tr key={`${c.feature}:${c.counter}`}>
                      <td>{c.feature === 'all_features' ? 'All features' : c.feature}</td>
                      <td>{c.counter}</td>
                      <td>{c.value === null ? c.status : c.value.toLocaleString('en-US')}</td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Source: {data.provenance} · updated {data.updated_at ?? 'unconfirmed'} · calculation{' '}
              {data.calculation_version}.
            </p>
            <Button
              disabled={!connection.copilot_weekly_csv || download.isPending}
              onClick={() => download.mutate()}
            >
              Export Copilot weekly CSV
            </Button>
          </>
        )}
      </QueryState>
      {download.isError && <p role="alert">Export unavailable. Reload the report and retry.</p>}
    </section>
  );
}
