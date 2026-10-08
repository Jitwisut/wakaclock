'use client';

import { createElement, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Code2,
  Compass,
  FolderGit2,
  GitBranch,
  Layers3,
  Monitor,
  Search,
  Sparkles,
  Terminal,
} from 'lucide-react';

import { DashboardPanel } from '@/components/dashboard-panels';
import { QueryState } from '@/components/wakaclock/query-state';
import { getBrowserTimezone, getInsights, getStats } from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type {
  InsightsResponse,
  InsightType,
  StatsRange,
  StatsResponse,
} from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from './insights-workspace.module.css';

const DIMENSIONS = [
  { value: 'languages', label: 'Languages', icon: Code2 },
  { value: 'projects', label: 'Projects', icon: FolderGit2 },
  { value: 'editors', label: 'Editors', icon: Terminal },
  { value: 'operating_systems', label: 'Systems', icon: Monitor },
  { value: 'branches', label: 'Branches', icon: GitBranch },
] as const;
const RANGES: { label: string; value: StatsRange }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: '7 days' },
  { value: 'last_30_days', label: '30 days' },
  { value: 'all_time', label: 'All time' },
];
const COLORS = ['#8e9f72', '#a4a0d0', '#d9a879', '#7faeac', '#b98e9f', '#a8b7c4'];
const percent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));

