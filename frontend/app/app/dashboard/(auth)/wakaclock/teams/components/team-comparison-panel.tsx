'use client';
import * as React from 'react';

import { useIsMutating, useQuery } from '@tanstack/react-query';

import { QueryState } from '@/components/wakaclock/query-state';
import { listOrganizationTeams } from '@/lib/wakaclock/endpoints-v2';
import { getGithubConnection } from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getTeamWeeklyComparison } from '@/lib/wakaclock/team-endpoints';
import { closedWeeks } from '@/lib/wakaclock/team-weeks';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

function pricingLabel(value: boolean | null) {
  if (value === null) return 'unconfirmed / not applicable';
  if (value) return 'catalog changed';
  return 'same observed catalog';
}

export function TeamComparisonPanel({
  organizationId,
  organizationTimezone,
}: {
  organizationId: string;
  organizationTimezone: string;
}) {
  const user = useWakaclockUserStore((s) => s.userId) ?? '';
  const [family, setFamily] = React.useState<'copilot' | 'team_cost'>('team_cost');
  const timezone = family === 'copilot' ? 'UTC' : organizationTimezone;
  const weeks = closedWeeks(timezone);
  const [selectedFollowup, setFollowup] = React.useState('');
  const followup = weeks.find((w) => w.start === selectedFollowup)?.start ?? weeks[0]?.start;
  const baselineOptions = weeks.filter((w) => w.start < followup);
  const [selectedBaseline, setBaseline] = React.useState('');
  const baseline =
    baselineOptions.find((w) => w.start === selectedBaseline)?.start ?? baselineOptions[0]?.start;
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
  const report = useQuery({
    queryKey: [
      ...wakaclockKeys.teamGithub(user, organizationId),
      'weekly-comparison',
      family,
      timezone,
      baseline,
      followup,
      team,
    ],
    queryFn: () =>
      getTeamWeeklyComparison(
        organizationId,
        family,
        baseline,
        followup,
        timezone,
        team || undefined
      ),
    enabled: canRead && Boolean(baseline && followup),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const data = canRead && !report.isError && !report.isFetching ? report.data : undefined;
  return (
    <section aria-label="Team before and after" className="space-y-3 rounded border p-3">
      <h4>Before / after · admitted weekly reports</h4>
      <p>
        Descriptive changes do not establish that AI or an employee caused the result. Coverage may
        change between weeks.
      </p>
      <label>
        Report family{' '}
        <select
          aria-label="Comparison family"
          onChange={(e) => setFamily(e.target.value as typeof family)}
          value={family}
        >
          <option value="team_cost">Estimated AI cost</option>
          <option value="copilot">Copilot provider counters · UTC</option>
        </select>
      </label>{' '}
      <label>
        Scope{' '}
        <select aria-label="Comparison team" onChange={(e) => setTeam(e.target.value)} value={team}>
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
        Baseline{' '}
        <select
          aria-label="Comparison baseline"
          onChange={(e) => setBaseline(e.target.value)}
          value={baseline}
        >
          {baselineOptions.map((w) => (
            <option key={w.start} value={w.start}>
              {w.start}–{w.end}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        Follow-up{' '}
        <select
          aria-label="Comparison followup"
          onChange={(e) => setFollowup(e.target.value)}
          value={followup}
        >
          {weeks.map((w) => (
            <option key={w.start} value={w.start}>
              {w.start}–{w.end}
            </option>
          ))}
        </select>
      </label>
      <p>
        Timezone: {timezone}. Comparisons keep nullable values and the same privacy decision as
        their source reports.
      </p>
      {(connection.isError || teams.isError) && (
        <p role="alert">Could not verify current scope. Reload before viewing comparisons.</p>
      )}
      <QueryState error={report.error} isLoading={report.isLoading}>
        {data && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption>
                  {data.baseline.week_start} → {data.followup.week_start} · {timezone}
                </caption>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Baseline</th>
                    <th>Follow-up</th>
                    <th>Difference</th>
                    <th>Change</th>
                    <th>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {data.changes.map((c) => (
                    <tr key={c.metric}>
                      <td>
                        {c.metric} · {c.unit}
                      </td>
                      <td>{c.baseline_value ?? 'Unavailable'}</td>
                      <td>{c.followup_value ?? 'Unavailable'}</td>
                      <td>{c.difference ?? c.reason}</td>
                      <td>
                        {c.percent_change === null
                          ? 'Unavailable'
                          : `${c.percent_change.toFixed(1)}%`}
                      </td>
                      <td>
                        {c.baseline_coverage ?? 'Unconfirmed'} →{' '}
                        {c.followup_coverage ?? 'Unconfirmed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Calculation: {data.calculation_version}. Pricing comparison:{' '}
              {pricingLabel(data.pricing_changed)}.
            </p>
            <p>
              Baseline health: {data.baseline.measurement_health.join(', ')}. Follow-up health:{' '}
              {data.followup.measurement_health.join(', ')}.
            </p>
          </>
        )}
      </QueryState>
    </section>
  );
}
