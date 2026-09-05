'use client';

import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import type { AdapterFreshness, AiDiagnosticsReport } from '@/lib/wakaclock/types';

export interface AiIntegrationsPanelProps {
  report: AiDiagnosticsReport | null;
}

type IntegrationStatus =
  | 'captured_locally'
  | 'degraded'
  | 'disabled'
  | 'healthy'
  | 'needs_setup'
  | 'needs_trust'
  | 'unsupported'
  | 'unverified';

function relativeAge(unix?: null | number): string {
  if (unix == null) return 'never';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (seconds < 90) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

export function integrationStatus(adapter: AdapterFreshness): IntegrationStatus {
  if (adapter.diagnostic_code === 'unsupported') return 'unsupported';
  if (adapter.diagnostic_code === 'disabled_by_policy') return 'disabled';
  if (!adapter.detected) return 'needs_setup';
  if (!adapter.enabled) return 'needs_trust';
  if (
    (adapter.pending_events ?? 0) > 0 ||
    (adapter.retry_events ?? 0) > 0 ||
    (adapter.dead_letter_events ?? 0) > 0 ||
    (adapter.transcript_lag_seconds ?? 0) > 300 ||
    Boolean(adapter.diagnostic_code)
  ) {
    return 'degraded';
  }
  if (adapter.last_evidence_unix != null && adapter.verification === 'verified') {
    return 'healthy';
  }
  if (adapter.last_evidence_unix != null) return 'captured_locally';
  return 'unverified';
}

const statusLabels: Record<IntegrationStatus, string> = {
  captured_locally: 'Captured locally',
  degraded: 'Degraded',
  disabled: 'Disabled by policy',
  healthy: 'Healthy',
  needs_setup: 'Needs setup',
  needs_trust: 'Needs trust',
  unsupported: 'Unsupported',
  unverified: 'Unverified',
};

function statusVariant(status: IntegrationStatus): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (status === 'healthy') return 'default';
  if (status === 'degraded' || status === 'needs_trust') return 'destructive';
  if (status === 'disabled') return 'secondary';
  if (status === 'captured_locally') return 'secondary';
  return 'outline';
}

export function AiIntegrationsPanel({ report }: AiIntegrationsPanelProps) {
  let integrationsBody: ReactNode = (
    <p className="text-xs text-muted-foreground">
      No integration health snapshot received. Run <code>wakaclock doctor ai</code> on a machine
      with the broker active.
    </p>
  );
  if (report) {
    if (report.adapters.length === 0) {
      integrationsBody = (
        <p className="text-xs text-muted-foreground">No adapters have been detected yet.</p>
      );
    } else {
      integrationsBody = (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="border-b bg-muted/30 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Provider / model</th>
                <th className="px-3 py-2 font-medium">Detection</th>
                <th className="px-3 py-2 font-medium">Verification</th>
                <th className="px-3 py-2 font-medium">Transport</th>
                <th className="px-3 py-2 font-medium">Last captured</th>
                <th className="px-3 py-2 font-medium">Delivery / queue</th>
              </tr>
            </thead>
            <tbody>
              {report.adapters.map((adapter) => {
                const status = integrationStatus(adapter);
                const pending = adapter.pending_events ?? 0;
                const retry = adapter.retry_events ?? 0;
                const deadLetter = adapter.dead_letter_events ?? 0;
                return (
                  <tr className="border-b last:border-0" key={adapter.agent}>
                    <td className="px-3 py-2 font-medium">
                      <div>{adapter.agent}</div>
                      <Badge className="mt-1" variant={statusVariant(status)}>
                        {statusLabels[status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {adapter.provider_id ?? 'unknown'} / {adapter.model_id ?? 'unknown'}
                    </td>
                    <td className="px-3 py-2">
                      {adapter.detected ? 'detected' : 'not detected'} ·{' '}
                      {adapter.enabled ? 'enabled' : 'disabled'}
                    </td>
                    <td className="px-3 py-2">{adapter.verification}</td>
                    <td className="px-3 py-2">{adapter.transport ?? 'unknown'}</td>
                    <td className="px-3 py-2">{relativeAge(adapter.last_evidence_unix)}</td>
                    <td className="px-3 py-2">
                      <div>{adapter.last_delivery_result ?? 'unknown'}</div>
                      <div className="text-muted-foreground">
                        {pending} pending · {retry} retry · {deadLetter} dead-letter
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
  }

  return (
    <section aria-label="AI integrations" className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">AI integrations</h3>
        <p className="text-xs text-muted-foreground">
          Detection, verification, and delivery are shown separately. Provider/model are the
          explicit labels reported by each client; unknown values are not inferred.
        </p>
      </div>
      {integrationsBody}
      <p className="text-[11px] text-muted-foreground">
        Health data contains metadata only. Prompts, responses, patches, source text, and file
        contents are never sent in this snapshot.
      </p>
    </section>
  );
}
