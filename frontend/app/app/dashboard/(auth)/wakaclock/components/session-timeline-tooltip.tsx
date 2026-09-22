'use client';

import type { CSSProperties } from 'react';

import { Activity, ArrowUpRight, Clock3 } from 'lucide-react';

import { TooltipContent } from '@/components/ui/tooltip';
import { formatDurationShort, formatEpochTime } from '@/lib/wakaclock/format';
import type { TimelineSession } from '@/lib/wakaclock/timeline-sessions';

import styles from './session-timeline-tooltip.module.css';

export function SessionTimelineTooltip({
  session,
  color,
  duration,
  projectTotal,
}: {
  session: TimelineSession;
  color: string;
  duration: string;
  projectTotal: number;
}) {
  const share =
    projectTotal > 0 ? Math.min(100, (session.duration_seconds / projectTotal) * 100) : 0;

  const gapSeconds = Math.max(0, session.end - session.start - session.duration_seconds);

  return (
    <TooltipContent
      className={styles.panel}
      sideOffset={14}
      collisionPadding={16}
      style={{ '--session-color': color } as CSSProperties}
    >
      <div className={styles.content}>
        <div className={styles.eyebrow}>
          <span>
            <span className={styles.status} /> RECORDED SESSION
          </span>
          <ArrowUpRight aria-hidden="true" size={14} />
        </div>
        <div className={styles.project}>{session.project}</div>

        <div className={styles.durationRow}>
          <strong className={styles.duration}>{duration}</strong>
          <span className={styles.category}>{session.categories.join(' · ')}</span>
        </div>
        <div className={styles.durationCaption}>
          <Clock3 aria-hidden="true" size={12} /> Recorded activity
        </div>

        <div className={styles.timeRange}>
          <div>
            <span>Started</span>
            <strong>{formatEpochTime(session.start)}</strong>
          </div>
          <div className={styles.connector} aria-hidden="true">
            <i />
            <span />
            <i />
          </div>
          <div>
            <span>Ended</span>
            <strong>{formatEpochTime(session.end)}</strong>
          </div>
        </div>

        {session.languages.length > 0 && (
          <div className={styles.languages} aria-label="Session languages">
            {session.languages.slice(0, 3).map((language) => (
              <span key={language}>{language}</span>
            ))}
            {session.languages.length > 3 && (
              <span title={session.languages.slice(3).join(', ')}>
                +{session.languages.length - 3} more
              </span>
            )}
          </div>
        )}

        <div className={styles.share}>
          <div>
            <span>Of this project’s day</span>
            <strong>{share.toFixed(1)}%</strong>
          </div>
          <div className={styles.shareTrack} aria-hidden="true">
            <span style={{ width: `${share}%` }} />
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <Activity aria-hidden="true" size={13} />
        <span>{session.heartbeat_count.toLocaleString()} heartbeats</span>
        <span className={styles.footerNote}>
          {gapSeconds > 0
            ? `${formatDurationShort(gapSeconds)} between activity`
            : 'Continuous activity'}
        </span>
      </div>
    </TooltipContent>
  );
}
