import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { encodeJournalCheckpoint, journalHash, scanJournal } from "./journalScanner";

export interface RecoveryPlan {
  version: 1;
  recoveryId: string;
  scope: string;
  sourceHash: string;
  ownershipHash?: string;
  verifiedSequence: number;
  verifiedPending: number;
  unknownRecords: number | null;
  errorCode?: string;
  createdAt: string;
}
export interface RecoveryManifest extends RecoveryPlan {
  phase: "prepared" | "backed_up" | "candidate_written" | "activated";
  candidateHash?: string;
  historicalIncomplete: boolean;
  cliHandoff: "unconfirmed";
  serverDelivery: "unconfirmed";
  handoffObservation?: JournalHandoffObservation;
}
export interface JournalHandoffObservation {
  observedAt: string;
  acceptedSnapshots: number;
  missingSnapshots: number;
  conflictingSnapshots: number;
  unsnapshotted: "unconfirmed";
}
function validHandoff(value: unknown): value is JournalHandoffObservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const observation = value as Record<string, unknown>;
  return Object.keys(observation).every(key => ["observedAt", "acceptedSnapshots", "missingSnapshots", "conflictingSnapshots", "unsnapshotted"].includes(key)) && typeof observation.observedAt === "string" && Number.isFinite(Date.parse(observation.observedAt)) && observation.unsnapshotted === "unconfirmed" && [observation.acceptedSnapshots, observation.missingSnapshots, observation.conflictingSnapshots].every(n => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= 10_000_000);
}
const phases = ["prepared", "backed_up", "candidate_written", "activated"];
function checkedManifest(value: unknown, recoveryId: string): RecoveryManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("journal_recovery_manifest_invalid");
  const m = value as Record<string, unknown>;
  const allowed = ["version", "recoveryId", "scope", "sourceHash", "ownershipHash", "verifiedSequence", "verifiedPending", "unknownRecords", "errorCode", "createdAt", "phase", "candidateHash", "historicalIncomplete", "cliHandoff", "serverDelivery", "handoffObservation"];
  if (m.handoffObservation !== undefined && !validHandoff(m.handoffObservation)) throw new Error("journal_recovery_manifest_invalid");
  if (m.ownershipHash !== undefined && (typeof m.ownershipHash !== "string" || !/^[a-f0-9]{64}$/.test(m.ownershipHash))) throw new Error("journal_recovery_manifest_invalid");
  if (Object.keys(m).some(k => !allowed.includes(k)) || m.version !== 1 || m.recoveryId !== recoveryId || typeof m.scope !== "string" || !m.scope || typeof m.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(m.sourceHash) || !Number.isSafeInteger(m.verifiedSequence) || (m.verifiedSequence as number) < 1 || !Number.isSafeInteger(m.verifiedPending) || (m.verifiedPending as number) < 0 || m.unknownRecords !== null || (m.errorCode !== undefined && (typeof m.errorCode !== "string" || !/^[a-z0-9_]+$/.test(m.errorCode))) || typeof m.createdAt !== "string" || !Number.isFinite(Date.parse(m.createdAt)) || typeof m.phase !== "string" || !phases.includes(m.phase) || (m.candidateHash !== undefined && (typeof m.candidateHash !== "string" || !/^[a-f0-9]{64}$/.test(m.candidateHash))) || m.historicalIncomplete !== true || m.cliHandoff !== "unconfirmed" || m.serverDelivery !== "unconfirmed") throw new Error("journal_recovery_manifest_invalid");
  return m as unknown as RecoveryManifest;
}
function regular(directory: string, name?: string): string {
  const target = name ? path.join(directory, name) : directory;
  // Reject symlinks on every existing path component, including parent scope directories.
  for (let at = target; ; at = path.dirname(at)) {
    try {
      if (fs.lstatSync(at).isSymbolicLink()) {
        const systemAlias = process.platform === "darwin" && ["/var", "/tmp", "/etc"].includes(at) && fs.realpathSync(at) === `/private${at}`;
        if (!systemAlias) throw new Error("journal_symlink_refused");
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (path.dirname(at) === at) break;
  }
  return target;
}
function syncDirectory(directory: string): void {
  if (process.platform === "win32") return;
  const fd = fs.openSync(directory, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function writeExclusive(file: string, bytes: string | Buffer): void {
  const fd = fs.openSync(file, "wx", 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  syncDirectory(path.dirname(file));
}
function writeManifest(directory: string, manifest: RecoveryManifest): void {
  const temporary = path.join(directory, `manifest-${randomUUID()}.tmp`);
  writeExclusive(temporary, JSON.stringify(manifest));
  fs.renameSync(temporary, path.join(directory, "manifest.json")); syncDirectory(directory);
}
export function inspectJournal(directory: string, validate: (state: unknown) => boolean) {
  const scan = scanJournal(fs.readFileSync(regular(directory, "metadata.jsonl")), validate);
  const { state: _state, ...metadata } = scan;
  return { ...metadata, writerPresent: fs.existsSync(regular(directory, "writer.lock")), ownershipGuardPresent: fs.existsSync(regular(directory, "ownership.guard")), historicalIncomplete: journalHistory(directory).some(m => m.historicalIncomplete) };
}
export function prepareJournalRecovery(directory: string, scope: string, validate: (state: unknown) => boolean): RecoveryPlan {
  const scan = scanJournal(fs.readFileSync(regular(directory, "metadata.jsonl")), validate);
  if (!scan.errorCode) throw new Error("journal_repair_not_required");
  if (scan.state === undefined) throw new Error("journal_no_verified_checkpoint");
  const plan: RecoveryPlan = { version: 1, recoveryId: randomUUID(), scope, sourceHash: scan.sourceHash, verifiedSequence: scan.sequence, verifiedPending: scan.pending, unknownRecords: scan.unknownRecords, errorCode: scan.errorCode, createdAt: new Date().toISOString() };
  const identity = regular(directory, "journal-identity.json");
  if (fs.existsSync(identity)) plan.ownershipHash = journalHash(fs.readFileSync(identity));
  const transaction = regular(directory, `recovery/${plan.recoveryId}`);
  fs.mkdirSync(transaction, { recursive: true, mode: 0o700 });
  writeManifest(transaction, { ...plan, phase: "prepared", historicalIncomplete: true, cliHandoff: "unconfirmed", serverDelivery: "unconfirmed" });
  syncDirectory(path.dirname(transaction));
  return plan;
}
export function journalHistory(directory: string): RecoveryManifest[] {
  const root = regular(directory, "recovery");
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(id => /^[a-f0-9-]{36}$/.test(id)).map(id => {
    const manifest = JSON.parse(fs.readFileSync(regular(path.join(root, id), "manifest.json"), "utf8"));
    return checkedManifest(manifest, id);
  });
}
/** Observed receipt counts do not certify unsnapshotted or server delivery. */
export function recordJournalHandoffObservation(directory: string, recoveryId: string, observation: JournalHandoffObservation): RecoveryManifest {
  if (!/^[a-f0-9-]{36}$/.test(recoveryId) || !validHandoff(observation)) throw new Error("journal_recovery_receipt_observation_invalid");
  const transaction = regular(directory, `recovery/${recoveryId}`);
  const manifest = checkedManifest(JSON.parse(fs.readFileSync(regular(transaction, "manifest.json"), "utf8")), recoveryId);
  if (manifest.phase !== "activated") throw new Error("journal_recovery_not_activated");
  if (!manifest.handoffObservation || Date.parse(observation.observedAt) >= Date.parse(manifest.handoffObservation.observedAt)) {
    manifest.handoffObservation = observation;
    writeManifest(transaction, manifest);
  }
  return manifest;
}
/** Explicit apply, offline: the caller must prove the account/scope and park writers.
 * A kernel PID probe is deliberately insufficient authority to reclaim a writer.
 */
function acquireRecoveryGuard(directory: string, plan: RecoveryPlan): string {
  const guard = regular(directory, "ownership.guard");
  try { fs.mkdirSync(guard, { mode: 0o700 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    // A recovery owner is reclaimable only with its recorded transaction identity,
    // original hash, scope AND proof that its process is dead. Legacy/unknown
    // guards remain untouched. The second guard serializes competing reclaimers.
    const reclaim = regular(directory, "recovery-reclaim.guard");
    fs.mkdirSync(reclaim, { mode: 0o700 });
    try {
      const owner = JSON.parse(fs.readFileSync(regular(guard, "owner.json"), "utf8"));
      if (owner.kind !== "journal_recovery_v1" || owner.recoveryId !== plan.recoveryId || owner.sourceHash !== plan.sourceHash || owner.scope !== plan.scope || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.token !== "string") throw new Error("journal_recovery_ownership_unconfirmed");
      let dead = false;
      try { process.kill(owner.pid, 0); } catch (failure) { dead = (failure as NodeJS.ErrnoException).code === "ESRCH"; }
      if (!dead || fs.existsSync(regular(directory, "writer.lock"))) throw new Error("journal_writer_must_stop");
      fs.renameSync(guard, regular(directory, `abandoned-recovery-${randomUUID()}.guard`));
      syncDirectory(directory); fs.mkdirSync(guard, { mode: 0o700 });
    } finally { fs.rmdirSync(reclaim); }
  }
  const owner = { kind: "journal_recovery_v1", recoveryId: plan.recoveryId, sourceHash: plan.sourceHash, scope: plan.scope, pid: process.pid, token: randomUUID() };
  try { writeExclusive(path.join(guard, "owner.json"), JSON.stringify(owner)); }
  catch (error) { fs.rmSync(guard, { recursive: true }); throw error; }
  return guard;
}
export function applyJournalRecovery(directory: string, plan: RecoveryPlan, verifiedScope: string, validate: (state: unknown) => boolean): RecoveryManifest {
  if (plan.version !== 1 || plan.scope !== verifiedScope || !/^[a-f0-9-]{36}$/.test(plan.recoveryId)) throw new Error("journal_recovery_scope_unconfirmed");
  regular(directory);
  const guard = acquireRecoveryGuard(directory, plan);
  try {
    if (fs.existsSync(regular(directory, "writer.lock"))) throw new Error("journal_writer_must_stop");
    const source = regular(directory, "metadata.jsonl");
    const root = regular(directory, "recovery");
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    const transaction = regular(root, plan.recoveryId);
    fs.mkdirSync(transaction, { recursive: true, mode: 0o700 });
    const manifestFile = regular(transaction, "manifest.json");
    let manifest: RecoveryManifest;
    if (fs.existsSync(manifestFile)) {
      manifest = checkedManifest(JSON.parse(fs.readFileSync(manifestFile, "utf8")), plan.recoveryId);
      if (manifest.version !== 1 || manifest.scope !== verifiedScope || manifest.sourceHash !== plan.sourceHash || manifest.ownershipHash !== plan.ownershipHash || manifest.recoveryId !== plan.recoveryId) throw new Error("journal_recovery_manifest_conflict");
    } else {
      manifest = { ...plan, phase: "prepared", historicalIncomplete: true, cliHandoff: "unconfirmed", serverDelivery: "unconfirmed" };
      writeManifest(transaction, manifest);
    }
    const ownershipIdentity = regular(directory, "journal-identity.json");
    if (!fs.existsSync(ownershipIdentity)) throw new Error("journal_recovery_identity_missing");
    if (!plan.ownershipHash || journalHash(fs.readFileSync(ownershipIdentity)) !== plan.ownershipHash) throw new Error("journal_recovery_ownership_unconfirmed");
    const bytes = fs.readFileSync(source);
    if (manifest.phase === "activated") return manifest; // Writer may have appended after activation; never rewind it.
    if (manifest.candidateHash && journalHash(bytes) === manifest.candidateHash) {
      manifest.phase = "activated"; writeManifest(transaction, manifest); return manifest;
    }
    const scan = scanJournal(bytes, validate);
    if (scan.sourceHash !== plan.sourceHash || scan.sequence !== plan.verifiedSequence || scan.pending !== plan.verifiedPending || scan.state === undefined || !scan.errorCode) throw new Error("journal_recovery_plan_expired");
    const backup = regular(transaction, "original.jsonl");
    if (!fs.existsSync(backup)) writeExclusive(backup, bytes);
    if (journalHash(fs.readFileSync(backup)) !== plan.sourceHash) throw new Error("journal_recovery_backup_mismatch");
    // An earlier write may have completed before its fsync failed. Reusing its
    // hash is insufficient proof of durability; sync again before activation.
    const backupFd = fs.openSync(backup, "r");
    try { fs.fsyncSync(backupFd); } finally { fs.closeSync(backupFd); }
    syncDirectory(transaction);
    const ownership = regular(transaction, "ownership.json");
    const identity = regular(directory, "journal-identity.json");
    if (!fs.existsSync(identity)) throw new Error("journal_recovery_identity_missing");
    const identityBytes = fs.readFileSync(identity);
    if (!plan.ownershipHash || journalHash(identityBytes) !== plan.ownershipHash) throw new Error("journal_recovery_ownership_unconfirmed");
    const identityRecord = JSON.parse(identityBytes.toString("utf8"));
    if (identityRecord.version !== 1 || !/^[a-f0-9-]{36}$/.test(identityRecord.journalId ?? "") || identityRecord.directoryHash !== journalHash(fs.realpathSync(directory))) throw new Error("journal_recovery_ownership_unconfirmed");
    const identityBackup = regular(transaction, "journal-identity.json");
    if (!fs.existsSync(identityBackup)) writeExclusive(identityBackup, identityBytes);
    if (!fs.readFileSync(identityBackup).equals(identityBytes)) throw new Error("journal_recovery_identity_conflict");
    fs.chmodSync(identityBackup, 0o400);
    if (!fs.existsSync(ownership)) writeExclusive(ownership, JSON.stringify({ version: 1, scope: verifiedScope, sourceHash: plan.sourceHash, writerPresent: false, recoveryOwner: JSON.parse(fs.readFileSync(path.join(guard, "owner.json"), "utf8")) }));
    // Keep original bytes in an immutable private backup; unknown tail stays there.
    fs.chmodSync(backup, 0o400);
    manifest.phase = "backed_up"; writeManifest(transaction, manifest);
    const candidate = encodeJournalCheckpoint(scan.state, scan.pending);
    const candidateFile = regular(transaction, "candidate.jsonl");
    if (!fs.existsSync(candidateFile)) writeExclusive(candidateFile, candidate);
    if (fs.readFileSync(candidateFile, "utf8") !== candidate) throw new Error("journal_recovery_candidate_conflict");
    manifest.candidateHash = journalHash(candidate); manifest.phase = "candidate_written"; writeManifest(transaction, manifest);
    // Same-volume atomic replacement. Candidate bytes and manifest are synced first.
    const swap = regular(directory, `recovery-${plan.recoveryId}.jsonl`);
    if (!fs.existsSync(swap)) writeExclusive(swap, candidate);
    if (journalHash(fs.readFileSync(swap)) !== manifest.candidateHash) throw new Error("journal_recovery_candidate_conflict");
    fs.renameSync(swap, source); syncDirectory(directory);
    manifest.phase = "activated"; writeManifest(transaction, manifest); return manifest;
  } finally { fs.rmSync(guard, { recursive: true }); syncDirectory(directory); }
}
