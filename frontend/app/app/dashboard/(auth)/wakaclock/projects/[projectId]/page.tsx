'use client';

import * as React from 'react';

import { type InfiniteData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { ChartContainer } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { InspectorLayout, MetricStrip, Widget } from '@/components/wakaclock/workspace';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import {
  getProjectAnalyticsBranches,
  getProjectAnalyticsDetail,
  getProjectAnalyticsFiles,
} from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { ProjectBranchesResponse, ProjectFilesResponse } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const chartConfig = {
  ai_inferred_added: { color: 'var(--chart-3)', label: 'AI inferred additions' },
  ai_inferred_deleted: { color: 'var(--chart-3)', label: 'AI inferred deletions' },
  ai_verified_added: { color: 'var(--chart-1)', label: 'AI verified additions' },
  ai_verified_deleted: { color: 'var(--chart-1)', label: 'AI verified deletions' },
  human_added: { color: 'var(--chart-2)', label: 'Human additions' },
  human_deleted: { color: 'var(--chart-2)', label: 'Human deletions' },
  total_seconds: { color: 'var(--chart-1)', label: 'Active time' },
  unknown_added: { color: 'var(--chart-4)', label: 'Unknown additions' },
  unknown_deleted: { color: 'var(--chart-4)', label: 'Unknown deletions' },
} satisfies ChartConfig;

function percentage(value: null | number) {
  return value === null ? 'Unavailable' : `${value.toFixed(1)}%`;
}

function count(value: null | number) {
  return value === null ? 'Unavailable' : value.toLocaleString();
}

function spend(value: null | number) {
  return value === null ? 'Unavailable' : `$${(value / 1_000_000).toFixed(2)}`;
}

function DetailPanel() {
  const { projectId } = useParams<{ projectId: string }>();
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const { start, end } = useWakaclockRange(30);
  const [branch, setBranch] = React.useState('all');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const detailQuery = useQuery({
    enabled: Boolean(userId && projectId),
    queryFn: () => getProjectAnalyticsDetail(projectId, { branch, end, start, timezone }),
    queryKey: wakaclockKeys.projectAnalyticsDetail(userId, projectId, start, end, timezone, branch),
  });
  const branchesQuery = useInfiniteQuery<
    ProjectBranchesResponse,
    Error,
    InfiniteData<ProjectBranchesResponse>,
    readonly unknown[],
    string | undefined
  >({
    enabled: Boolean(userId && projectId),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getProjectAnalyticsBranches(projectId, {
        cursor: pageParam ?? undefined,
        end,
        limit: 100,
        start,
        timezone,
      }),
    queryKey: [
      ...wakaclockKeys.projectAnalyticsDetail(userId, projectId, start, end, timezone, branch),
      'branches',
    ],
  });
  const filesQuery = useInfiniteQuery<
    ProjectFilesResponse,
    Error,
    InfiniteData<ProjectFilesResponse>,
    readonly unknown[],
    string | undefined
  >({
    enabled: Boolean(userId && projectId),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getProjectAnalyticsFiles(projectId, {
        branch,
        cursor: pageParam ?? undefined,
        end,
        limit: 100,
        min_seconds: 0,
        order: 'desc',
        sort: 'duration',
        start,
        timezone,
      }),
    queryKey: [
      ...wakaclockKeys.projectAnalyticsDetail(userId, projectId, start, end, timezone, branch),
      'files',
    ],
  });
  const error = detailQuery.error ?? branchesQuery.error ?? filesQuery.error;
  const isLoading = detailQuery.isLoading || branchesQuery.isLoading || filesQuery.isLoading;
  const detail = detailQuery.data;
  const branchItems = branchesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const filePages = filesQuery.data?.pages ?? [];
  const files = filePages[0];
  const fileItems = filePages.flatMap((page) => page.items);

  return (
    <QueryState
      emptyDescription="This project has no activity in the selected range."
      error={error}
      isEmpty={!isLoading && !error && detail?.summary.project_seconds === 0}
      isLoading={isLoading}
      skeletonClassName="h-96 w-full"
    >
      {detail && files && (
        <InspectorLayout
          inspector={
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-display truncate text-lg font-semibold tracking-tight">
                  {detail.project.name}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {detail.project.repository ?? 'Repository not available'}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-muted-foreground text-xs font-medium"
                  htmlFor="branch-filter"
                >
                  Branch
                </label>
                <select
                  className="bg-background h-9 w-full rounded-md border px-2 text-sm"
                  id="branch-filter"
                  onChange={(event) => setBranch(event.target.value)}
                  value={branch}
                >
                  <option value="all">All branches</option>
                  {(branchItems.length > 0 ? branchItems : detail.branches).map((item) => (
                    <option key={item.branch} value={item.branch}>
                      {item.branch}
                    </option>
                  ))}
                </select>
              </div>
              <dl className="divide-y border-t">
                {detail.summary.comparable_seconds !== undefined && (
                  <>
                    <Metric
                      label="Editor-only activity"
                      value={formatDurationShort(detail.summary.comparable_seconds)}
                    />
                    <Metric
                      label="Additional measured AI time"
                      value={formatDurationShort(detail.summary.ai_additional_seconds ?? 0)}
                    />
                  </>
                )}
                <Metric
                  label="AI verified lines"
                  value={detail.ai.ai_verified_lines.toLocaleString()}
                />
                <Metric
                  label="AI inferred lines"
                  value={detail.ai.ai_inferred_lines.toLocaleString()}
                />
                <Metric
                  label="Unknown lines"
                  value={(detail.ai.unknown_lines ?? 0).toLocaleString()}
                />
                <Metric label="Prompts" value={count(detail.ai.prompts)} />
                <Metric label="AI sessions" value={count(detail.ai.sessions)} />
                <Metric label="Reported tokens" value={count(detail.ai.tokens.total)} />
                <Metric
                  label="Estimated spend"
                  value={spend(detail.ai.estimated_spend.amount_microusd)}
                />
              </dl>
            </div>
          }
          inspectorTitle="Properties"
        >
          <MetricStrip
            aria-label="Project summary"
            metrics={[
              {
                label: 'Project time',
                value: formatDurationShort(detail.summary.project_seconds),
              },
              { label: 'Active days', value: detail.summary.active_days.toLocaleString() },
              { label: 'AI attribution', value: percentage(detail.ai.ai_percentage) },
              {
                label: 'Attribution coverage',
                value: percentage(detail.ai.attribution_coverage_percent),
              },
            ]}
          />
          <div className="grid gap-5 2xl:grid-cols-[2fr_1fr]">
            <Widget
              description="Lines added and deleted per day, by attribution."
              title="Daily activity"
            >
              <ChartContainer className="h-72 w-full" config={chartConfig}>
                <BarChart data={detail.daily_activity} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} tickMargin={8} />
                  <YAxis tickFormatter={formatDurationShort} tickLine={false} tickMargin={8} />
                  <Tooltip formatter={(value) => formatDurationShort(Number(value))} />
                  <Bar
                    dataKey="ai_verified_added"
                    fill="var(--color-ai_verified_added)"
                    stackId="changes"
                  />
                  <Bar
                    dataKey="ai_inferred_added"
                    fill="var(--color-ai_inferred_added)"
                    stackId="changes"
                  />
                  <Bar dataKey="human_added" fill="var(--color-human_added)" stackId="changes" />
                  <Bar
                    dataKey="unknown_added"
                    fill="var(--color-unknown_added)"
                    stackId="changes"
                  />
                  <Bar
                    dataKey="ai_verified_deleted"
                    fill="var(--color-ai_verified_deleted)"
                    stackId="deletions"
                  />
                  <Bar
                    dataKey="ai_inferred_deleted"
                    fill="var(--color-ai_inferred_deleted)"
                    stackId="deletions"
                  />
                  <Bar
                    dataKey="human_deleted"
                    fill="var(--color-human_deleted)"
                    stackId="deletions"
                  />
                  <Bar
                    dataKey="unknown_deleted"
                    fill="var(--color-unknown_deleted)"
                    stackId="deletions"
                  />
                </BarChart>
              </ChartContainer>
            </Widget>
            <Widget description="Select a branch to filter the page." title="Branches">
              <div className="flex flex-col">
                {(branchItems.length > 0 ? branchItems : detail.branches)
                  .slice(0, 8)
                  .map((item) => (
                    <button
                      aria-pressed={branch === item.branch}
                      className="hover:bg-accent aria-pressed:bg-accent aria-pressed:text-foreground -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors"
                      key={item.branch}
                      onClick={() => setBranch(item.branch)}
                      type="button"
                    >
                      <span className="truncate">{item.branch}</span>
                      <span className="text-muted-foreground shrink-0">
                        {formatDurationShort(item.total_seconds)}
                      </span>
                    </button>
                  ))}
                {branchesQuery.hasNextPage && (
                  <Button
                    disabled={branchesQuery.isFetchingNextPage}
                    onClick={() => void branchesQuery.fetchNextPage()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {branchesQuery.isFetchingNextPage ? 'Loading…' : 'Load more branches'}
                  </Button>
                )}
              </div>
            </Widget>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Breakdown items={detail.languages} title="Languages" />
            <Breakdown items={detail.editors} title="Editors" />
          </div>

          <Widget
            description={
              <>
                Bubble size and list time use the same sanitized, paginated source.{' '}
                {files.other_seconds > 0 &&
                  `${formatDurationShort(files.other_seconds)} is outside this page.`}
              </>
            }
            title="Files"
          >
            <div className="flex flex-col gap-5">
              <div aria-label="File activity bubbles" className="flex flex-wrap items-end gap-2">
                {fileItems.slice(0, 24).map((file) => {
                  const size = Math.max(40, Math.min(116, Math.sqrt(file.total_seconds) * 1.5));
                  return (
                    <div
                      className="bg-primary/15 text-primary flex items-center justify-center rounded-full p-2 text-center text-xs"
                      key={file.entity_key}
                      style={{ height: size, width: size }}
                      title={`${file.path}: ${formatDurationShort(file.total_seconds)}`}
                    >
                      <span className="line-clamp-2 break-all">{file.display_name}</span>
                    </div>
                  );
                })}
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-left">
                    <tr>
                      <th className="p-3 font-medium">Path</th>
                      <th className="p-3 font-medium">Language</th>
                      <th className="p-3 text-right font-medium">Time</th>
                      <th className="p-3 text-right font-medium">AI changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileItems.map((file) => (
                      <tr className="border-t" key={file.entity_key}>
                        <td className="max-w-96 truncate p-3 font-mono text-xs" title={file.path}>
                          {file.path}
                        </td>
                        <td className="p-3">{file.language}</td>
                        <td className="p-3 text-right">
                          {formatDurationShort(file.total_seconds)}
                        </td>
                        <td className="p-3 text-right">{file.ai_changes.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filesQuery.hasNextPage && (
                <Button
                  disabled={filesQuery.isFetchingNextPage}
                  onClick={() => void filesQuery.fetchNextPage()}
                  type="button"
                  variant="outline"
                >
                  {filesQuery.isFetchingNextPage ? 'Loading…' : 'Load more files'}
                </Button>
              )}
            </div>
          </Widget>
        </InspectorLayout>
      )}
    </QueryState>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Breakdown({
  items,
  title,
}: {
  items: Array<{ name: string; percentage: number; total_seconds: number }>;
  title: string;
}) {
  return (
    <Widget title={title}>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span>{item.name}</span>
              <span className="text-muted-foreground">
                {formatDurationShort(item.total_seconds)} · {item.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary h-full" style={{ width: `${item.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Widget>
  );
}

/** The page's range, in the toolbar; the detail panel reads the same URL range. */
function ProjectRange() {
  const { start, end, setRange } = useWakaclockRange(30);
  return <RangePicker onChange={setRange} value={{ start, end }} />;
}

export default function ProjectAnalyticsPage() {
  return (
    <div className="flex flex-col gap-5">
      <WakaclockPageHeader
        actions={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/wakaclock/projects">← Projects</Link>
            </Button>
            <ProjectRange />
          </>
        }
        description="Project activity with explicit attribution coverage and privacy-safe file paths."
        title="Project analytics"
      />
      <RequireUser>
        <DetailPanel />
      </RequireUser>
    </div>
  );
}
