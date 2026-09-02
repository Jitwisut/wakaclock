import { Activity, Clock3, CloudOff, Monitor, Radio, TimerReset } from 'lucide-react';
import { categoryLabel, formatDuration } from '../lib/format';
import type { DashboardSnapshot } from '../types';

interface OverviewProps {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  onRefresh: () => void;
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
        <StatCard icon={<Clock3 />} label="Today" value={snapshot?.today_text ?? '0m'} subtext={`${snapshot?.heartbeat_count ?? 0} heartbeats`} />
        <StatCard icon={<Activity />} label="This session" value={formatDuration(snapshot?.session_seconds ?? 0)} subtext="desktop tracker only" />
        <StatCard icon={<Monitor />} label="Foreground" value={runtime?.app_name ?? '—'} subtext={runtime?.category ? categoryLabel(runtime.category) : 'waiting for activity'} compact />
        <StatCard
          icon={snapshot?.api_connected ? <Radio /> : <CloudOff />}
          label="Cloud"
          value={snapshot?.api_connected ? 'Connected' : 'Offline'}
          subtext={snapshot?.queued_seconds ? `${formatDuration(snapshot.queued_seconds)} queued` : 'offline queue protected'}
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
