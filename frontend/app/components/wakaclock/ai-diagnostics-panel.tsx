'use client';

import type { AiDiagnosticsReport } from '@/lib/wakaclock/types';

/**
 * Local AI-detection health, pushed from `wakaclock doctor ai` (planai2 p7.2c).
 *
 * The hosted dashboard cannot see the local broker or the transcript parser, so
 * the client posts a sanitized snapshot: inbox counts, parser-lag aggregates
 * and per-adapter freshness — never a prompt, diff, path or transcript line.
 * `report` is `null` until the client has pushed one (or since a server
 * restart — the store is process-local).
 */
export interface AiDiagnosticsPanelProps {
  report: AiDiagnosticsReport | null;
}

function relativeAge(unix?: null | number): string {
  if (unix == null) return 'never';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (seconds < 90) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

export function AiDiagnosticsPanel({ report }: AiDiagnosticsPanelProps) {
  if (!report) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-medium">Local detection health</h3>
        <p className="text-xs text-muted-foreground">
          No local diagnostics received yet. Run <code>wakaclock doctor ai</code> on a machine
          where the broker is active to push a snapshot.
        </p>
      </div>
    );
  }

  const { adapters, broker, parser } = report;
  const pipeline = report.pipeline ?? [];
  const brokerWarn = !broker.running || broker.inbox_dead_letter > 0 || Boolean(broker.last_error_code);
  const parserWarn = parser.transcripts_behind > 0;

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Local detection health</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">
            Broker{' '}
            <span className={brokerWarn ? 'text-destructive' : 'text-muted-foreground'}>
              {broker.running ? 'running' : 'stopped'}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            inbox {broker.inbox_pending} pending · {broker.inbox_retry} retry ·{' '}
            {broker.inbox_dead_letter} dead-letter
          </p>
          {broker.last_error_code ? (
            <p className="mt-1 text-xs text-destructive">last error: {broker.last_error_code}</p>
          ) : null}
        </div>

        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Transcript parser</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {parser.transcripts_watched} watched · {parser.transcripts_behind} behind
          </p>
          <p className={`mt-1 text-xs ${parserWarn ? 'text-destructive' : 'text-muted-foreground'}`}>
            max lag {parser.max_lag_seconds}s
          </p>
        </div>

        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Adapters</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {adapters.filter((a) => a.detected).length} detected ·{' '}
            {adapters.filter((a) => a.enabled).length} enabled
          </p>
        </div>
      </div>

      {adapters.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {adapters.map((adapter) => (
            <li
              className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-md border px-3 py-2 text-xs"
              key={adapter.agent}
            >
              <span className="font-medium">{adapter.agent}</span>
              <span className="text-muted-foreground">
                {adapter.detected ? 'detected' : 'not detected'} ·{' '}
                {adapter.enabled ? 'enabled' : 'disabled'} · {adapter.verification} · last evidence{' '}
                {relativeAge(adapter.last_evidence_unix)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {pipeline.length > 0 ? (
        <div className="mt-3 rounded-md border p-3">
          <p className="text-sm font-medium">Detection pipeline</p>
          <ul className="mt-2 space-y-1 text-xs">
            {pipeline.map((state) => (
              <li className="flex flex-wrap justify-between gap-2" key={state.agent}>
                <span className="font-medium">{state.agent}</span>
                <span className={state.stage === 'rejected' ? 'text-destructive' : 'text-muted-foreground'}>
                  {state.stage.replaceAll('_', ' ')}
                  {state.rejection_reason ? ` (${state.rejection_reason})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
