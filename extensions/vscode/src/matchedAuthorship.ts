import { createHash } from "node:crypto";
import * as path from "node:path";
import type { AiEditEvent } from "./aiAttribution";

export interface AuthorshipRequest {
  heartbeat_id: string; base_revision: number; agent: "claude-code";
  evidence_id: string; proof: "fingerprint" | "tool_id"; digest: string;
  operation?: "match" | "revoke";
}
export interface AuthorshipObservation {
  heartbeatId: string; revision: number; scope: string; entity: string; timeMs: number;
  fingerprint?: string; toolId?: string; expiresAt: number;
  request?: AuthorshipRequest; operationKey?: string; acknowledged?: boolean; conflicted?: boolean;
  proofVersion?: 1;
  reviewedLegacyProof?: boolean;
  lastAttemptAt?: number;
  blockedReason?: "unverified_legacy_fingerprint";
}

export function retainAuthorshipObservation(observation: AuthorshipObservation, now: number): boolean {
  return observation.expiresAt > now ||
    (!!observation.request && (!observation.acknowledged || !!observation.blockedReason));
}

export function parkUnverifiedAuthorship(observation: AuthorshipObservation): void {
  if (observation.request?.proof === "fingerprint" &&
      observation.request.operation !== "revoke" &&
      observation.proofVersion !== 1 && observation.reviewedLegacyProof !== true) {
    observation.blockedReason = "unverified_legacy_fingerprint";
  } else {
    delete observation.blockedReason;
  }
}

export function isAuthorshipAcknowledgement(
  request: AuthorshipRequest, receipt: { digest: string; status: string },
): boolean {
  return receipt.digest === request.digest && (receipt.status === "revoked" ||
    receipt.status === "conflict" || (receipt.status === "matched" && request.operation !== "revoke"));
}
export const AUTHORSHIP_TTL_MS = 86_400_000;

