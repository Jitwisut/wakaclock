import { describe, expect, it } from "vitest";
import { mergeRecoveredAuthorship, type AuthorshipObservation } from "../src/matchedAuthorship";

const observation = (): AuthorshipObservation => ({
  scope: "scope", heartbeatId: "heartbeat", revision: 7, entity: "/file.ts",
  timeMs: 1000, expiresAt: 2000, fingerprint: "sha256:" + "a".repeat(64),
  proofVersion: 1, acknowledged: true, operationKey: "operation",
  request: { heartbeat_id: "heartbeat", base_revision: 7, agent: "claude-code",
    evidence_id: "evidence", proof: "fingerprint", digest: "b".repeat(64) },
});

describe("matched authorship journal recovery", () => {
  it("preserves a pending revoke regardless of recovery order and does not mutate input", () => {
    const match = observation();
    const revoke = observation();
    revoke.request!.operation = "revoke";
    revoke.conflicted = true;
    revoke.acknowledged = false;
    const before = JSON.stringify([match, revoke]);
    const merged = mergeRecoveredAuthorship([match, revoke]);
    expect(merged).toEqual(mergeRecoveredAuthorship([revoke, match]));
    expect(merged).toHaveLength(1);
    expect(merged[0].request).toEqual({ ...match.request, operation: "revoke" });
    expect(merged[0].acknowledged).toBe(false);
    expect(JSON.stringify([match, revoke])).toBe(before);
  });

  it("keeps every immutable request binding for revocation instead of choosing one", () => {
    const first = observation();
    const second = observation();
    second.request!.digest = "c".repeat(64);
    second.request!.evidence_id = "other-evidence";
    const merged = mergeRecoveredAuthorship([first, second]);
    expect(merged).toEqual(mergeRecoveredAuthorship([second, first]));
    expect(merged).toHaveLength(2);
    expect(new Set(merged.map(o => o.request!.digest))).toEqual(new Set([first.request!.digest, second.request!.digest]));
    for (const o of merged) {
      expect(o.request!.operation).toBe("revoke");
      expect(o.acknowledged).toBe(false);
      expect(o.conflicted).toBe(true);
      expect([o.heartbeatId, o.revision, o.timeMs]).toEqual(["heartbeat", 7, 1000]);
    }
  });

  it("lets unacknowledged updates dominate and parks legacy proofs", () => {
    const acknowledged = observation();
    const pending = observation();
    pending.acknowledged = false;
    delete pending.proofVersion;
    const [merged] = mergeRecoveredAuthorship([acknowledged, pending]);
    expect(merged.acknowledged).toBe(false);
    expect(merged.proofVersion).toBeUndefined();
    expect(merged.blockedReason).toBe("unverified_legacy_fingerprint");
  });

  it("fails closed on changed observation identity without changing the request binding", () => {
    const first = observation();
    const second = observation();
    second.fingerprint = "sha256:" + "d".repeat(64);
    const [merged] = mergeRecoveredAuthorship([first, second]);
    expect(merged.request).toEqual({ ...first.request, operation: "revoke" });
    expect(merged.conflicted).toBe(true);
  });

  it("keeps accounts and revisions separate", () => {
    const first = observation();
    const otherAccount = { ...observation(), scope: "other-scope" };
    const otherRevision = { ...observation(), revision: 8 };
    expect(mergeRecoveredAuthorship([first, otherAccount, otherRevision])).toHaveLength(3);
  });
});
