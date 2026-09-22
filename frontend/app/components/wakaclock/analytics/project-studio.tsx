'use client';

import {
  ArrowDownRight,
  ArrowUpRight,
  Box,
  CalendarDays,
  Clock3,
  Code2,
  Sparkles,
} from 'lucide-react';

import type { AnalyticsExplorerResponse, AnalyticsFilterOption } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

import styles from './project-studio.module.css';

export const studioColors = ['#688d79', '#9b8bc2', '#d5a15e', '#679ca8', '#cc8276', '#99a35d'];

export function ProjectStudio({ data, name }: { data: AnalyticsExplorerResponse; name: string }) {
  const busiest = [...data.calendar_heatmap].sort((a, b) => b.total_seconds - a.total_seconds)[0];
  const active = data.summary.active_days;
  return (
    <section aria-label="Project overview" className={styles.studio}>
      <div className={styles.hero}>
        <div>
          <span className={styles.kicker}>
            <Box size={14} /> PROJECT STUDIO / OVERVIEW
          </span>
          <h2>
            {name}
            <span className={styles.titleDot}>.</span>
          </h2>
          <p>A clear view of your time, tools and progress.</p>
          <div className={styles.heroLinks}>
            <a href="#project-files">
              Explore your files <ArrowDownRight size={15} />
            </a>
            <span>
              {data.range.start} — {data.range.end} · {data.range.timezone}
            </span>
          </div>
        </div>
        <div className={styles.heroTotal}>
          <span className={styles.kicker}>TIME INVESTED</span>
          <strong>{formatDurationShort(data.summary.total_seconds)}</strong>
          <span>
            Across {active} active {active === 1 ? 'day' : 'days'}
          </span>
          <div aria-hidden="true" className={styles.miniBars}>
            {data.calendar_heatmap.map((day) => (
              <i
                key={day.date}
                style={{
                  height: `${Math.max(4, (day.total_seconds / (busiest?.total_seconds || 1)) * 100)}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.metrics}>
        <Metric
          icon={<Clock3 size={16} />}
          label="Daily average"
          note="Per active day"
          value={formatDurationShort(active ? data.summary.total_seconds / active : 0)}
        />
        <Metric
          icon={<CalendarDays size={16} />}
          label="Consistency"
          note={`${active} of ${data.range.days_included} days active`}
          value={`${data.range.days_included ? Math.round((active / data.range.days_included) * 100) : 0}%`}
        />
        <Metric
          icon={<Sparkles size={16} />}
          label="Busiest day"
          note={busiest?.total_seconds ? busiest.date : 'No activity in this range'}
          value={busiest?.total_seconds ? formatDurationShort(busiest.total_seconds) : '—'}
        />
        <Metric
          icon={<Code2 size={16} />}
          label="Your toolkit"
          note={`${data.breakdowns.editors.length} editors in this selection`}
          value={`${data.breakdowns.languages.length} languages`}
        />
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className={styles.metric}>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export function StudioBreakdown({
  title,
  eyebrow,
  items,
  selected,
  onSelect,
}: {
  eyebrow: string;
  items: AnalyticsFilterOption[];
  onSelect: (key: string) => void;
  selected?: string;
  title: string;
}) {
  const ordered = [...items].sort((a, b) => b.total_seconds - a.total_seconds);
  const total = ordered.reduce((sum, item) => sum + item.total_seconds, 0);
  return (
    <section className={styles.panel}>
      <div className={styles.chartHeader}>
        <div>
          <span className={styles.kicker}>{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        <span className={styles.badge}>{items.length} total</span>
      </div>
      <div aria-hidden="true" className={styles.stackedBar}>
        {ordered.map((item, i) => (
          <i
            key={item.key}
            style={{ flex: item.total_seconds, background: studioColors[i % studioColors.length] }}
          />
        ))}
      </div>
      <div className={styles.breakdownList}>
        {ordered.length === 0 && (
          <p className={styles.empty}>No activity recorded in this selection.</p>
        )}
        {ordered.map((item, i) => (
          <button
            aria-pressed={selected === item.key}
            className={styles.breakdownRow}
            key={item.key}
            onClick={() => onSelect(selected === item.key ? '' : item.key)}
            type="button"
          >
            <span
              className={styles.legendDot}
              style={{ background: studioColors[i % studioColors.length] }}
            />
            <span className={styles.breakdownName}>{item.name}</span>
            <strong>{formatDurationShort(item.total_seconds)}</strong>
            <small>{total ? ((item.total_seconds / total) * 100).toFixed(1) : '0.0'}%</small>
            <ArrowUpRight size={13} />
          </button>
        ))}
      </div>
      <div className={styles.footer}>Select a row to filter · Select again to clear</div>
    </section>
  );
}

export function ProjectRhythm({ data }: { data: AnalyticsExplorerResponse }) {
  const max = Math.max(1, ...data.time_heatmap.map((cell) => cell.total_seconds));
  const peak = [...data.time_heatmap].sort((a, b) => b.total_seconds - a.total_seconds)[0];
  const cells = new Map(data.time_heatmap.map((cell) => [`${cell.weekday}:${cell.hour}`, cell]));
  return (
    <section className={styles.panel}>
      <div className={styles.chartHeader}>
        <div>
          <span className={styles.kicker}>02 / YOUR WORKING RHYTHM</span>
          <h3>When ideas happen</h3>
          <p>Activity by weekday and hour · {data.range.timezone}</p>
        </div>
      </div>
      {data.time_heatmap.length === 0 ? (
        <p className={styles.empty}>Hourly activity is not available for this selection.</p>
      ) : (
        <>
          <div className={styles.heatScroll}>
            <div className={styles.heatmap}>
              <span />
              {Array.from({ length: 24 }, (_, hour) => (
                <span className={styles.hour} key={hour}>
                  {hour % 6 === 0 ? `${String(hour).padStart(2, '0')}` : ''}
                </span>
              ))}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, weekday) => (
                <div className={styles.heatRow} key={day}>
                  <span>{day}</span>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cell = cells.get(`${weekday}:${hour}`);
                    const label = `${day} ${String(hour).padStart(2, '0')}:00 — ${formatDurationShort(cell?.total_seconds ?? 0)}`;
                    return (
                      <span
                        aria-label={label}
                        className={styles.heatCell}
                        key={hour}
                        role="img"
                        style={{
                          background: cell?.total_seconds
                            ? `color-mix(in srgb, #688d79 ${25 + (cell.total_seconds / max) * 75}%, var(--card))`
                            : undefined,
                        }}
                        title={label}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.rhythmInsight}>
            <Sparkles size={16} />
            <div>
              <strong>
                {peak?.total_seconds
                  ? `${peak.weekday_name} · ${String(peak.hour).padStart(2, '0')}:00–${String(peak.hour + 1).padStart(2, '0')}:00`
                  : 'Your rhythm starts here'}
              </strong>
              <p>
                {peak?.total_seconds
                  ? `${formatDurationShort(peak.total_seconds)} recorded in your busiest weekly hour.`
                  : 'No activity in this selection.'}
              </p>
            </div>
          </div>
        </>
      )}
      <div className={styles.footer}>
        Less{' '}
        <span className={styles.heatLegend}>
          <i />
          <i />
          <i />
          <i />
        </span>{' '}
        More <span>Recorded time, not a productivity score</span>
      </div>
    </section>
  );
}