export function InsightsWorkspace() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const [type, setType] = useState<InsightType>('languages');
  const [range, setRange] = useState<StatsRange>('last_7_days');
  const [timezone, setTimezone] = useState<null | string>(null);
  useEffect(() => {
    setTimezone(getBrowserTimezone() ?? 'UTC');
  }, []);
  const insights = useQuery({
    queryKey: wakaclockKeys.insights(userId, type, range, timezone ?? undefined),
    queryFn: () => getInsights(userId, type, range),
    enabled: Boolean(userId && timezone),
  });
  const stats = useQuery({
    queryKey: wakaclockKeys.stats(userId, range, timezone ?? undefined),
    queryFn: () => getStats(userId, range),
    enabled: Boolean(userId && timezone),
  });

  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <Compass size={13} /> PERSONAL ANALYTICS
          </span>
          <h1>Insights</h1>
        </div>
        <div aria-label="Insights period" className={styles.rangeControl} role="group">
          {RANGES.map((item) => (
            <button
              aria-pressed={range === item.value}
              key={item.value}
              onClick={() => setRange(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      <section className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>A LITTLE PERSPECTIVE GOES A LONG WAY</span>
          <h2>
            Your time.
            <br />
            <em>A clearer picture.</em>
          </h2>
          <p>Explore the tools, projects, and habits that shape your work.</p>
        </div>
        <div className={styles.introAside}>
          <span aria-hidden="true" className={styles.orbit}>
            <Compass size={44} strokeWidth={1} />
          </span>
          <span>OBSERVE. UNDERSTAND. REFINE.</span>
          <small>{timezone ?? 'Your local time'}</small>
        </div>
      </section>
      <div aria-label="Explore by" className={styles.dimensionControl} role="group">
        {DIMENSIONS.map(({ value, label, icon: dimensionIcon }) => (
          <button
            aria-pressed={type === value}
            key={value}
            onClick={() => setType(value)}
            type="button"
          >
            {createElement(dimensionIcon, { size: 15 })}
            {label}
          </button>
        ))}
      </div>
      <QueryState
        emptyDescription="Try another period or dimension to explore your recorded work."
        emptyTitle="Your next insight starts with a little activity"
        error={insights.error}
        isEmpty={!insights.isLoading && !insights.error && !insights.data?.data.length}
        isLoading={timezone === null || insights.isLoading}
        skeletonClassName={styles.skeleton}
      >
        {insights.data && (
          <InsightsReport
            data={insights.data}
            key={`${userId}:${type}:${range}`}
            onRetryStats={() => void stats.refetch()}
            stats={stats.data}
            statsError={Boolean(stats.error)}
            statsPending={stats.isLoading}
          />
        )}
      </QueryState>
      {insights.error && (
        <button className={styles.retry} onClick={() => void insights.refetch()} type="button">
          Try again
        </button>
      )}
    </main>
  );
}

export function InsightsReport({
  data,
  stats,
  statsPending = false,
  statsError = false,
  onRetryStats,
}: {
  data: InsightsResponse;
  onRetryStats?: () => void;
  stats?: StatsResponse;
  statsError?: boolean;
  statsPending?: boolean;
}) {
  const [selected, setSelected] = useState<null | string>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('time');
  const [limit, setLimit] = useState(12);
  const rows = [...data.data].sort(
    (a, b) => b.total_seconds - a.total_seconds || a.name.localeCompare(b.name)
  );
  const total = rows.reduce((sum, row) => sum + row.total_seconds, 0);
  const current = rows.find((row) => row.name === selected) ?? rows[0];
  const dimension = DIMENSIONS.find((item) => item.value === data.type)?.label ?? 'Entries';
  const top = rows.slice(0, 5);
  const other = rows.slice(5).reduce((sum, row) => sum + row.total_seconds, 0);
  const segments = [
    ...top.map((row, index) => ({
      name: row.name,
      seconds: row.total_seconds,
      color: COLORS[index],
    })),
    ...(other > 0 ? [{ name: 'Other', seconds: other, color: COLORS[5] }] : []),
  ];
  let offset = 0;
  const gradient = segments
    .map((segment) => {
      const from = offset;
      offset += percent(segment.seconds, total);
      return `${segment.color} ${from}% ${offset}%`;
    })
    .join(', ');
  const filtered = rows
    .filter((row) => row.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'days') return b.days - a.days || b.total_seconds - a.total_seconds;
      if (sort === 'heartbeats') return b.heartbeats - a.heartbeats;
      return b.total_seconds - a.total_seconds;
    });
  const distributionLabel = segments
    .map((segment) => `${segment.name} ${percent(segment.seconds, total).toFixed(1)}%`)
    .join(', ');
  const stat = stats?.data;
  const unavailable = statsPending ? '…' : '—';
  const topThreeShare = percent(
    rows.slice(0, 3).reduce((sum, row) => sum + row.total_seconds, 0),
    total
  );
  if (!current) return null;

  return (
    <div className={styles.report}>
      <div className={styles.period}>
        <span>
          <CalendarDays size={13} /> {dateLabel(data.start)} — {dateLabel(data.end)}
        </span>
        <span>
          {rows.length} {dimension.toLowerCase()} in view
        </span>
      </div>
      <div className={styles.metrics}>
        <div>
          <span>
            <Clock3 size={15} /> RECORDED TIME
          </span>
          <strong>{formatDurationShort(total)}</strong>
          <small>Across {dimension.toLowerCase()}</small>
        </div>
        <div>
          <span>
            <CalendarDays size={15} /> ACTIVE DAYS
          </span>
          <strong>
            {stat?.days_with_activity ?? unavailable}
            <em>{stat ? ` / ${stat.days_included}` : ''}</em>
          </strong>
          <small>Days with recorded activity</small>
        </div>
        <div>
          <span>
            <Activity size={15} /> DAILY AVERAGE
          </span>
          <strong>{stat ? formatDurationShort(stat.daily_average_seconds) : unavailable}</strong>
          <small>Per day with recorded activity</small>
        </div>
        <div>
          <span>
            <Sparkles size={15} /> BUSIEST DAY
          </span>
          <strong>
            {stat?.best_day ? formatDurationShort(stat.best_day.total_seconds) : unavailable}
          </strong>
          <small>
            {stat?.best_day ? dateLabel(stat.best_day.date) : 'No recorded day available'}
          </small>
        </div>
      </div>
      {statsError && (
        <p className={styles.notice}>
          Daily statistics could not load. Your breakdown is still available.{' '}
          {onRetryStats && (
            <button onClick={onRetryStats} type="button">
              Retry daily statistics
            </button>
          )}
        </p>
      )}
      <div className={styles.mainGrid}>
        <DashboardPanel id="insights.chart">
          <section className={styles.composition}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>01 / THE BIG PICTURE</span>
                <h3>Where your time goes</h3>
              </div>
              <span className={styles.pill}>{dimension}</span>
            </div>
            <div className={styles.compositionBody}>
              <div className={styles.ringWrap}>
                <div
                  aria-label={`${dimension} distribution: ${distributionLabel}`}
                  className={styles.ring}
                  role="img"
                  style={{
                    background: total > 0 ? `conic-gradient(${gradient})` : 'var(--border)',
                  }}
                >
                  <div>
                    <span>TOTAL TIME</span>
                    <strong>{formatDurationShort(total)}</strong>
                    <small>
                      {rows.length} {dimension.toLowerCase()}
                    </small>
                  </div>
                </div>
                <span className={styles.chartCaption}>A small map of your attention.</span>
              </div>
              <div className={styles.legend}>
                {top.map((row, index) => (
                  <button
                    aria-pressed={current.name === row.name}
                    key={row.name}
                    onClick={() => setSelected(row.name)}
                    style={{ '--entry-color': COLORS[index] } as CSSProperties}
                    type="button"
                  >
                    <i />
                    <span>
                      <strong>{row.name}</strong>
                      <small>{formatDurationShort(row.total_seconds)}</small>
                    </span>
                    <b>{percent(row.total_seconds, total).toFixed(1)}%</b>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
                {other > 0 && (
                  <div className={styles.other}>
                    <i style={{ background: COLORS[5] }} />
                    <span>Other · {rows.length - 5} entries</span>
                    <strong>{percent(other, total).toFixed(1)}%</strong>
                  </div>
                )}
                <p>Select an entry to look a little closer.</p>
              </div>
            </div>
            <div className={styles.compositionFooter}>
              <Layers3 size={14} />
              <span>
                Top {Math.min(3, rows.length)} account for{' '}
                <strong>{topThreeShare.toFixed(1)}%</strong> of recorded time.
              </span>
            </div>
          </section>
        </DashboardPanel>
        <aside aria-label="Selected insight" aria-live="polite" className={styles.spotlight}>
          <div className={styles.spotlightContent} key={current.name}>
            <span className={styles.eyebrow}>
              <span className={styles.liveDot} /> IN THE SPOTLIGHT
            </span>
            <h3>{current.name}</h3>
            <span className={styles.spotlightRank}>
              #{rows.indexOf(current) + 1} in {dimension.toLowerCase()}
            </span>
            <strong className={styles.spotlightTime}>
              {formatDurationShort(current.total_seconds)}
            </strong>
            <span className={styles.spotlightCaption}>of your recorded activity</span>
            <div className={styles.shareLabel}>
              <span>Share of this view</span>
              <strong>{percent(current.total_seconds, total).toFixed(1)}%</strong>
            </div>
            <div className={styles.shareTrack}>
              <span style={{ width: `${percent(current.total_seconds, total)}%` }} />
            </div>
            <dl>
              <div>
                <dt>Active days</dt>
                <dd>{current.days}</dd>
              </div>
              <div>
                <dt>Per active day</dt>
                <dd>
                  {current.days > 0
                    ? formatDurationShort(current.total_seconds / current.days)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Heartbeats</dt>
                <dd>{current.heartbeats.toLocaleString()}</dd>
              </div>
            </dl>
            <p>
              Time describes where your attention went. It isn’t a measure of code quality or
              productivity.
            </p>
          </div>
        </aside>
      </div>
      <section className={styles.details}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>02 / FOLLOW THE DETAILS</span>
            <h3>Every entry, in perspective.</h3>
            <p>Select any row to inspect its time and activity.</p>
          </div>
          <div className={styles.tableTools}>
            <label className={styles.search}>
              <Search size={15} />
              <input
                aria-label="Search entries"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setLimit(12);
                }}
                placeholder={`Find ${dimension.toLowerCase()}…`}
                value={search}
              />
            </label>
            <label className={styles.sort}>
              <ArrowDown size={13} />
              <select
                aria-label="Sort entries"
                onChange={(event) => {
                  setSort(event.target.value);
                  setLimit(12);
                }}
                value={sort}
              >
                <option value="time">Most time</option>
                <option value="days">Active days</option>
                <option value="heartbeats">Heartbeats</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Rank / {dimension}</th>
                <th>Recorded time</th>
                <th>Share</th>
                <th>Active days</th>
                <th>Per active day</th>
                <th>Heartbeats</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((row) => (
                <tr data-selected={row.name === current.name} key={row.name}>
                  <td>
                    <button
                      aria-pressed={row.name === current.name}
                      onClick={() => setSelected(row.name)}
                      type="button"
                    >
                      <span className={styles.rank}>
                        {String(rows.indexOf(row) + 1).padStart(2, '0')}
                      </span>
                      <span>{row.name}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  </td>
                  <td>{formatDurationShort(row.total_seconds)}</td>
                  <td>
                    <div className={styles.tableShare}>
                      <span>{percent(row.total_seconds, total).toFixed(1)}%</span>
                      <i>
                        <b style={{ width: `${percent(row.total_seconds, total)}%` }} />
                      </i>
                    </div>
                  </td>
                  <td>{row.days}</td>
                  <td>{row.days ? formatDurationShort(row.total_seconds / row.days) : '—'}</td>
                  <td>{row.heartbeats.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className={styles.noMatches}>
            No entries match “{search}”.{' '}
            <button onClick={() => setSearch('')} type="button">
              Clear search
            </button>
          </div>
        )}
        <div className={styles.tableFooter}>
          <span>
            {Math.min(limit, filtered.length)} of {filtered.length} entries
          </span>
          {filtered.length > limit && (
            <button onClick={() => setLimit(limit + 12)} type="button">
              Show more <ArrowDown size={13} />
            </button>
          )}
          <span>Time is shown for the selected period.</span>
        </div>
      </section>
      <section className={styles.measurement}>
        <div>
          <span className={styles.eyebrow}>03 / BEHIND THE NUMBERS</span>
          <h3>A clearer view of time.</h3>
          <p>
            Compare recorded activity with measured AI time. Missing measurements appear as
            unavailable.
          </p>
        </div>
        <dl>
          <div>
            <dt>Editor-only activity</dt>
            <dd>
              {data.comparable_seconds == null
                ? 'Unavailable'
                : formatDurationShort(data.comparable_seconds)}
            </dd>
            <small>Excludes all AI Coding; can be zero despite measured activity</small>
          </div>
          <div>
            <dt>Additional measured AI</dt>
            <dd>
              {data.ai_additional_seconds == null
                ? 'Unavailable'
                : formatDurationShort(data.ai_additional_seconds)}
            </dd>
            <small>AI time beyond editor-only activity</small>
          </div>
          <div>
            <dt>Measured AI total</dt>
            <dd>
              {data.ai_measured_seconds == null
                ? 'Unavailable'
                : formatDurationShort(data.ai_measured_seconds)}
            </dd>
            <small>May overlap with editor-only activity</small>
          </div>
        </dl>
      </section>
    </div>
  );
}
