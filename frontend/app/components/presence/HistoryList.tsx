'use client';

import type { PresenceHistoryItem } from '@/lib/wakaclock/types';

interface HistoryListProps {
  items: PresenceHistoryItem[];
  loading?: boolean;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function HistoryList({ items, loading = false }: HistoryListProps) {
  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--presence-text-muted)' }}>Loading your co-working history…</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--presence-text-muted)' }}>No co-working sessions in this window.</p>;
  }
  return (
    <div aria-label="Your co-working history" className="grid gap-2">
      {items.map((item) => (
        <article className="border-2 p-3" key={item.session_id} style={{ borderColor: 'var(--presence-border)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">{item.room_name}</p>
            <span className="text-xs font-bold" style={{ color: 'var(--presence-live)' }}>{formatDuration(item.duration_seconds)}</span>
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--presence-text-muted)' }}>
            {new Date(item.your_joined_at * 1000).toLocaleString()} · {item.participants.map((participant) => participant.username).join(', ')}
          </p>
          {item.your_projects.length > 0 ? (
            <p className="mt-2 text-xs">
              <span className="font-bold">Your projects:</span> {item.your_projects.join(', ')}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
