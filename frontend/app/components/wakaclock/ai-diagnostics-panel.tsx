'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryState } from '@/components/wakaclock/query-state';
import { formatIntegrationAgentName } from '@/lib/wakaclock/ai-display';
import type {
  AiDiagnosticsMeasurement,
  AiDiagnosticsReport,
  AiDiagnosticsReportV2,
  AiVerificationStatus,
} from '@/lib/wakaclock/types';

export interface AiDiagnosticsPanelProps {
  error?: unknown;
  isLoading?: boolean;
  report: AiDiagnosticsReport | AiDiagnosticsReportV2 | null | undefined;
}

const verificationLabels: Record<AiVerificationStatus, string> = {
  installed: 'Installed',
  live_tested: 'Live-tested',
  scaffold: 'Scaffold',
  unsupported: 'Unsupported',
  unverified: 'Unverified',
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

function measurementText<T>(
  measurement: AiDiagnosticsMeasurement<T>,
  format: (value: T) => string
): string {
  if (measurement.availability !== 'available' || measurement.value == null) {
    return measurement.availability;
  }
  return format(measurement.value);
}

function DiagnosticsV2Body({ report }: { report: AiDiagnosticsReportV2 }) {
  const { adapters, broker, parser } = report;
  const brokerState = measurementText(broker.running, (value) => (value ? 'running' : 'stopped'));
  const pending = measurementText(broker.pending, String);
  const retry = measurementText(broker.retry, String);
  const deadLetter = measurementText(broker.dead_letter, String);
  const watched = measurementText(parser.transcripts_watched, String);
  const behind = measurementText(parser.transcripts_behind, String);
  const lag = measurementText(parser.max_lag_seconds, (value) => `${value}s`);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Device {report.device_id} · {report.runtime_health} · nullable probe values preserve unavailable state.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Broker <span className="text-muted-foreground">{brokerState}</span></p>
          <p className="text-muted-foreground mt-1 text-xs">{pending} pending · {retry} retry · {deadLetter} dead-letter</p>
          {broker.last_error_code ? <p className="text-destructive mt-1 text-xs">last error: {broker.last_error_code}</p> : null}
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Transcript parser</p>
          <p className="text-muted-foreground mt-1 text-xs">{watched} watched · {behind} behind</p>
          <p className="text-muted-foreground mt-1 text-xs">max lag {lag}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Adapters</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {adapters.filter((adapter) => adapter.detected.value === true).length} detected ·{' '}
            {adapters.filter((adapter) => adapter.enabled.value === true).length} enabled
          </p>
        </div>
      </div>
      {adapters.length > 0 ? (
        <ul className="space-y-1">
          {adapters.map((adapter) => (
            <li className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-md border px-3 py-2 text-xs" key={adapter.agent}>
              <span className="font-medium">{formatIntegrationAgentName(adapter.agent)}</span>
              <span className="text-muted-foreground">
                {measurementText(adapter.detected, (value) => (value ? 'detected' : 'not detected'))} ·{' '}
                {measurementText(adapter.enabled, (value) => (value ? 'enabled' : 'disabled'))} ·{' '}
                {verificationLabels[adapter.verification]} · {adapter.runtime_health}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted-foreground text-xs">No adapters reported yet.</p>}
    </div>
  );
}

function DiagnosticsBody({ report }: { report: AiDiagnosticsReport }) {
  const { adapters, broker, parser } = report;
  const pending = broker.pending ?? broker.inbox_pending ?? 0;
  const retry = broker.retry ?? broker.inbox_retry ?? 0;
  const deadLetter = broker.dead_letter ?? broker.inbox_dead_letter ?? 0;
  const brokerHealthy = broker.running && deadLetter === 0 && !broker.last_error_code;
  const parserHealthy = parser.transcripts_behind === 0;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
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
          <p className="text-muted-foreground mt-1 text-xs">
            {pending} pending · {retry} retry · {deadLetter} dead-letter
          </p>
          {broker.last_error_code ? (
            <p className="text-destructive mt-1 text-xs">last error: {broker.last_error_code}</p>
          ) : null}
        </div>

        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Transcript parser</p>
          <p className="text-muted-foreground mt-1 text-xs">
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
          <p className="text-muted-foreground mt-1 text-xs">
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
              <span className="font-medium">{formatIntegrationAgentName(adapter.agent)}</span>
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
        <p className="text-muted-foreground text-xs">No adapters reported yet.</p>
      )}
    </div>
  );
}

export function AiDiagnosticsPanel({ error, isLoading = false, report }: AiDiagnosticsPanelProps) {
  let reportBody = null;
  if (report) {
    reportBody =
      report.schema_version === 2 ? <DiagnosticsV2Body report={report} /> : <DiagnosticsBody report={report} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Local AI diagnostics</CardTitle>
        <p className="text-muted-foreground text-sm">
          Observer health and adapter readiness; attribution remains disabled until live evidence is
          certified.
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
          {reportBody}
        </QueryState>
      </CardContent>
    </Card>
  );
}
