/** Metadata contract shared with the dashboard (kept identical by regression).
 * Independent stages are ranked together; queue emptiness never proves capture.
 */
export interface PipelineStage {
  adapter_id: string;
  execution_surface: string;
  stage: string;
  status: string;
  pending: number | null;
  failure_count: number;
  last_observed_at: string | null;
  oldest_pending_at: string | null;
  error_code: string | null;
  version: string;
}
export type HealthState =
  | 'complete'
  | 'critical'
  | 'warning'
  | 'unavailable'
  | 'stale'
  | 'unknown'
  | 'pending';
export const healthRank: Record<HealthState, number> = {
  complete: 0,
  pending: 1,
  unknown: 2,
  stale: 3,
  unavailable: 4,
  warning: 5,
  critical: 6,
};
export function assessPipeline(
  stages: PipelineStage[] | undefined,
  now = Date.now()
): { state: HealthState; stage?: PipelineStage } {
  if (!stages?.length) return { state: 'unknown' };
  let result: { state: HealthState; stage?: PipelineStage } = { state: 'complete' };
  for (const stage of stages) {
    const observed = stage.last_observed_at ? Date.parse(stage.last_observed_at) : NaN;
    const oldest = stage.oldest_pending_at ? Date.parse(stage.oldest_pending_at) : NaN;
    const pending = stage.pending;
    const age = Number.isFinite(oldest) ? (now - oldest) / 1000 : 0;
    let state: HealthState;
    if (
      stage.failure_count > 0 ||
      ['auth_required', 'dead_letter', 'capture_failure'].includes(stage.status) ||
      (pending != null && pending > 0 && age > 1800)
    )
      state = 'critical';
    else if (pending != null && pending > 0 && age > 300) state = 'warning';
    else if (['unavailable', 'paused_by_user'].includes(stage.status)) state = 'unavailable';
    else if (stage.status === 'stale' || (Number.isFinite(observed) && now - observed > 300000))
      state = 'stale';
    else if (
      !Number.isFinite(observed) ||
      observed > now + 300000 ||
      pending == null ||
      ['unresolved', 'unconfirmed'].includes(stage.status)
    )
      state = 'unknown';
    else if (pending > 0 || stage.status === 'pending') state = 'pending';
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
