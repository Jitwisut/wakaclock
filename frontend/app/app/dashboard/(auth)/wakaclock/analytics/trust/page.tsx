'use client';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsNav } from '@/components/wakaclock/analytics/analytics-nav';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getBrowserTimezone } from '@/lib/wakaclock/endpoints';
import { getMeasurementQuality, getOperationEvidence } from '@/lib/wakaclock/endpoints-v2';
import { formatDurationShort, formatPercent } from '@/lib/wakaclock/format';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export default function MeasurementTrustPage() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(7);
  const timezone = getBrowserTimezone() ?? 'UTC';
  const report = useQuery({
    enabled: Boolean(userId),
    queryKey: ['measurement-quality', userId, start, end, timezone],
    queryFn: () => getMeasurementQuality(start, end, timezone),
  });
  const evidence = useQuery({
    enabled: Boolean(userId),
    queryKey: ['operation-evidence', userId, start, end, timezone],
    queryFn: () => getOperationEvidence(start, end, timezone),
  });
  const { data } = report;
  const lineCoverage = data?.attribution_coverage.line_coverage_percent;

  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        actions={<RangePicker onChange={setRange} value={{ start, end }} />}
        description="See which totals come from observed activity, which include bridged time, and where evidence is unavailable."
        title="Measurement Trust"
      />
      <RequireUser>
        <AnalyticsNav href={(path) => `${path}?start=${start}&end=${end}`} />
        <QueryState error={report.error} isLoading={report.isLoading}>
          {data && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Reported coding time</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {formatDurationShort(data.total_seconds)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Observed evidence</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {formatDurationShort(data.proven_seconds)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Time bridged between observations</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {formatDurationShort(data.inferred_seconds)}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>How to read these numbers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    Calculation: {data.calculation_version}; idle timeout:{' '}
                    {Math.round(data.timeout_seconds)} seconds; timezone: {data.timezone}.
                  </p>
                  <p>
                    Reported time joins nearby evidence. Bridged time is an estimate between
                    observations, not directly measured work.
                  </p>
                  <p>
                    AI/human line attribution:{' '}
                    {lineCoverage == null ? 'unavailable' : formatPercent(lineCoverage)} coverage (
                    {data.attribution_coverage.attributed_line_changes} of{' '}
                    {data.attribution_coverage.line_change_denominator} measured line changes).
                  </p>
                  <p>
                    AI attribution uses stored heartbeat dates. Its date boundary may differ from
                    this display timezone. This percentage describes captured events, not capture
                    recall.
                  </p>
                  <p>
                    Local delivery queue status: unavailable from this server read. An empty day
                    does not prove you were idle.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Evidence by day</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2">Date</th>
                        <th>Reported</th>
                        <th>Observed</th>
                        <th>Bridged</th>
                        <th>Active coverage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.days.map((day) => (
                        <tr className="border-b" key={day.date}>
                          <th className="py-2 text-left font-medium" scope="row">
                            {day.date}
                          </th>
                          <td>{formatDurationShort(day.total_seconds)}</td>
                          <td>{formatDurationShort(day.proven_seconds)}</td>
                          <td>{formatDurationShort(day.inferred_seconds)}</td>
                          <td>{day.active_coverage ?? 'unavailable'}</td>
                          <td>
                            {day.status === 'no_observation'
                              ? 'No observation; cause unknown'
                              : `${day.heartbeat_count} heartbeats`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>AI operation receipts</CardTitle>
                </CardHeader>
                <CardContent>
                  <QueryState error={evidence.error} isLoading={evidence.isLoading}>
                    <div className="space-y-3 text-sm">
                      {evidence.data?.operations.length === 0 && (
                        <p>No AI operation evidence recorded for this range.</p>
                      )}
                      {evidence.data?.operations.map((operation) => (
                        <div className="rounded-md border p-3" key={operation.event_id}>
                          <div className="flex flex-wrap justify-between gap-2">
                            <span className="font-medium">
                              {operation.actor === 'ai_verified'
                                ? `${operation.agent ?? 'AI'} · ${operation.model ?? 'model unavailable'}`
                                : 'Identity unverified'}
                            </span>
                            <time dateTime={new Date(operation.occurred_at * 1000).toISOString()}>
                              {new Date(operation.occurred_at * 1000).toLocaleString()}
                            </time>
                          </div>
                          <p className="text-muted-foreground mt-1">
                            Evidence {operation.event_id.slice(0, 12)} ·{' '}
                            {operation.identity_source ?? 'source unavailable'} ·{' '}
                            {operation.identity_reason ?? 'no reported identity issue'}
                          </p>
                          <p className="mt-1">
                            Line changes:{' '}
                            {operation.lines_added == null || operation.lines_deleted == null
                              ? 'unavailable'
                              : `+${operation.lines_added} / -${operation.lines_deleted}`}
                          </p>
                        </div>
                      ))}
                      {evidence.data?.has_more && (
                        <p>
                          Showing the latest 100 operations. Narrow the date range to inspect
                          earlier events.
                        </p>
                      )}
                    </div>
                  </QueryState>
                </CardContent>
              </Card>
            </div>
          )}
        </QueryState>
      </RequireUser>
    </div>
  );
}
