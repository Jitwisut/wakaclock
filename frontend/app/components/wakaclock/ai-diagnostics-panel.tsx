'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryState } from '@/components/wakaclock/query-state';
import type { AiDiagnosticsReport, AiVerificationStatus } from '@/lib/wakaclock/types';

export interface AiDiagnosticsPanelProps {
  error?: unknown;
  isLoading?: boolean;
  report: AiDiagnosticsReport | null | undefined;
}

const verificationLabels: Record<AiVerificationStatus, string> = {
  installed: 'Installed',
  live_tested: 'Live-tested',
  scaffold: 'Scaffold',
  unsupported: 'Unsupported',
  verified: 'Verified',
};

function relativeAge(unix?: null | number): string {
  if (unix == null) return 'never';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (seconds < 90) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

function DiagnosticsBody({ report }: { report: AiDiagnosticsReport }) {
  const { adapters, broker, parser } = report;
  const brokerHealthy = broker.running && broker.dead_letter === 0 && !broker.last_error_code;
  const parserHealthy = parser.transcripts_behind === 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Diagnostics-only: this health snapshot never identifies an AI author or sends local
        evidence.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">
            Broker{' '}
            <span className={brokerHealthy ? 'text-muted-foreground' : 'text-destructive'}>
              {broker.running ? 'running' : 'stopped'}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {broker.pending} pending · {broker.retry} retry · {broker.dead_letter} dead-letter
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
          <p
            className={`mt-1 text-xs ${parserHealthy ? 'text-muted-foreground' : 'text-destructive'}`}
          >
            max lag {parser.max_lag_seconds}s
          </p>
        </div>

        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Adapters</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {adapters.filter((adapter) => adapter.detected).length} detected ·{' '}
            {adapters.filter((adapter) => adapter.enabled).length} enabled
          </p>
        </div>
      </div>

      {adapters.length > 0 ? (
        <ul className="space-y-1">
          {adapters.map((adapter) => (
            <li
              className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-md border px-3 py-2 text-xs"
              key={adapter.agent}
            >
              <span className="font-medium">{adapter.agent}</span>
              <span className="text-muted-foreground">
                {adapter.detected ? 'detected' : 'not detected'} ·{' '}
                {adapter.enabled ? 'enabled' : 'disabled'} ·{' '}
                {verificationLabels[adapter.verification]} · last evidence{' '}
                {relativeAge(adapter.last_evidence_unix)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No adapters reported yet.</p>
      )}
    </div>
  );
}

export function AiDiagnosticsPanel({ error, isLoading = false, report }: AiDiagnosticsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Local AI diagnostics</CardTitle>
        <p className="text-sm text-muted-foreground">
          Observer health and adapter readiness; attribution remains disabled until live evidence
          is certified.
        </p>
      </CardHeader>
      <CardContent>
        <QueryState
          emptyDescription="Run wakaclock ai doctor on a machine with the local observer to push a metadata-only snapshot."
          emptyTitle="No diagnostics snapshot"
          error={error}
          isEmpty={!isLoading && !error && !report}
          isLoading={isLoading}
        >
          {report ? <DiagnosticsBody report={report} /> : null}
        </QueryState>
      </CardContent>
    </Card>
  );
}
