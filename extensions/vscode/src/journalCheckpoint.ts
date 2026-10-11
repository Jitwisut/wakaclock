/** Validate the recovery shape before the buffer consumes a checkpoint.
 * Payload validation and conflict detection still occur at durable CLI handoff.
 */
export function validateEditorCheckpoint(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const fileState = (v: unknown) => object(v) && typeof v.entity === "string" && Array.isArray(v.pendingEditorChanges) && Array.isArray(v.activitySegments);
  const pairs = (v: unknown, check: (v: unknown) => boolean) => Array.isArray(v) && v.every(pair => Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string" && check(pair[1]));
  if (!Array.isArray(state.states) || !state.states.every(fileState) || !Array.isArray(state.detached) || !state.detached.every(fileState)) return false;
  if (!pairs(state.retries, v => Array.isArray(v) && v.every(snapshot => object(snapshot) && object(snapshot.payload) && typeof snapshot.payload.heartbeat_id === "string"))) return false;
  if (state.rejections !== undefined && !pairs(state.rejections, v => typeof v === "string")) return false;
  if (state.external !== undefined && !pairs(state.external, v => object(v) && typeof v.entity === "string" && typeof v.now === "number" && Number.isFinite(v.now) && object(v.metadata))) return false;
  if (state.externalPayloads !== undefined && !pairs(state.externalPayloads, v => object(v) && typeof v.heartbeat_id === "string")) return false;
  return true;
}
