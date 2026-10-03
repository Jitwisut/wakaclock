import { unwrapV2, wakaclockV2Client } from './client-v2';

import type { OperationEvidencePage } from './measurement-types';
import type { AiStatsData, V2Envelope } from './types';

export interface MeasuredValue {
  coverage: { reported_events: number; status: string; total_events: number };
  value: null | number;
}
export interface SessionSummary {
  agent: string;
  first_observed_at: number;
  id: string;
  identity_status: string;
  last_observed_at: number;
  usage_events: number;
}
export type Outcome = 'abandoned' | 'completed' | 'needs_work';
export interface WorkSessionReceipt {
  agent: string;
  calculation_version: string;
  diagnostics: {
    coverage_basis: string;
    latest_received_at: null | number;
    max_ingestion_lag_seconds: null | number;
    unmatched_operations: null | number;
    unmatched_reason: string;
  };
  evidence_count: number;
  evidence_references: string[];
  evidence_references_truncated: boolean;
  generated_at: string;
  id: string;
  identity_status: string;
  lines: {
    inferred_operations: number;
    reason: null | string;
    unknown_operations: number;
    verified_ai_added: MeasuredValue;
    verified_ai_deleted: MeasuredValue;
  };
  observed_window: { end: number; is_execution_time: false; kind: string; start: number };
  outcome: { updated_at: string; value: null | Outcome; version: number } | null;
  outcome_available: boolean;
  outcome_source: 'user_reported';
  project_ids: string[];
  projects?: { id: string; name: string }[];
  revision_fingerprint: string;
  runtime_status: string;
  schema_version: number;
  time: {
    additive_across_receipts: false;
    agent_execution_seconds: null | number;
    combined_observed_seconds: null | number;
    human_context_reason: string;
    human_context_seconds: null | number;
    overlap_seconds: null | number;
    reason: string;
  };
  usage: {
    cache_read_tokens: MeasuredValue;
    cache_write_tokens: MeasuredValue;
    estimated_cost_microusd: MeasuredValue;
    input_tokens: MeasuredValue;
    output_tokens: MeasuredValue;
    pricing_versions: string[];
    prompt_characters: MeasuredValue;
    unassigned_estimated_cost_microusd: MeasuredValue;
    unassigned_project_events: number;
  };
  usage_events: number;
}
export interface SessionFilters {
  agent?: string;
  end: string;
  project_id?: string;
  start: string;
  timezone: string;
}
export const sessionKeys = {
  detail: (user: string, id: string) => ['wakaclock', user, 'work-session', id] as const,
  evidence: (user: string, id: string, revision?: string) =>
    ['wakaclock', user, 'work-session', id, 'evidence', revision] as const,
  list: (user: string, filters: SessionFilters) =>
    ['wakaclock', user, 'work-sessions', filters] as const,
};
export async function getWorkSessions(filters: SessionFilters, cursor?: string) {
  return unwrapV2(
    await wakaclockV2Client.get<
      V2Envelope<{ has_more: boolean; items: SessionSummary[]; next_cursor: null | string }>
    >('/me/work-sessions', { params: { ...filters, cursor, limit: 25 } })
  );
}
export async function getWorkSession(id: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<WorkSessionReceipt>>(
      `/me/work-sessions/${encodeURIComponent(id)}`
    )
  );
}
export async function getSessionEvidence(id: string, cursor?: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OperationEvidencePage>>(
      `/me/work-sessions/${encodeURIComponent(id)}/evidence`,
      { params: { cursor, limit: 25 } }
    )
  );
}
export async function setSessionOutcome(id: string, outcome: null | Outcome) {
  const url = `/me/work-sessions/${encodeURIComponent(id)}/outcome`;
  if (outcome == null) await wakaclockV2Client.delete(url);
  else await wakaclockV2Client.put(url, { outcome });
}
export interface EffectivenessData {
  metrics_v2?: {
    ai_line_share: null | number;
    denominator: number;
    human_line_share: null | number;
    semantics_version: string;
    unknown_line_share: null | number;
  };
  stats: AiStatsData;
}
export async function getEffectiveness(start: string, end: string, timezone = 'UTC') {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<EffectivenessData>>('/me/ai/effectiveness', {
      params: { start, end, timezone },
    })
  );
}
const measure = (m: MeasuredValue) => ({
  value: m.value,
  coverage: {
    reported_events: m.coverage.reported_events,
    total_events: m.coverage.total_events,
    status: m.coverage.status,
  },
});

/** Explicit allowlist: never serialize an arbitrary server response or evidence payload. */
export function receiptExport(receipt: WorkSessionReceipt) {
  return JSON.stringify(
    {
      schema_version: receipt.schema_version,
      calculation_version: receipt.calculation_version,
      generated_at: receipt.generated_at,
      revision_fingerprint: receipt.revision_fingerprint,
      id: receipt.id,
      agent: receipt.agent,
      runtime_status: receipt.runtime_status,
      identity_status: receipt.identity_status,
      observed_window: {
        start: receipt.observed_window.start,
        end: receipt.observed_window.end,
        kind: receipt.observed_window.kind,
        is_execution_time: false,
      },
      project_ids: receipt.project_ids,
      usage_events: receipt.usage_events,
      usage: {
        input_tokens: measure(receipt.usage.input_tokens),
        output_tokens: measure(receipt.usage.output_tokens),
        cache_read_tokens: measure(receipt.usage.cache_read_tokens),
        cache_write_tokens: measure(receipt.usage.cache_write_tokens),
        prompt_characters: measure(receipt.usage.prompt_characters),
        estimated_cost_microusd: measure(receipt.usage.estimated_cost_microusd),
        pricing_versions: receipt.usage.pricing_versions,
        unassigned_project_events: receipt.usage.unassigned_project_events,
        unassigned_estimated_cost_microusd: measure(
          receipt.usage.unassigned_estimated_cost_microusd
        ),
      },
      time: {
        human_context_seconds: receipt.time.human_context_seconds,
        agent_execution_seconds: receipt.time.agent_execution_seconds,
        overlap_seconds: receipt.time.overlap_seconds,
        combined_observed_seconds: receipt.time.combined_observed_seconds,
        reason: receipt.time.reason,
        human_context_reason: receipt.time.human_context_reason,
        additive_across_receipts: false,
      },
      lines: {
        verified_ai_added: measure(receipt.lines.verified_ai_added),
        verified_ai_deleted: measure(receipt.lines.verified_ai_deleted),
        inferred_operations: receipt.lines.inferred_operations,
        unknown_operations: receipt.lines.unknown_operations,
        reason: receipt.lines.reason,
      },
      evidence_count: receipt.evidence_count,
      evidence_references: receipt.evidence_references,
      evidence_references_truncated: receipt.evidence_references_truncated,
      outcome: receipt.outcome
        ? {
            value: receipt.outcome.value,
            version: receipt.outcome.version,
            updated_at: receipt.outcome.updated_at,
          }
        : null,
      outcome_source: receipt.outcome_source,
      diagnostics: {
        latest_received_at: receipt.diagnostics.latest_received_at,
        max_ingestion_lag_seconds: receipt.diagnostics.max_ingestion_lag_seconds,
        coverage_basis: receipt.diagnostics.coverage_basis,
        unmatched_operations: receipt.diagnostics.unmatched_operations,
        unmatched_reason: receipt.diagnostics.unmatched_reason,
      },
    },
    null,
    2
  );
}
export function measuredLabel(metric: MeasuredValue): string {
  return metric.value == null ? 'Not available' : metric.value.toLocaleString();
}
