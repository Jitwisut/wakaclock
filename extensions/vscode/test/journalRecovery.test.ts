import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeartbeatJournal } from "../src/heartbeatJournal";
import { inspectJournal, prepareJournalRecovery, applyJournalRecovery, journalHistory, recordJournalHandoffObservation } from "../src/journalRecovery";
import { validateEditorCheckpoint } from "../src/journalCheckpoint";
import { scanJournal } from "../src/journalScanner";
const faults = vi.hoisted(() => ({ point: "" }));
vi.mock("node:fs", async original => {
  const actual = await original<typeof import("node:fs")>();
  return { ...actual, renameSync(from: fs.PathLike, to: fs.PathLike) {
    if (faults.point === "before_activate" && String(to).endsWith("metadata.jsonl")) throw new Error("fixture_interruption");
    if (faults.point === "after_activate" && String(to).endsWith("manifest.json") && String(from).includes("manifest-") && actual.existsSync(String(to)) && JSON.parse(actual.readFileSync(String(to), "utf8")).phase === "candidate_written") throw new Error("fixture_interruption");
    actual.renameSync(from, to);
  } };
});
const dirs: string[] = [];
const validate = (v: unknown) => !!v && typeof v === "object";
function broken() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repair-fixture-")); dirs.push(dir);
  const journal = new HeartbeatJournal(dir); journal.append({ id: "original", time: 1234 }, 1); journal.close();
  fs.appendFileSync(path.join(dir, "metadata.jsonl"), '{"torn":'); return dir;
}
afterEach(() => { faults.point = ""; for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
describe("explicit journal recovery", () => {
  it("prepares without mutation and preserves the entire original while activating the verified checkpoint", () => {
    const dir = broken(); const file = path.join(dir, "metadata.jsonl"); const original = fs.readFileSync(file);
    const plan = prepareJournalRecovery(dir, "scope", validate);
    expect(fs.readFileSync(file)).toEqual(original); expect(plan.unknownRecords).toBeNull();
    const result = applyJournalRecovery(dir, plan, "scope", validate);
    expect(result.phase).toBe("activated"); expect(result.serverDelivery).toBe("unconfirmed");
    expect(fs.readFileSync(path.join(dir, "recovery", plan.recoveryId, "original.jsonl"))).toEqual(original);
    expect(fs.readFileSync(path.join(dir, "recovery", plan.recoveryId, "journal-identity.json"))).toEqual(fs.readFileSync(path.join(dir, "journal-identity.json")));
    expect(inspectJournal(dir, validate).historicalIncomplete).toBe(true);
    const next = new HeartbeatJournal(dir); expect(next.read()).toEqual({ id: "original", time: 1234 }); next.append({ id: "later" }, 2); next.close();
    const bytes = fs.readFileSync(file); applyJournalRecovery(dir, plan, "scope", validate); expect(fs.readFileSync(file)).toEqual(bytes);
    expect(journalHistory(dir)).toHaveLength(1);
    recordJournalHandoffObservation(dir, plan.recoveryId, {observedAt:new Date().toISOString(),acceptedSnapshots:1,missingSnapshots:0,conflictingSnapshots:0,unsnapshotted:"unconfirmed"});
    expect(journalHistory(dir)[0].handoffObservation?.acceptedSnapshots).toBe(1);
    expect(journalHistory(dir)[0].cliHandoff).toBe("unconfirmed");
    expect(journalHistory(dir)[0].serverDelivery).toBe("unconfirmed");
    expect(journalHistory(dir)[0].historicalIncomplete).toBe(true);
  });
  it("rejects changed source, unverified scope, active writer and unknown ownership guard", () => {
    const dir = broken(); const plan = prepareJournalRecovery(dir, "scope", validate);
    expect(() => applyJournalRecovery(dir, plan, "other", validate)).toThrow("scope_unconfirmed");
    const writer = new HeartbeatJournal(dir);
    expect(() => applyJournalRecovery(dir, plan, "scope", validate)).toThrow("writer_must_stop"); writer.close();
    fs.mkdirSync(path.join(dir, "ownership.guard")); expect(() => applyJournalRecovery(dir, plan, "scope", validate)).toThrow(); fs.rmdirSync(path.join(dir, "ownership.guard"));
    fs.appendFileSync(path.join(dir, "metadata.jsonl"), "more"); expect(() => applyJournalRecovery(dir, plan, "scope", validate)).toThrow("plan_expired");
  });
  it("refuses unknown checkpoint structure and symlinked evidence", () => {
    const dir = broken(); expect(() => prepareJournalRecovery(dir, "scope", validateEditorCheckpoint)).toThrow("no_verified_checkpoint");
    const file = path.join(dir, "metadata.jsonl"); fs.renameSync(file, file + ".original"); fs.symlinkSync(file + ".original", file);
    expect(() => inspectJournal(dir, validate)).toThrow("symlink_refused");
  });
  it("resumes before and after activation without changing the original accepted identity", () => {
    for (const point of ["before_activate", "after_activate"]) {
      const dir = broken(); const original = fs.readFileSync(path.join(dir, "metadata.jsonl"));
      const plan = prepareJournalRecovery(dir, "scope", validate);
      faults.point = point;
      expect(() => applyJournalRecovery(dir, plan, "scope", validate)).toThrow("fixture_interruption");
      faults.point = "";
      expect(applyJournalRecovery(dir, plan, "scope", validate).phase).toBe("activated");
      expect(fs.readFileSync(path.join(dir, "recovery", plan.recoveryId, "original.jsonl"))).toEqual(original);
      expect(scanJournal(fs.readFileSync(path.join(dir, "metadata.jsonl"))).state).toEqual({ id: "original", time: 1234 });
    }
  });
  it("reclaims only a dead recovery owner with matching transaction, scope and original hash", () => {
    const dir = broken(); const plan = prepareJournalRecovery(dir, "scope", validate);
    const child = spawnSync(process.execPath, ["-e", "process.exit(0)"]); expect(child.status).toBe(0);
    const guard = path.join(dir, "ownership.guard"); fs.mkdirSync(guard);
    fs.writeFileSync(path.join(guard, "owner.json"), JSON.stringify({ kind: "journal_recovery_v1", recoveryId: plan.recoveryId, scope: "scope", sourceHash: plan.sourceHash, pid: child.pid, token: "fixture-owner-token" }));
    expect(applyJournalRecovery(dir, plan, "scope", validate).phase).toBe("activated");
    expect(fs.readdirSync(dir).some(name => name.startsWith("abandoned-recovery-"))).toBe(true);
  });
  it("accepts a metadata-only editor checkpoint and stops before damaged data", () => {
    const checkpoint = { states: [], detached: [], retries: [], externalPayloads: [["same-id", { heartbeat_id: "same-id", time: 10 }]] };
    expect(validateEditorCheckpoint(checkpoint)).toBe(true);
    const dir = broken(); const scan = scanJournal(fs.readFileSync(path.join(dir, "metadata.jsonl"))); expect(scan.state).toEqual({ id: "original", time: 1234 });
  });
  it("refuses missing or conflicting ownership identity without activating a generation", () => {
    const dir = broken(); const plan = prepareJournalRecovery(dir, "scope", validate);
    const original = fs.readFileSync(path.join(dir, "metadata.jsonl"));
    fs.unlinkSync(path.join(dir, "journal-identity.json"));
    expect(() => applyJournalRecovery(dir, plan, "scope", validate)).toThrow("identity_missing");
    expect(fs.readFileSync(path.join(dir, "metadata.jsonl"))).toEqual(original);
    expect(journalHistory(dir)[0].phase).toBe("prepared");
    fs.writeFileSync(path.join(dir, "journal-identity.json"), JSON.stringify({version:1,journalId:"11111111-1111-1111-1111-111111111111",directoryHash:"foreign"}));
    expect(() => applyJournalRecovery(dir, plan, "scope", validate)).toThrow("ownership_unconfirmed");
    expect(fs.readFileSync(path.join(dir, "metadata.jsonl"))).toEqual(original);
  });
});
