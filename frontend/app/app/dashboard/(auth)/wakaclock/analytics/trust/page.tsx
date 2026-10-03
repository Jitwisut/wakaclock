'use client';

import { useState } from 'react';

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsNav } from '@/components/wakaclock/analytics/analytics-nav';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getBrowserTimezone, getProjectAnalytics } from '@/lib/wakaclock/endpoints';
import {
  applyMeasurementRepair,
  getDeliveryStatus,
  getMeasurementQuality,
  getOperationEvidence,
  listMeasurementRepairs,
  rollbackMeasurementRepair,
  startMeasurementRepair,
} from '@/lib/wakaclock/endpoints-v2';
import { formatDurationShort, formatPercent } from '@/lib/wakaclock/format';
import type {
  MeasurementRepairCandidate,
  MeasurementRepairOutcome,
  OperationEvidencePage,
} from '@/lib/wakaclock/measurement-types';
import type { ProjectAnalyticsListResponse } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

type RepairDraft = {
  linesAdded: string;
  linesDeleted: string;
  outcome: MeasurementRepairOutcome;
  selected: boolean;
};

const REPAIR_HISTORY_KEY = 'measurement-repair-history';

function parseLineCount(value: string): null | number {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function defaultRepairDraft(operation: OperationEvidencePage['operations'][number]): RepairDraft {
  return {
    selected: false,
    outcome: 'unknown',
    linesAdded: operation.lines_added == null ? '' : String(operation.lines_added),
    linesDeleted: operation.lines_deleted == null ? '' : String(operation.lines_deleted),
  };
}

export default function MeasurementTrustPage() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const queryClient = useQueryClient();
  const { start, end, setRange } = useWakaclockRange(7);
  const timezone = getBrowserTimezone() ?? 'UTC';
  const [projectId, setProjectId] = useState('all');
  const [evidenceGeneration, setEvidenceGeneration] = useState(0);
  const [repairDrafts, setRepairDrafts] = useState<Record<string, RepairDraft>>({});
  const [activeRepairId, setActiveRepairId] = useState('');
  const projects = useInfiniteQuery<
    ProjectAnalyticsListResponse,
    Error,
    InfiniteData<ProjectAnalyticsListResponse>,
    readonly unknown[],
    string | undefined
  >({
    enabled: Boolean(userId),
    queryKey: ['trust-project-options', userId, start, end, timezone],
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    queryFn: ({ pageParam }) =>
      getProjectAnalytics({ start, end, timezone, limit: 100, cursor: pageParam }),
  });
  const report = useQuery({
    enabled: Boolean(userId),
    queryKey: ['measurement-quality', userId, start, end, timezone, projectId],
    queryFn: () =>
      getMeasurementQuality(start, end, timezone, projectId === 'all' ? undefined : projectId),
  });
  const delivery = useQuery({
    enabled: Boolean(userId),
    queryKey: ['delivery-status', userId],
    queryFn: getDeliveryStatus,
    refetchInterval: 60_000,
  });
  const evidence = useInfiniteQuery<
    OperationEvidencePage,
    Error,
    InfiniteData<OperationEvidencePage>,
    readonly unknown[],
    string | undefined
  >({
    enabled: Boolean(userId),
    queryKey: ['operation-evidence', userId, start, end, timezone, projectId, evidenceGeneration],
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    queryFn: ({ pageParam }) =>
      getOperationEvidence(start, end, timezone, {
        projectId: projectId === 'all' ? undefined : projectId,
        cursor: pageParam,
        limit: 100,
      }),
  });
  const repairHistory = useQuery({
    enabled: Boolean(userId),
    queryKey: [REPAIR_HISTORY_KEY, userId],
    queryFn: listMeasurementRepairs,
  });
  const createRepair = useMutation({
    mutationFn: (candidates: MeasurementRepairCandidate[]) =>
      startMeasurementRepair({
        repairId: crypto.randomUUID(),
        start,
        end,
        timezone,
        candidates,
      }),
    onSuccess: async (job) => {
      setActiveRepairId(job.repair_id);
      await queryClient.invalidateQueries({ queryKey: [REPAIR_HISTORY_KEY, userId] });
    },
  });
  const applyRepair = useMutation({
    mutationFn: applyMeasurementRepair,
    onSuccess: async (job) => {
      setActiveRepairId(job.repair_id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [REPAIR_HISTORY_KEY, userId] }),
        queryClient.invalidateQueries({ queryKey: ['measurement-quality', userId] }),
        queryClient.invalidateQueries({ queryKey: ['operation-evidence', userId] }),
      ]);
    },
  });
  const rollbackRepair = useMutation({
    mutationFn: rollbackMeasurementRepair,
    onSuccess: async (job) => {
      setActiveRepairId(job.repair_id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [REPAIR_HISTORY_KEY, userId] }),
        queryClient.invalidateQueries({ queryKey: ['measurement-quality', userId] }),
        queryClient.invalidateQueries({ queryKey: ['operation-evidence', userId] }),
      ]);
    },
  });
  const { data } = report;
  const lineCoverage = data?.attribution_coverage.line_coverage_percent;
  let deliveryMessage: string | undefined;
  if (delivery.isLoading) deliveryMessage = 'Loading delivery status…';
  else if (delivery.error) deliveryMessage = 'Delivery status is unavailable from the server.';
  else if (!delivery.data?.devices.length)
    {deliveryMessage = 'No queue snapshot has reached the server yet.';}
  const operations = evidence.data?.pages.flatMap((page) => page.operations) ?? [];
  const projectOptions = projects.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedCandidates = operations.flatMap((operation): MeasurementRepairCandidate[] => {
    const draft = repairDrafts[operation.repair_reference];
    if (!draft?.selected) return [];
    return [
      {
        repair_reference: operation.repair_reference,
        outcome: draft.outcome,
        lines_added: draft.outcome === 'failed' ? null : parseLineCount(draft.linesAdded),
        lines_deleted: draft.outcome === 'failed' ? null : parseLineCount(draft.linesDeleted),
      },
    ];
  });
  const activeRepair = repairHistory.data?.find((job) => job.repair_id === activeRepairId);

  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RangePicker onChange={setRange} value={{ start, end }} />
            <label className="text-muted-foreground text-sm" htmlFor="trust-project-filter">
              Project
            </label>
            <select
              className="bg-background h-9 rounded-md border px-2 text-sm"
              id="trust-project-filter"
              onChange={(event) => setProjectId(event.target.value)}
              value={projectId}
            >
              <option value="all">All projects</option>
              {projectOptions.map((project) => (
                <option key={project.project_id} value={project.project_id}>
                  {project.name}
                </option>
              ))}
            </select>
            {projects.hasNextPage && (
              <button
                className="h-9 rounded-md border px-2 text-sm disabled:opacity-50"
                disabled={projects.isFetchingNextPage}
                onClick={() => void projects.fetchNextPage()}
                type="button"
              >
                {projects.isFetchingNextPage ? 'Loading projects…' : 'More projects'}
              </button>
            )}
          </div>
        }
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
                    Line attribution coverage for the selected measurement definition:{' '}
                    {lineCoverage == null ? 'unavailable' : formatPercent(lineCoverage)} coverage (
                    {data.attribution_coverage.attributed_line_changes} of{' '}
                    {data.attribution_coverage.line_change_denominator} measured line changes).
                  </p>
                  <p>
                    {data.attribution_date_basis === 'stored_heartbeat_date'
                      ? 'Legacy AI attribution uses stored heartbeat dates, which may differ from this display timezone.'
                      : 'AI attribution uses heartbeat timestamps in the selected timezone.'}{' '}
                    This percentage describes captured events, not capture recall.
                  </p>
                  <div>
                    <p className="font-medium">Local delivery queues</p>
                    <p className="text-muted-foreground">
                      Queued activity is shown separately and is not added to confirmed time.
                    </p>
                    {deliveryMessage ? (
                      <p>{deliveryMessage}</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {delivery.data?.devices.map((device) => (
                          <li
                            className="rounded-md border p-3"
                            key={`${device.device_id}:${device.queue_id}`}
                          >
                            <div className="flex flex-wrap justify-between gap-2">
                              <span>
                                Device {device.device_id.slice(0, 8)} · queue{' '}
                                {device.queue_id.slice(0, 8)}
                              </span>
                              <span className="font-medium">{device.status}</span>
                            </div>
                            {device.status === 'unavailable' ? (
                              <p>Local queue could not be read; counts are unknown.</p>
                            ) : (
                              <p>
                                Pending {device.pending ?? 'unavailable'} · retry{' '}
                                {device.retry ?? 'unavailable'} · dead letter{' '}
                                {device.dead_letter ?? 'unavailable'}
                              </p>
                            )}
                            <p className="text-muted-foreground">
                              Snapshot age {Math.floor(device.age_seconds / 60)} min
                              {device.oldest_pending_at
                                ? ` · oldest pending ${new Date(device.oldest_pending_at).toLocaleString()}`
                                : ''}
                              {device.last_successful_delivery_at
                                ? ` · last accepted ${new Date(device.last_successful_delivery_at).toLocaleString()}`
                                : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Line metrics by measurement version</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {data.line_metric_coverage.length === 0 ? (
                    <p>No line metric records in this range.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[38rem] text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="py-2">Version</th>
                            <th>Status</th>
                            <th>Heartbeats</th>
                            <th>Attributed lines</th>
                            <th>Unknown lines</th>
                            <th>Coverage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.line_metric_coverage.map((metric) => (
                            <tr
                              className="border-b"
                              key={`${metric.version}:${metric.status}:${metric.reason ?? 'none'}`}
                            >
                              <th className="py-2 text-left font-medium" scope="row">
                                {metric.version}
                              </th>
                              <td>
                                {metric.status}
                                {metric.reason ? ` · ${metric.reason}` : ''}
                              </td>
                              <td>{metric.heartbeats}</td>
                              <td>{metric.ai_line_changes + metric.human_line_changes}</td>
                              <td>{metric.unknown_line_changes}</td>
                              <td>
                                {metric.line_coverage_percent == null
                                  ? 'unavailable'
                                  : formatPercent(metric.line_coverage_percent)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-muted-foreground">
                    Unversioned history stays separate. Unknown edits remain unknown, and an empty
                    line counter is not treated as a measured zero. Owner supplied repairs use a
                    separate version and do not enter editor measurement coverage.
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
                  <QueryState
                    error={evidence.data ? undefined : evidence.error}
                    isLoading={evidence.isLoading}
                  >
                    <div className="space-y-3 text-sm">
                      {operations.length === 0 && (
                        <p>No AI operation evidence recorded for this range.</p>
                      )}
                      {operations.map((operation) => (
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
                          <fieldset className="bg-muted/30 mt-3 grid gap-2 rounded-md p-3 sm:grid-cols-[auto_1fr_1fr_1fr] sm:items-end">
                            <legend className="sr-only">
                              Correct measured outcome and line counts
                            </legend>
                            <label className="flex items-center gap-2 pb-2 text-sm">
                              <input
                                checked={
                                  repairDrafts[operation.repair_reference]?.selected ?? false
                                }
                                onChange={(event) =>
                                  setRepairDrafts((drafts) => {
                                    const current =
                                      drafts[operation.repair_reference] ??
                                      defaultRepairDraft(operation);
                                    return {
                                      ...drafts,
                                      [operation.repair_reference]: {
                                        ...current,
                                        selected: event.target.checked,
                                      },
                                    };
                                  })
                                }
                                type="checkbox"
                              />
                              Include for repair preview
                            </label>
                            <label className="grid gap-1 text-sm">
                              Outcome
                              <select
                                className="bg-background h-9 rounded-md border px-2"
                                onChange={(event) =>
                                  setRepairDrafts((drafts) => {
                                    const current =
                                      drafts[operation.repair_reference] ??
                                      defaultRepairDraft(operation);
                                    return {
                                      ...drafts,
                                      [operation.repair_reference]: {
                                        ...current,
                                        selected: true,
                                        outcome: event.target.value as MeasurementRepairOutcome,
                                      },
                                    };
                                  })
                                }
                                value={
                                  repairDrafts[operation.repair_reference]?.outcome ?? 'unknown'
                                }
                              >
                                <option value="unknown">Unknown</option>
                                <option value="success">Success</option>
                                <option value="partial">Partial</option>
                                <option value="failed">Failed</option>
                              </select>
                            </label>
                            {repairDrafts[operation.repair_reference]?.outcome !== 'failed' && (
                              <>
                                <label className="grid gap-1 text-sm">
                                  Lines added
                                  <input
                                    className="bg-background h-9 rounded-md border px-2"
                                    min="0"
                                    onChange={(event) =>
                                      setRepairDrafts((drafts) => ({
                                        ...drafts,
                                        [operation.repair_reference]: {
                                          selected:
                                            drafts[operation.repair_reference]?.selected ?? true,
                                          outcome:
                                            drafts[operation.repair_reference]?.outcome ??
                                            'unknown',
                                          linesDeleted:
                                            drafts[operation.repair_reference]?.linesDeleted ?? '',
                                          linesAdded: event.target.value,
                                        },
                                      }))
                                    }
                                    type="number"
                                    value={
                                      repairDrafts[operation.repair_reference]?.linesAdded ?? ''
                                    }
                                  />
                                </label>
                                <label className="grid gap-1 text-sm">
                                  Lines deleted
                                  <input
                                    className="bg-background h-9 rounded-md border px-2"
                                    min="0"
                                    onChange={(event) =>
                                      setRepairDrafts((drafts) => ({
                                        ...drafts,
                                        [operation.repair_reference]: {
                                          selected:
                                            drafts[operation.repair_reference]?.selected ?? true,
                                          outcome:
                                            drafts[operation.repair_reference]?.outcome ??
                                            'unknown',
                                          linesAdded:
                                            drafts[operation.repair_reference]?.linesAdded ?? '',
                                          linesDeleted: event.target.value,
                                        },
                                      }))
                                    }
                                    type="number"
                                    value={
                                      repairDrafts[operation.repair_reference]?.linesDeleted ?? ''
                                    }
                                  />
                                </label>
                              </>
                            )}
                          </fieldset>
                        </div>
                      ))}
                      {evidence.hasNextPage && (
                        <button
                          className="h-9 rounded-md border px-3 font-medium disabled:opacity-50"
                          disabled={evidence.isFetchingNextPage}
                          onClick={() => void evidence.fetchNextPage()}
                          type="button"
                        >
                          {evidence.isFetchingNextPage ? 'Loading…' : 'Load more operations'}
                        </button>
                      )}
                      {evidence.error && evidence.data && (
                        <div className="space-y-2 rounded-md border border-amber-500/50 p-3">
                          <p>
                            This page could not be loaded. Its cursor may have expired; the list is
                            not complete.
                          </p>
                          <button
                            className="h-9 rounded-md border px-3 font-medium"
                            onClick={() => setEvidenceGeneration((generation) => generation + 1)}
                            type="button"
                          >
                            Restart from newest
                          </button>
                        </div>
                      )}
                    </div>
                  </QueryState>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Historical measurement repair</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-muted-foreground">
                    Select AI operation receipts, enter corrected outcome and line counts, then
                    review the server preview. Only metadata is sent; source code and diffs are not
                    included. Applying or rolling back creates an auditable revision.
                  </p>
                  <p className="text-muted-foreground">
                    To reparse local transcripts, run{' '}
                    <code className="break-all">
                      wakaclock ai repair-measurements --from YYYY-MM-DD --to YYYY-MM-DD --timezone
                      Asia/Bangkok
                    </code>{' '}
                    with the dates replaced, then refresh this page. The CLI sends only opaque
                    operation references and measured line metadata; apply the resulting preview
                    here.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="h-9 rounded-md border px-3 font-medium disabled:opacity-50"
                      disabled={selectedCandidates.length === 0 || createRepair.isPending}
                      onClick={() => createRepair.mutate(selectedCandidates)}
                      type="button"
                    >
                      {createRepair.isPending
                        ? 'Preparing preview…'
                        : `Preview ${selectedCandidates.length} selected`}
                    </button>
                    <label className="flex items-center gap-2">
                      Repair history
                      <select
                        className="bg-background h-9 rounded-md border px-2"
                        onChange={(event) => setActiveRepairId(event.target.value)}
                        value={activeRepairId}
                      >
                        <option value="">Select a repair job</option>
                        {repairHistory.data?.map((job) => (
                          <option key={job.repair_id} value={job.repair_id}>
                            {job.created_at.slice(0, 16)} · {job.status} · {job.ready} ready
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {(createRepair.error || applyRepair.error || rollbackRepair.error) && (
                    <p className="text-destructive" role="alert">
                      {(createRepair.error ?? applyRepair.error ?? rollbackRepair.error)?.message}
                    </p>
                  )}
                  {activeRepair && (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium">
                          Preview status: {activeRepair.status} · {activeRepair.ready} ready ·{' '}
                          {activeRepair.unchanged} unchanged · {activeRepair.unresolved} unresolved
                          · {activeRepair.conflict_count} conflicts
                        </span>
                        <span>
                          AI lines +{activeRepair.before_added_total ?? 'unavailable'} / -
                          {activeRepair.before_deleted_total ?? 'unavailable'} → +
                          {activeRepair.after_added_total ?? 'unavailable'} / -
                          {activeRepair.after_deleted_total ?? 'unavailable'}
                        </span>
                      </div>
                      <ul className="max-h-64 space-y-2 overflow-auto">
                        {activeRepair.items.map((item) => (
                          <li className="rounded border p-2" key={item.repair_reference}>
                            <span className="font-medium">{item.status}</span>
                            {' · '}
                            {item.repair_reference.slice(0, 12)}
                            {item.reason ? ` · ${item.reason}` : ''}
                            {item.before && item.after && (
                              <span className="text-muted-foreground ml-2">
                                ({item.before.ai_lines_added ?? 'unknown'} added →{' '}
                                {item.after.ai_lines_added ?? 'unknown'}; revision{' '}
                                {item.base_revision ?? 'unknown'} →{' '}
                                {item.applied_revision ?? 'pending'})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2">
                        {(activeRepair.status === 'preview' ||
                          activeRepair.status === 'applying') &&
                          activeRepair.ready > 0 && (
                            <button
                              className="h-9 rounded-md border px-3 font-medium disabled:opacity-50"
                              disabled={applyRepair.isPending}
                              onClick={() => applyRepair.mutate(activeRepair.repair_id)}
                              type="button"
                            >
                              {applyRepair.isPending ? 'Applying…' : 'Apply reviewed corrections'}
                            </button>
                          )}
                        {(activeRepair.status === 'applied' ||
                          activeRepair.status === 'conflict') &&
                          activeRepair.applied > activeRepair.rolled_back && (
                            <button
                              className="h-9 rounded-md border px-3 font-medium disabled:opacity-50"
                              disabled={rollbackRepair.isPending}
                              onClick={() => rollbackRepair.mutate(activeRepair.repair_id)}
                              type="button"
                            >
                              {rollbackRepair.isPending
                                ? 'Rolling back…'
                                : 'Rollback applied revisions'}
                            </button>
                          )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </QueryState>
      </RequireUser>
    </div>
  );
}
