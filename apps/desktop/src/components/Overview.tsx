import { Activity, Clock3, CloudOff, Monitor, Radio, TimerReset } from 'lucide-react';
import { categoryLabel, formatDuration } from '../lib/format';
import type { DashboardSnapshot } from '../types';

interface OverviewProps {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  onRefresh: () => void;
}

/** Rough age of the cached confirmed total, for the stale label. */
function formatAgo(timestamp: number | null | undefined): string {
  if (!timestamp) return 'never';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

const categoryOrder = [
  'coding',
  'meeting',
  'communicating',
  'designing',
  'modeling',
  'building',
  'debugging',
] as const;

/** How the cloud card reads for each typed state. A transport outage and a
 *  rejected key are different problems and must not share one label. */
function cloudLabel(state: DashboardSnapshot['connection_state'] | undefined): string {
  switch (state) {
    case 'online':
      return 'Connected';
    case 'offline':
      return 'Offline';
    case 'auth_rejected':
      return 'Key rejected';
    case 'subscription_required':
      return 'Subscription required';
    case 'retryable_server_error':
      return 'Degraded';
    case 'needs_api_key':
      return 'Not connected';
    default:
      return 'Unknown';
  }
}

export function Overview({ snapshot, loading, onRefresh }: OverviewProps) {
  const runtime = snapshot?.runtime;
  const categorySeconds = snapshot?.category_seconds ?? {};
  const total = Math.max(1, Object.values(categorySeconds).reduce((sum, value) => sum + (value ?? 0), 0));

  return (
    <div className="section-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">DESKTOP ACTIVITY</p>
          <h1>Overview</h1>
          <p>Live foreground-app tracking with the same AtoAxis visual language as the web dashboard.</p>
        </div>
        <button className="button button-outline" disabled={loading} onClick={onRefresh} type="button">
          <TimerReset size={16} /> Refresh
        </button>
      </header>

      <div className="stats-grid">
        <StatCard
          icon={<Clock3 />}
          label="Today"
          // An unknown total is shown as unknown: reporting 0m while the server is
          // unreachable is what made an outage look like a quiet day.
          value={snapshot?.display_total_seconds == null ? 'Unknown' : (snapshot?.today_text ?? '0m')}
          subtext={
            snapshot?.display_total_seconds == null
              ? 'no server total read yet'
              : snapshot?.server_snapshot_stale
                ? `${snapshot.heartbeat_count} heartbeats · last confirmed ${formatAgo(snapshot.last_confirmed_at)}`
                : `${snapshot?.heartbeat_count ?? 0} heartbeats`
          }
        />
        <StatCard icon={<Activity />} label="This session" value={formatDuration(snapshot?.session_seconds ?? 0)} subtext="desktop tracker only" />
        <StatCard icon={<Monitor />} label="Foreground" value={runtime?.app_name ?? '—'} subtext={runtime?.category ? categoryLabel(runtime.category) : 'waiting for activity'} compact />
        <StatCard
          icon={snapshot?.connection_state === 'online' ? <Radio /> : <CloudOff />}
          label="Cloud"
          value={cloudLabel(snapshot?.connection_state)}
          // Always the real count from the durable queue. "Queue protected" with
          // no number said nothing about whether anything was actually held.
          subtext={
            snapshot?.queued_heartbeats
              ? `${snapshot.queued_heartbeats} queued · ${formatDuration(snapshot.queued_seconds)}`
              : 'nothing queued locally'
          }
          compact
        />
      </div>

      <div className="dashboard-grid">
        <section className="card current-card">
          <div className="card-heading-row">
            <div>
              <p className="card-kicker">NOW TRACKING</p>
              <h2>Current activity</h2>
            </div>
            <RuntimeBadge status={runtime?.status ?? 'unavailable'} />
          </div>
          <div className="current-app-panel">
            <div className="app-glyph">{runtime?.app_name?.slice(0, 2).toUpperCase() ?? 'AX'}</div>
            <div className="current-app-copy">
              <strong>{runtime?.app_name ?? 'No foreground activity yet'}</strong>
              <span>{runtime?.app_identifier ?? 'Waiting for native tracker'}</span>
            </div>
            <div className="current-app-meta">
              <span>category</span>
              <strong>{runtime?.category ? categoryLabel(runtime.category) : '—'}</strong>
            </div>
          </div>
          {runtime?.last_error && <div className="error-strip">{runtime.last_error}</div>}
        </section>

        <section className="card breakdown-card">
          <div className="card-heading-row">
            <div>
              <p className="card-kicker">SESSION MIX</p>
              <h2>Activity breakdown</h2>
            </div>
            <span className="muted-text">{formatDuration(total === 1 ? 0 : total)}</span>
          </div>
          <div className="breakdown-list">
            {categoryOrder.map((category) => {
              const seconds = categorySeconds[category] ?? 0;
              const percent = Math.round((seconds / total) * 100);
              return (
                <div className="breakdown-row" key={category}>
                  <div className="breakdown-label">
                    <strong>{categoryLabel(category)}</strong>
                    <span>{formatDuration(seconds)}</span>
                  </div>
                  <div className="bar-track" aria-label={`${category} ${percent}%`}>
                    <div className="bar-fill" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, compact = false }: { icon: React.ReactNode; label: string; value: string; subtext: string; compact?: boolean }) {
  return (
    <article className="stat-card">
      <div className="stat-header">
        <span className="stat-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <strong className={compact ? 'stat-value stat-value-compact' : 'stat-value'} title={value}>{value}</strong>
      <span className="stat-subtext">{subtext}</span>
    </article>
  );
}

function RuntimeBadge({ status }: { status: string }) {
  return <span className="runtime-badge" data-status={status}>{status.toUpperCase()}</span>;
}
