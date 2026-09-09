'use client';

import { useState } from 'react';

import { Activity, Clock3, Radio } from 'lucide-react';

import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

import styles from './timeline-studio.module.css';

export function TimelineStudio({ data }: { data: AnalyticsExplorerResponse }) {
  const [selected, setSelected] = useState<null | number>(null);
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    seconds: data.time_heatmap
      .filter((item) => item.hour === hour)
      .reduce((sum, item) => sum + item.total_seconds, 0),
  }));
  const peak = hours.reduce((best, item) => (item.seconds > best.seconds ? item : best), hours[0]);
  const current = hours[selected ?? peak.hour];
  const maximum = Math.max(peak.seconds, 1);

  return (
    <section aria-label="Activity rhythm" className={styles.studio}>
      <div className={styles.hero}>
        <div>
          <span className={styles.kicker}>
            <Radio size={14} /> THE TIME MACHINE / ACTIVITY ARCHIVE
          </span>
          <h2>
            Every moment.
            <br />
            <em>A little momentum.</em>
          </h2>
          <p>Find the peaks, the pauses, and the hours that make things happen.</p>
          <div className={styles.period}>
            {data.range.start} → {data.range.end} · {data.range.timezone}
          </div>
        </div>
        <div aria-hidden="true" className={styles.machine}>
          <div className={styles.machineLabel}>
            ● MOMENTUM PLAYER <span>01</span>
          </div>
          <div className={styles.screen}>
            <Activity size={42} />
            <strong>{formatDurationShort(data.summary.total_seconds)}</strong>
            <small>RECORDED ACTIVITY</small>
          </div>
          <div className={styles.keys}>
            <i />
            <i />
            <i />
            <b>▶</b>
          </div>
        </div>
      </div>
      <div className={styles.metrics}>
        <div>
          <Clock3 size={18} />
          <span>TIME IN MOTION</span>
          <strong>{formatDurationShort(data.summary.total_seconds)}</strong>
          <small>Total attended time</small>
        </div>
        <div>
          <Activity size={18} />
          <span>ACTIVE DAYS</span>
          <strong>
            {data.summary.active_days}
            <em> / {data.range.days_included}</em>
          </strong>
          <small>Days with recorded activity</small>
        </div>
        <div>
          <Radio size={18} />
          <span>BUSIEST LOCAL HOUR</span>
          <strong>{peak.seconds ? `${String(peak.hour).padStart(2, '0')}:00` : '—'}</strong>
          <small>{formatDurationShort(peak.seconds)} across the selected dates</small>
        </div>
      </div>
      <div className={styles.rhythm}>
        <div>
          <span className={styles.kicker}>01 / YOUR DAILY FREQUENCY</span>
          <h3>
            When do you
            <br />
            find your flow?
          </h3>
          <p>Activity by local hour across your selected dates. Select a column to explore.</p>
          <div aria-live="polite" className={styles.readout}>
            <strong>{String(current.hour).padStart(2, '0')}:00</strong>
            <span>{formatDurationShort(current.seconds)} recorded</span>
          </div>
        </div>
        <div className={styles.plot}>
          <div aria-label="Activity by hour" className={styles.equalizer}>
            {hours.map(({ hour, seconds }) => (
              <button
                aria-label={`${String(hour).padStart(2, '0')}:00, ${formatDurationShort(seconds)}`}
                aria-pressed={current.hour === hour}
                key={hour}
                onClick={() => setSelected(hour)}
                type="button"
              >
                <span
                  className={styles.tower}
                  style={{ height: `${(seconds / maximum) * 100}%` }}
                />
                <small>{hour % 6 === 0 ? String(hour).padStart(2, '0') : '·'}</small>
              </button>
            ))}
          </div>
          <div className={styles.axis}>
            <span>MIDNIGHT</span>
            <span>NOON</span>
            <span>23:00</span>
          </div>
        </div>
      </div>
    </section>
  );
}