/** Merge recovered display state without allowing directory order to erase a revoke. */
export function mergeRecoveredAuthorship(observations: readonly AuthorshipObservation[]): AuthorshipObservation[] {
  const groups = new Map<string, AuthorshipObservation[]>();
  for (const observation of observations) {
    const key = JSON.stringify([observation.scope, observation.heartbeatId, observation.revision]);
    groups.set(key, [...groups.get(key) ?? [], observation]);
  }
  const result: AuthorshipObservation[] = [];
  for (const [, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const bindings = new Map<string, AuthorshipObservation[]>();
    for (const observation of group) if (observation.request) {
      const r = observation.request;
      const key = JSON.stringify([r.heartbeat_id, r.base_revision, r.agent, r.evidence_id, r.proof, r.digest]);
      bindings.set(key, [...bindings.get(key) ?? [], observation]);
    }
    const identityConflict = new Set(group.map(o => JSON.stringify([
      o.entity, o.timeMs, o.fingerprint ?? null, o.toolId ?? null,
    ]))).size > 1;
    const operationKeys = [...new Set(group.flatMap(o => o.operationKey ? [o.operationKey] : []))].sort();
    const conflict = identityConflict || bindings.size > 1 || operationKeys.length > 1 || group.some(o => o.conflicted);
    const variants = bindings.size ? [...bindings].sort(([a], [b]) => a.localeCompare(b)).map(([, values]) => values) : [group];
    for (const variantsForBinding of variants) {
      const ordered = [...variantsForBinding].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const merged: AuthorshipObservation = { ...ordered[0] };
      if (merged.request) merged.request = { ...merged.request };
      if (operationKeys.length === 1) merged.operationKey = operationKeys[0];
      merged.expiresAt = Math.max(...group.map(o => o.expiresAt));
      merged.acknowledged = variantsForBinding.every(o => o.acknowledged === true);
      if (conflict) merged.conflicted = true;
      const revoke = conflict || group.some(o => o.request?.operation === "revoke");
      if (merged.request && revoke) {
        merged.request.operation = "revoke";
        // A match acknowledgement never acknowledges the merged revoke.
        merged.acknowledged = variantsForBinding.every(o =>
          o.request?.operation === "revoke" && o.acknowledged === true);
        delete merged.blockedReason;
      }
      if (!variantsForBinding.every(o => o.proofVersion === 1)) delete merged.proofVersion;
      if (!variantsForBinding.every(o => o.reviewedLegacyProof === true)) delete merged.reviewedLegacyProof;
      const attempts = variantsForBinding.map(o => o.lastAttemptAt);
      if (attempts.every((value): value is number => value !== undefined)) merged.lastAttemptAt = Math.min(...attempts);
      else delete merged.lastAttemptAt;
      parkUnverifiedAuthorship(merged);
      result.push(merged);
    }
  }
  return result;
}
const normalize = (entity: string) => path.resolve(entity).replace(/\\/g, "/");
const fingerprint = (value: unknown): value is string => typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
const operationKey = (event: AiEditEvent) => JSON.stringify([
  event.agent, event.session_id ?? null, normalize(event.entity),
  event.tool_event_id ?? event.canonical_operation_id ?? event.event_id,
]);

/** Display evidence only. Never consumes classifier evidence or changes measured activity. */
export function reconcileAuthorship(observations: AuthorshipObservation[], events: readonly AiEditEvent[], now: number): AuthorshipObservation[] {
  for (const observation of observations) parkUnverifiedAuthorship(observation);
  const live = observations.filter(o => retainAuthorshipObservation(o, now));
  for (const o of live) {
    const candidates = new Map<string, { event: AiEditEvent; proof: AuthorshipRequest["proof"] }>();
    for (const event of events) {
      if (event.owner_scope_id !== o.scope ||
          normalize(event.entity) !== normalize(o.entity) || Math.abs(event.time * 1000 - o.timeMs) > 15_000) continue;
      const proof = o.toolId && event.tool_event_id === o.toolId ? "tool_id" :
        fingerprint(o.fingerprint) && (event.agent === "claude-code"
          ? event.authorship_proof_version === 1 && event.authorship_fingerprint === o.fingerprint
          : event.content_fingerprint === o.fingerprint) ? "fingerprint" : undefined;
      if (!proof) continue;
      const key = operationKey(event);
      const previous = candidates.get(key);
      if (!previous || (previous.proof !== proof ? proof === "tool_id" : event.event_id < previous.event.event_id)) {
        candidates.set(key, {event, proof});
      }
    }
    if (candidates.size > 1 || (o.operationKey && [...candidates.keys()].some(key => key !== o.operationKey))) {
      o.conflicted = true;
    }
    if (!o.request && o.expiresAt > now && !o.conflicted && candidates.size === 1) {
      const [key, {event, proof}] = [...candidates.entries()][0];
      if (event.agent !== "claude-code") continue;
      // The server uses this reference to detect reuse across different heartbeat
      // IDs. Hook and transcript copies need the same reference, even when
      // separate clients have seen only one of the two producer records.
      const evidence = event.session_id && event.tool_event_id &&
        !event.tool_event_id.startsWith("claude-code-")
        ? `claude-operation-${createHash("sha256").update(key).digest("hex")}`
        : event.event_id;
      o.operationKey = key;
      if (proof === "fingerprint") o.proofVersion = 1;
      o.request = {heartbeat_id:o.heartbeatId,base_revision:o.revision,agent:"claude-code",evidence_id:evidence,proof,
        digest:createHash("sha256").update(JSON.stringify([o.scope,o.heartbeatId,o.revision,"claude-code",evidence,proof])).digest("hex")};
    }
  }
  // One producer operation cannot label two editor observations.
  const owners = new Map<string, AuthorshipObservation[]>();
  for (const o of live) if (o.request) {
    const key = `${o.scope}:${o.operationKey ?? o.request.evidence_id}`;
    owners.set(key, [...owners.get(key) ?? [], o]);
  }
  for (const group of owners.values()) if (group.length > 1) for (const o of group) o.conflicted = true;
  for (const o of live) if (o.conflicted && o.request && o.request.operation !== "revoke") {
    o.request = { ...o.request, operation: "revoke" };
    o.acknowledged = false;
    delete o.blockedReason;
    delete o.lastAttemptAt;
  }
  return live;
}
