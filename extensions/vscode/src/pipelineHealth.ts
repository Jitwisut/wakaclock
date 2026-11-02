/** Metadata contract shared with the dashboard (kept identical by regression).
 * Independent stages are ranked together; queue emptiness never proves capture.
 */
export interface PipelineStage {
  adapter_id: string;
  error_code: null | string;
  execution_surface: string;
  failure_count: number;
  last_observed_at: null | string;
  oldest_pending_at: null | string;
  pending: null | number;
  stage: string;
  status: string;
  version: string;
}
export type HealthState =
  | 'complete'
  | 'critical'
  | 'pending'
  | 'stale'
  | 'unavailable'
  | 'unknown'
  | 'warning';
export const healthRank: Record<HealthState, number> = {
  complete: 0,
  pending: 1,
  unknown: 2,
  stale: 3,
  unavailable: 4,
  warning: 5,
  critical: 6,
};
// Stage checks are ordered by severity; keep them together so precedence stays readable.
// eslint-disable-next-line sonarjs/cognitive-complexity
export function assessPipeline(
  stages: PipelineStage[] | undefined,
  now = Date.now()
): { stage?: PipelineStage; state: HealthState } {
  if (!stages?.length) return { state: 'unknown' };
  let result: { stage?: PipelineStage; state: HealthState } = { state: 'complete' };
  for (const stage of stages) {
    const observed = stage.last_observed_at ? Date.parse(stage.last_observed_at) : Number.NaN;
    const oldest = stage.oldest_pending_at ? Date.parse(stage.oldest_pending_at) : Number.NaN;
    const { pending } = stage;
    const age = Number.isFinite(oldest) ? (now - oldest) / 1000 : 0;
    let state: HealthState;
    if (
      stage.failure_count > 0 ||
      ['auth_required', 'dead_letter', 'capture_failure'].includes(stage.status) ||
      (pending != null && pending > 0 && age > 1800)
    ) {
      state = 'critical';
    } else if (pending != null && pending > 0 && age > 300) state = 'warning';
    else if (['unavailable', 'paused_by_user'].includes(stage.status)) state = 'unavailable';
    else if (stage.status === 'stale' || (Number.isFinite(observed) && now - observed > 300_000)) {
      state = 'stale';
    } else if (
      !Number.isFinite(observed) ||
      observed > now + 300_000 ||
      pending == null ||
      ['unresolved', 'unconfirmed'].includes(stage.status)
    ) {
      state = 'unknown';
    } else if (pending > 0 || stage.status === 'pending') state = 'pending';
    else state = stage.status === 'observed' ? 'complete' : 'unknown';
    if (healthRank[state] > healthRank[result.state]) result = { state, stage };
  }
  return result;
}

/** Only transitions in state/error notify. Poll timestamps and growing counts do not. */
export function pipelineTransitionKey(stages: PipelineStage[] | undefined): string {
  return JSON.stringify(
    (stages ?? [])
      .map((stage) => [
        stage.adapter_id,
        stage.execution_surface,
        stage.stage,
        stage.status,
        stage.error_code,
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  );
}
