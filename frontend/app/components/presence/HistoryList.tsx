'use client';

import { formatPresenceDuration } from '@/lib/presence/presence-status';
import type { PresenceHistoryItem } from '@/lib/wakaclock/types';

import styles from './presence-chrome.module.css';

interface HistoryListProps {
  items: PresenceHistoryItem[];
  loading?: boolean;
}

export function HistoryList({ items, loading = false }: HistoryListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2" role="status">
        <span className="sr-only">Loading your co-working history…</span>
        <div className={`${styles.skeleton} h-14`} />
        <div className={`${styles.skeleton} h-14`} />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className={`${styles.faint} text-sm`}>
        No co-working sessions today. Share a pod with a teammate to start one.
      </p>
    );
  }
  return (
    <div aria-label="Your co-working history" className="grid gap-2">
      {items.map((item) => (
        <article className={styles.historyItem} key={item.session_id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{item.room_name}</p>
            <span className={`${styles.status} ${styles.coding}`}>
              {formatPresenceDuration(item.duration_seconds)}
            </span>
          </div>
          <p className={`${styles.faint} text-xs`}>
            {new Date(item.your_joined_at * 1000).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · {item.participants.map((participant) => participant.username).join(', ')}
          </p>
          {item.your_projects.length > 0 ? (
            <p className={`${styles.muted} text-xs`}>
              <span className="font-semibold">Your projects:</span> {item.your_projects.join(', ')}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
