'use client';

import * as React from 'react';

import { CalendarClockIcon, RefreshCwIcon, ShieldCheckIcon } from 'lucide-react';

import { dateKey } from '@/hooks/use-coworking-history';
import {
  hourLabel,
  intensityLevel,
  maxCell,
  peakLabel,
  type PresenceHeatmapData,
  WEEKDAY_LABELS,
} from '@/lib/presence/presence-heatmap';
import { formatPresenceDuration } from '@/lib/presence/presence-status';
import { WakaclockError } from '@/lib/wakaclock/client';
import { getOrganizationPresenceHeatmapV2, listOrganizations } from '@/lib/wakaclock/endpoints-v2';
import type { Organization } from '@/lib/wakaclock/measurement-types';
import { getBrowserTimezone } from '@/lib/wakaclock/presence-client';

import styles from './presence-chrome.module.css';

export const RHYTHM_RANGES = [
  { days: 14, label: '2 weeks' },
  { days: 28, label: '4 weeks' },
  { days: 84, label: '12 weeks' },
] as const;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** `from`/`to` date keys for the last `days` days in the viewer's timezone. */
export function rangeFor(days: number, now: Date, timezone: string) {
  const from = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: dateKey(from, timezone), timezone, to: dateKey(now, timezone) };
}

function HeatmapGrid({ data }: { data: PresenceHeatmapData }) {
  const cells = data.cells ?? [];
  const max = maxCell(cells);
  return (
    <div className="flex flex-col gap-2">
      <div aria-label="Co-working time by weekday and hour" className={styles.heatmap} role="table">
        <div className={styles.heatmapRow} role="row">
          <span role="columnheader" />
          {HOURS.map((hour) => (
            <span className={styles.heatmapHour} key={hour} role="columnheader">
              {hour % 6 === 0 ? hour : ''}
              <span className="sr-only">{hourLabel(hour)}</span>
            </span>
          ))}
        </div>
        {cells.map((row, weekday) => (
          <div className={styles.heatmapRow} key={WEEKDAY_LABELS[weekday]} role="row">
            <span className={styles.heatmapDay} role="rowheader">
              {WEEKDAY_LABELS[weekday]}
            </span>
            {HOURS.map((hour) => {
              const seconds = row[hour];
              const label = `${WEEKDAY_LABELS[weekday]} ${hourLabel(hour)}: ${
                seconds > 0 ? `${formatPresenceDuration(seconds)} together` : 'no co-working'
              }`;
              return (
                <span
                  aria-label={label}
                  className={styles.heatmapCell}
                  data-level={intensityLevel(seconds, max)}
                  key={hour}
                  role="cell"
                  title={label}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className={`${styles.faint} flex items-center justify-end gap-1.5 text-[11px]`}>
        Less
        {[0, 1, 2, 3, 4].map((level) => (
          <span aria-hidden className={styles.heatmapCell} data-level={level} key={level} />
        ))}
        More
      </div>
    </div>
  );
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** What a loaded heatmap response says: suppressed, empty, or the grid with its notes. */
function RhythmResult({ data }: { data: null | PresenceHeatmapData }) {
  const total = data?.total_seconds ?? 0;
  if (data?.suppressed) {
    return (
      <p className={`${styles.faint} flex gap-2 text-sm`}>
        <ShieldCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        Shown once at least three people have shared co-working sessions in this range — team totals
        only, never who.
      </p>
    );
  }
  if (!data || total <= 0) {
    return (
      <p className={`${styles.faint} text-sm`}>No shared co-working sessions in this range yet.</p>
    );
  }
  const sessions = data.session_count ?? 0;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Most shared time: <strong>{peakLabel(data.peak)}</strong>
        <span className={styles.faint}>
          {' '}
          · {formatPresenceDuration(total)} across {sessions}{' '}
          {plural(sessions, 'session', 'sessions')}
        </span>
      </p>
      <HeatmapGrid data={data} />
      {data.hidden_slots > 0 ? (
        <p className={`${styles.faint} text-xs`}>
          {data.hidden_slots} hour {plural(data.hidden_slots, 'slot', 'slots')} with a single
          session {plural(data.hidden_slots, 'is', 'are')} left blank so one session can&apos;t be
          picked out.
        </p>
      ) : null}
      {data.truncated ? (
        <p className={`${styles.faint} text-xs`}>
          Showing the first sessions only — pick a shorter range for the full picture.
        </p>
      ) : null}
    </div>
  );
}

/**
 * When your organization's teams co-work, as an aggregate weekday × hour heatmap — for
 * picking pairing slots, not for looking at anyone. It needs an organization team; with
 * none it says so and stays out of the way.
 */
export function TeamRhythm() {
  const [organizations, setOrganizations] = React.useState<null | Organization[]>(null);
  const [organizationId, setOrganizationId] = React.useState('');
  const [days, setDays] = React.useState<number>(28);
  const [data, setData] = React.useState<null | PresenceHeatmapData>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<null | string>(null);
  const [attempt, setAttempt] = React.useState(0);
  /** True when the selected organization has no team you belong to (the API's 403). */
  const [noTeam, setNoTeam] = React.useState(false);
  // Until you pick an organization yourself, a 403 moves on to the next one, so the
  // panel lands on an organization where you actually have a team.
  const autoPick = React.useRef(true);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await listOrganizations();
        if (cancelled) return;
        setOrganizations(list);
        setOrganizationId(list[0]?.id ?? '');
        if (list.length === 0) setLoading(false);
      } catch (requestError) {
        if (cancelled) return;
        setOrganizations([]);
        setError(message(requestError, 'Could not load your organizations'));
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!organizationId || !organizations) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const next = await getOrganizationPresenceHeatmapV2(
          organizationId,
          rangeFor(days, new Date(), getBrowserTimezone())
        );
        if (cancelled) return;
        setData(next);
        setNoTeam(false);
        setError(null);
      } catch (requestError) {
        if (cancelled) return;
        setData(null);
        if (requestError instanceof WakaclockError && requestError.status === 403) {
          const next =
            organizations[organizations.findIndex((org) => org.id === organizationId) + 1];
          if (autoPick.current && next) {
            setOrganizationId(next.id);
            return;
          }
          setNoTeam(true);
          setError(null);
        } else {
          setError(message(requestError, 'Could not load team co-working'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt, days, organizationId, organizations]);

  const noOrganizations = organizations !== null && organizations.length === 0 && !error;
  let body: React.ReactNode;
  if (noOrganizations) {
    body = (
      <p className={`${styles.faint} text-sm`}>
        Join an organization team to see when your team co-works together.
      </p>
    );
  } else if (loading) {
    body = (
      <div role="status">
        <span className="sr-only">Loading team co-working…</span>
        <div className={`${styles.skeleton} h-40`} />
      </div>
    );
  } else if (noTeam) {
    body = (
      <p className={`${styles.faint} text-sm`}>
        You are not on a team in this organization yet, so there is no team rhythm to show.
      </p>
    );
  } else if (error) {
    body = (
      <p className={styles.errorText} role="alert">
        {error}{' '}
        <button className="underline" onClick={() => setAttempt((n) => n + 1)} type="button">
          Retry
        </button>
      </p>
    );
  } else {
    body = <RhythmResult data={data} />;
  }

  const hasOrganizations = organizations !== null && organizations.length > 0;

  return (
    <section aria-labelledby="rhythm-heading" className={`${styles.panel} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={styles.eyebrow}>Team rhythm</p>
          <h2 className={styles.title} id="rhythm-heading">
            When your team co-works
          </h2>
        </div>
        {hasOrganizations ? (
          <button
            aria-label="Refresh team co-working"
            className={`${styles.btn} ${styles.btnIcon}`}
            disabled={loading}
            onClick={() => setAttempt((n) => n + 1)}
            type="button"
          >
            <RefreshCwIcon aria-hidden className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        ) : null}
      </div>
      {hasOrganizations ? (
        <div className="flex flex-wrap items-center gap-2">
          {organizations.length > 1 ? (
            <select
              aria-label="Organization"
              className={`${styles.input} w-auto`}
              onChange={(event) => {
                autoPick.current = false;
                setOrganizationId(event.target.value);
              }}
              value={organizationId}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          ) : null}
          <div aria-label="Range" className={styles.chips} role="group">
            {RHYTHM_RANGES.map((range) => (
              <button
                aria-pressed={days === range.days}
                className={styles.chip}
                key={range.days}
                onClick={() => setDays(range.days)}
                type="button"
              >
                <CalendarClockIcon aria-hidden className="size-3.5" />
                {range.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {body}
    </section>
  );
}
