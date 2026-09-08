'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryState } from '@/components/wakaclock/query-state';
import {
  aiAdapterGuidance,
  aiRuntimeGuidance,
  formatIntegrationAgentName,
} from '@/lib/wakaclock/ai-display';
import type {
  AiAdapterFreshnessV2,
  AiDiagnosticsMeasurement,
  AiDiagnosticsReport,
  AiDiagnosticsReportV2,
  AiVerificationStatus,
} from '@/lib/wakaclock/types';

export interface AiDiagnosticsPanelProps {
  error?: unknown;
  isLoading?: boolean;
  report: AiDiagnosticsReport | AiDiagnosticsReportV2 | null | undefined;
  reports?: AiDiagnosticsReportV2[];
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

function relativeIsoAge(value?: null | string): string {
  if (!value) return 'never';
  const unix = Date.parse(value) / 1000;
  return Number.isFinite(unix) ? relativeAge(unix) : 'unavailable';
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

function certificationLabel(adapter: AiAdapterFreshnessV2): string {
  if (adapter.certification_status === 'certification_verified') {
    return adapter.certificate_id ? `Certified · ${adapter.certificate_id}` : 'Certified';
  }
  if (adapter.certification_status === 'certification_expired') return 'Certification expired';
  if (adapter.certification_status === 'certification_revoked') return 'Certification revoked';
  if (adapter.certification_status === 'certification_mismatch') return 'Tuple mismatch';
  if (adapter.certification_status === 'certification_historical') return 'Historical evidence';
  return adapter.verification === 'unverified'
    ? 'Certification not reported'
    : `Reported ${verificationLabels[adapter.verification]}`;
}

function Guidance({
  code,
  guidance,
}: {
  code?: null | string;
  guidance: ReturnType<typeof aiRuntimeGuidance>;
}) {
  return (
    <div className="bg-muted/30 mt-2 rounded-md border p-2 text-xs">
      <p className="font-medium">{guidance.label}</p>
      <p className="text-muted-foreground mt-1">{guidance.detail}</p>
      {code ? (
        <details className="text-muted-foreground mt-1">
          <summary className="cursor-pointer">Advanced details</summary>
          <code className="mt-1 block">{code}</code>
        </details>
      ) : null}
    </div>
  );
}

function DiagnosticsV2Device({ report }: { report: AiDiagnosticsReportV2 }) {
  const { adapters, broker, parser } = report;
  const brokerState = measurementText(broker.running, (value) => (value ? 'running' : 'stopped'));
  const pending = measurementText(broker.pending, String);
  const retry = measurementText(broker.retry, String);
  const deadLetter = measurementText(broker.dead_letter, String);
  const watched = measurementText(parser.transcripts_watched, String);
  const behind = measurementText(parser.transcripts_behind, String);
  const lag = measurementText(parser.max_lag_seconds, (value) => `${value}s`);
  const runtimeGuidance = aiRuntimeGuidance(report.runtime_health, report.consent);

  return (
    <article aria-label={`Device ${report.device_id}`} className="space-y-4 rounded-md border p-3">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">Device {report.device_id}</h3>
          <span className="text-muted-foreground text-xs">boot {report.boot_id}</span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Runtime {report.runtime_health} · sequence {report.sequence} · unavailable measurements
          stay separate from measured zero.
        </p>
        <Guidance code={undefined} guidance={runtimeGuidance} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">
            Broker <span className="text-muted-foreground">{brokerState}</span>
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {pending} pending · {retry} retry · {deadLetter} dead-letter
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            last delivery {relativeIsoAge(broker.last_delivery_at)}
          </p>
          {broker.last_error_code ? (
            <p className="text-destructive mt-1 text-xs">last error: {broker.last_error_code}</p>
          ) : null}
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Transcript parser</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {watched} watched · {behind} behind
          </p>
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
        <section aria-label={`Capabilities for ${report.device_id}`}>
          <h4 className="mb-2 text-sm font-medium">Adapter capabilities</h4>
          <ul className="space-y-1">
            {adapters.map((adapter) => (
              <li
                className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-md border px-3 py-2 text-xs"
                key={adapter.agent}
              >
                <div>
                  <span className="font-medium">{formatIntegrationAgentName(adapter.agent)}</span>
                  <span className="text-muted-foreground ml-2">
                    {measurementText(adapter.detected, (value) =>
                      value ? 'detected' : 'not detected'
                    )}{' '}
                    ·{' '}
                    {measurementText(adapter.enabled, (value) => (value ? 'enabled' : 'disabled'))}{' '}
                    · {certificationLabel(adapter)} · runtime {adapter.runtime_health}
                  </span>
                  <dl className="text-muted-foreground mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                    <div>
                      <dt className="inline font-medium">Last event: </dt>
                      <dd className="inline">{relativeIsoAge(adapter.last_evidence_at)}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Tested coverage: </dt>
                      <dd className="inline">{certificationLabel(adapter)}</dd>
                    </div>
                  </dl>
                  <Guidance code={adapter.diagnostic_code} guidance={aiAdapterGuidance(adapter)} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-muted-foreground text-xs">No adapters reported yet.</p>
      )}
    </article>
  );
}

function DiagnosticsV2Body({ reports }: { reports: AiDiagnosticsReportV2[] }) {
  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <DiagnosticsV2Device key={`${report.device_id}:${report.boot_id}`} report={report} />
      ))}
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

export function AiDiagnosticsPanel({
  error,
  isLoading = false,
  report,
  reports = [],
}: AiDiagnosticsPanelProps) {
  let reportBody = null;
  if (reports.length > 0) {
    reportBody = <DiagnosticsV2Body reports={reports} />;
  } else if (report) {
    reportBody =
      report.schema_version === 2 ? (
        <DiagnosticsV2Body reports={[report]} />
      ) : (
        <DiagnosticsBody report={report} />
      );
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
          isEmpty={!isLoading && !error && !report && reports.length === 0}
          isLoading={isLoading}
        >
          {reportBody}
        </QueryState>
      </CardContent>
    </Card>
  );
}
