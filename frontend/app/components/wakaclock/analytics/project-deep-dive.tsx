'use client';

import { useState } from 'react';

import { type InfiniteData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ChevronRight, FileCode2, GitBranch, RotateCcw } from 'lucide-react';

import {
  getProjectAnalyticsBranches,
  getProjectAnalyticsDetail,
  getProjectAnalyticsFiles,
} from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { normalizeProjectFiles } from '@/lib/wakaclock/project-files';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type {
  ProjectAiSummary,
  ProjectBranchesResponse,
  ProjectFileItem,
  ProjectFilesResponse,
} from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from './project-studio.module.css';

const tileColors = ['#cbdac8', '#ddd5eb', '#ecdfc8', '#c9dee1', '#e9d2c9', '#dde1bc'];
const count = (value: null | number | undefined) =>
  value == null ? 'Unavailable' : value.toLocaleString();
const percent = (value: null | number | undefined) =>
  value == null ? 'Unavailable' : `${value.toFixed(1)}%`;

export function ProjectAiPanel({ ai }: { ai: ProjectAiSummary }) {
  return (
    <section className={styles.panel}>
      <div className={styles.chartHeader}>
        <div>
          <span className={styles.kicker}>05 / THE AI COLLABORATION</span>
          <h3>A closer look at your co-pilots</h3>
          <p>Reported usage and code attribution for the selected branch and dates.</p>
        </div>
        <span className={styles.badge}>{percent(ai.attribution_coverage_percent)} coverage</span>
      </div>
      <div className={styles.aiMetrics}>
        {[
          [
            'AI sessions',
            count(ai.sessions),
            `${ai.prompts_per_session == null ? 'Unavailable' : ai.prompts_per_session.toLocaleString(undefined, { maximumFractionDigits: 1 })} prompts / session`,
          ],
          ['Prompts', count(ai.prompts), 'Recorded interactions'],
          [
            'Reported tokens',
            count(ai.tokens.total),
            `${percent(ai.tokens.coverage_percent)} coverage`,
          ],
          [
            'Estimated spend',
            ai.estimated_spend.amount_microusd == null
              ? 'Unavailable'
              : `$${(ai.estimated_spend.amount_microusd / 1_000_000).toFixed(2)}`,
            `${percent(ai.estimated_spend.coverage_percent)} coverage · USD`,
          ],
        ].map(([label, value, note]) => (
          <div className={styles.aiMetric} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className={styles.aiDetails}>
        <div>
          <span>Verified AI lines </span>
          <strong>{count(ai.ai_verified_lines)}</strong>
        </div>
        <div>
          <span>Inferred AI lines </span>
          <strong>{count(ai.ai_inferred_lines)}</strong>
        </div>
        <div>
          <span>Human lines </span>
          <strong>{count(ai.human_lines)}</strong>
        </div>
        <div>
          <span>Unknown lines </span>
          <strong>{count(ai.unknown_lines)}</strong>
        </div>
        <div>
          <span>AI attribution </span>
          <strong>{percent(ai.ai_percentage)}</strong>
        </div>
      </div>
      <details className={styles.footer}>
        <summary className="cursor-pointer">Token details & measurement notes</summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>
            Input: {count(ai.tokens.input)} · Output: {count(ai.tokens.output)} · Cache read:{' '}
            {count(ai.tokens.cache_read)} · Cache write: {count(ai.tokens.cache_write)}
          </p>
          <p>
            Line attribution measures observed code changes, not time. Inferred AI is an estimate.
            Unavailable means the source did not report a value; it does not mean zero. Spend is an
            estimate for covered usage.
          </p>
        </div>
      </details>
    </section>
  );
}

export function ProjectFilesPanel({
  files,
  totalSeconds,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  files: ProjectFileItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  totalSeconds: number;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<null | string>(null);
  const [sort, setSort] = useState('time');
  const uniqueFiles = normalizeProjectFiles(files);
  const matching = uniqueFiles.filter((file) =>
    `${file.path} ${file.display_name} ${file.language}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const filtered = matching
    .filter((file) => !selected || file.entity_key === selected)
    .sort((a, b) => {
      if (sort === 'name') return a.path.localeCompare(b.path);
      if (sort === 'ai') return b.ai_changes - a.ai_changes;
      return b.total_seconds - a.total_seconds;
    });
  const top = [...matching]
    .filter((file) => file.total_seconds > 0)
    .sort((a, b) => b.total_seconds - a.total_seconds)
    .slice(0, 12);
  // Slice-and-dice treemap: column width and tile height encode time.
  const groups = [top.slice(0, 2), top.slice(2, 6), top.slice(6, 12)].filter(
    (group) => group.length > 0
  );
  const represented = uniqueFiles.reduce((sum, file) => sum + file.total_seconds, 0);
  return (
    <section aria-label="Project files" className={styles.panel} id="project-files">
      <div className={styles.chartHeader}>
        <div>
          <span className={styles.kicker}>06 / WHERE THE WORK LIVES</span>
          <h3>Your file landscape</h3>
          <p>
            Tile area represents time in the top 12 matching files. Select a tile to inspect it.
          </p>
        </div>
        <span className={styles.badge}>
          {uniqueFiles.length}
          {hasMore ? '+' : ''} files loaded
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-5">
        <input
          aria-label="Search project files"
          className={styles.search}
          onChange={(event) => {
            setSearch(event.target.value);
            setSelected(null);
          }}
          placeholder="Search paths or languages…"
          type="search"
          value={search}
        />
        <div className={styles.controls}>
          <label htmlFor="project-file-sort">Sort loaded files</label>
          <select
            id="project-file-sort"
            onChange={(event) => setSort(event.target.value)}
            value={sort}
          >
            <option value="time">Most time</option>
            <option value="ai">Most AI changes</option>
            <option value="name">File path A–Z</option>
          </select>
          {selected && (
            <button className={styles.button} onClick={() => setSelected(null)} type="button">
              Show all files
            </button>
          )}
        </div>
      </div>
      {top.length > 0 && (
        <div aria-label="File activity map" className={styles.fileMap}>
          {groups.map((group, groupIndex) => (
            <div
              className={styles.fileMapGroup}
              key={group[0].entity_key}
              style={{ flex: group.reduce((sum, file) => sum + file.total_seconds, 0) }}
            >
              {group.map((file, index) => (
                <button
                  aria-label={`Inspect ${file.path}: ${formatDurationShort(file.total_seconds)}`}
                  aria-pressed={selected === file.entity_key}
                  className={styles.fileTile}
                  key={file.entity_key}
                  onClick={() => setSelected(selected === file.entity_key ? null : file.entity_key)}
                  style={{
                    flex: `${file.total_seconds} 1 0%`,
                    background: tileColors[(groupIndex * 2 + index) % tileColors.length],
                  }}
                  title={`${file.path} · ${formatDurationShort(file.total_seconds)}`}
                  type="button"
                >
                  <strong>{file.display_name}</strong>
                  <span>{formatDurationShort(file.total_seconds)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className={styles.tableScroll}>
        <table className={styles.fileTable}>
          <thead>
            <tr>
              <th scope="col">File / path</th>
              <th scope="col">Language</th>
              <th scope="col">Time</th>
              <th scope="col">Project share</th>
              <th scope="col">AI changes</th>
              <th scope="col">Human / unknown</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((file) => (
              <tr key={file.entity_key}>
                <td>
                  <details className={styles.fileDetails}>
                    <summary>
                      <ChevronRight
                        aria-hidden="true"
                        className={styles.disclosureIcon}
                        size={12}
                      />
                      <FileCode2 aria-hidden="true" size={13} />
                      <span className={styles.fileLabel}>
                        <span className={styles.fileName}>{file.display_name}</span>
                        {file.path !== file.display_name && (
                          <span className={styles.filePath} title={file.path}>
                            {file.path}
                          </span>
                        )}
                      </span>
                    </summary>
                    <p>
                      {file.path}
                      <br />
                      Verified AI changes: {count(file.ai_verified_changes)} · Inferred AI changes:{' '}
                      {count(file.ai_inferred_changes)}
                    </p>
                  </details>
                </td>
                <td>{file.language || 'Unknown'}</td>
                <td className="font-mono whitespace-nowrap">
                  {formatDurationShort(file.total_seconds)}
                </td>
                <td>
                  {file.percentage_of_project.toFixed(1)}%
                  <div className={styles.shareTrack}>
                    <i
                      style={{
                        width: `${Math.max(0, Math.min(100, file.percentage_of_project))}%`,
                      }}
                    />
                  </div>
                </td>
                <td
                  title={`Verified: ${file.ai_verified_changes}; inferred: ${file.ai_inferred_changes}`}
                >
                  {count(file.ai_changes)}
                </td>
                <td>
                  {count(file.human_changes)} / {count(file.unknown_changes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <p className={styles.empty}>
          {uniqueFiles.length === 0
            ? 'No file activity was recorded in this range.'
            : 'No loaded files match your search.'}
        </p>
      )}
      <div className={styles.footer}>
        <span>
          {filtered.length} shown · {formatDurationShort(represented)} across loaded files
          {totalSeconds > represented
            ? ` · ${formatDurationShort(totalSeconds - represented)} outside this list`
            : ''}
        </span>
        {hasMore && (
          <button
            className={styles.button}
            disabled={loadingMore}
            onClick={onLoadMore}
            type="button"
          >
            {loadingMore ? 'Loading…' : 'Load more files'}
          </button>
        )}
      </div>
    </section>
  );
}

export function ProjectDeepDive({
  projectId,
  start,
  end,
  timezone,
  hasExplorerFilters,
}: {
  end: string;
  hasExplorerFilters: boolean;
  projectId: string;
  start: string;
  timezone: string;
}) {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const [branch, setBranch] = useState('all');
  const enabled = Boolean(userId && projectId);
  const detail = useQuery({
    enabled,
    queryKey: wakaclockKeys.projectAnalyticsDetail(userId, projectId, start, end, timezone, branch),
    queryFn: () => getProjectAnalyticsDetail(projectId, { branch, start, end, timezone }),
  });
  const files = useInfiniteQuery<
    ProjectFilesResponse,
    Error,
    InfiniteData<ProjectFilesResponse>,
    readonly unknown[],
    string | undefined
  >({
    enabled,
    queryKey: [
      ...wakaclockKeys.projectAnalyticsDetail(userId, projectId, start, end, timezone, branch),
      'studio-files',
    ],
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page, _pages, previousCursor) =>
      page.next_cursor && page.next_cursor !== previousCursor ? page.next_cursor : undefined,
    queryFn: ({ pageParam }) =>
      getProjectAnalyticsFiles(projectId, {
        branch,
        start,
        end,
        timezone,
        cursor: pageParam,
        limit: 100,
        min_seconds: 0,
        sort: 'duration',
        order: 'desc',
      }),
  });
  const branches = useInfiniteQuery<
    ProjectBranchesResponse,
    Error,
    InfiniteData<ProjectBranchesResponse>,
    readonly unknown[],
    string | undefined
  >({
    enabled,
    queryKey: [
      ...wakaclockKeys.projectAnalyticsDetail(userId, projectId, start, end, timezone, 'all'),
      'studio-branches',
    ],
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page, _pages, previousCursor) =>
      page.next_cursor && page.next_cursor !== previousCursor ? page.next_cursor : undefined,
    queryFn: ({ pageParam }) =>
      getProjectAnalyticsBranches(projectId, {
        start,
        end,
        timezone,
        cursor: pageParam,
        limit: 100,
      }),
  });
  const branchItems =
    branches.data?.pages.flatMap((page) => page.items) ?? detail.data?.branches ?? [];
  const fileItems = files.data?.pages.flatMap((page) => page.items) ?? [];
  const branchTotal = branchItems.reduce((sum, item) => sum + item.total_seconds, 0);
  return (
    <div className={styles.studio}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>PROJECT DEEP DIVE</span>
          <h3>Beyond the overview</h3>
          <p>
            Files, branches and AI usage · {start} — {end} · {timezone}
          </p>
        </div>
        <div className={styles.controls}>
          <GitBranch size={15} />
          <label htmlFor="studio-branch">Branch</label>
          <select
            id="studio-branch"
            onChange={(event) => setBranch(event.target.value)}
            value={branch}
          >
            <option value="all">All branches</option>
            {branch !== 'all' && !branchItems.some((item) => item.branch === branch) && (
              <option value={branch}>{branch}</option>
            )}
            {branchItems
              .filter((item) => item.branch !== 'all')
              .map((item) => (
                <option key={item.branch} value={item.branch}>
                  {item.branch || 'Unknown branch'}
                </option>
              ))}
          </select>
          {branch !== 'all' && (
            <button className={styles.button} onClick={() => setBranch('all')} type="button">
              <RotateCcw size={12} />
              Reset branch
            </button>
          )}
        </div>
      </div>
      <p className={styles.scope}>
        {hasExplorerFilters ? 'Overview filters are active above. ' : ''}This section uses the
        selected dates and timezone. The branch selector applies to files and AI usage; language,
        editor, category and source filters apply only to the overview. The branch list shows all
        branches.
      </p>
      {detail.isLoading && (
        <p className={styles.empty} role="status">
          Loading project details…
        </p>
      )}
      {detail.isError && (
        <div className={styles.error} role="alert">
          Could not load AI details.{' '}
          <button className={styles.button} onClick={() => void detail.refetch()} type="button">
            Retry details
          </button>
        </div>
      )}
      {detail.data && (
        <>
          <div className={styles.footer}>
            <span>{detail.data.project.repository ?? detail.data.project.name}</span>
            <span>
              Last activity:{' '}
              {detail.data.summary.last_activity_at
                ? new Date(detail.data.summary.last_activity_at).toLocaleString('en-GB', {
                    timeZone: timezone,
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Unavailable'}
            </span>
          </div>
          <ProjectAiPanel ai={detail.data.ai} />
        </>
      )}
      <section aria-label="Project branches" className={styles.panel}>
        <div className={styles.chartHeader}>
          <div>
            <span className={styles.kicker}>BRANCH EXPLORER</span>
            <h3>Parallel paths</h3>
            <p>Select a branch to explore its files and AI usage.</p>
          </div>
          <span className={styles.badge}>
            {branchItems.length}
            {branches.hasNextPage ? '+' : ''} branches
          </span>
        </div>
        {branches.isLoading && (
          <p className={styles.empty} role="status">
            Loading branches…
          </p>
        )}
        {branches.isError && (
          <div className={styles.error} role="alert">
            Could not load branches.{' '}
            <button className={styles.button} onClick={() => void branches.refetch()} type="button">
              Retry branches
            </button>
          </div>
        )}
        <div className={styles.branchList}>
          {branchItems.map((item) => (
            <button
              aria-pressed={branch === item.branch}
              className={styles.branch}
              key={item.branch}
              onClick={() => setBranch(branch === item.branch ? 'all' : item.branch)}
              type="button"
            >
              <span>
                <strong>
                  <GitBranch className="mr-2 inline" size={13} />
                  {item.branch || 'Unknown branch'}
                </strong>
                <small>{formatDurationShort(item.total_seconds)}</small>
              </span>
              <div className={styles.stackedBar}>
                <i style={{ flex: item.total_seconds, background: '#688d79' }} />
                <i style={{ flex: Math.max(0, branchTotal - item.total_seconds) }} />
              </div>
              <p>
                {count(item.heartbeat_count)} heartbeats · {count(item.ai_changes)} AI changes ·{' '}
                {count(item.human_changes)} human · {count(item.unknown_changes)} unknown
              </p>
            </button>
          ))}
        </div>
        {!branches.isLoading && !branches.isError && branchItems.length === 0 && (
          <p className={styles.empty}>No branch activity recorded.</p>
        )}
        {branches.hasNextPage && (
          <div className={styles.footer}>
            <button
              className={styles.button}
              disabled={branches.isFetchingNextPage}
              onClick={() => void branches.fetchNextPage()}
              type="button"
            >
              {branches.isFetchingNextPage ? 'Loading…' : 'Load more branches'}
            </button>
          </div>
        )}
      </section>
      {files.isLoading && (
        <p className={styles.empty} role="status">
          Loading project files…
        </p>
      )}
      {files.isError && (
        <div className={styles.error} role="alert">
          Could not load files.{' '}
          <button className={styles.button} onClick={() => void files.refetch()} type="button">
            Retry files
          </button>
        </div>
      )}
      {/* Infinite-query data includes its initial response even when no files match. */}
      {files.data && (
        <ProjectFilesPanel
          files={fileItems}
          hasMore={Boolean(files.hasNextPage)}
          key={`${projectId}:${start}:${end}:${timezone}:${branch}`}
          loadingMore={files.isFetchingNextPage}
          onLoadMore={() => void files.fetchNextPage()}
          totalSeconds={files.data.pages[0].project_total_seconds}
        />
      )}
    </div>
  );
}
