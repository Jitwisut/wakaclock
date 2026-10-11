import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { scanJournal } from "./journalScanner";

export interface JournalHealth {
  status: "ready" | "write_failure" | "corrupt" | "locked";
  pending: number;
  lastSuccessfulWriteAt?: string;
  errorCode?: string;
  deadLetter?: number;
  historicalIncomplete?: boolean;
  unacknowledgedIncidents?: number;
  handoffErrorCode?: string;
}

/** Private metadata checkpoints. Never pass document text or credentials here.
 * Each acknowledged checkpoint is fsync'd before returning. A torn/corrupt tail
 * blocks new writes; the last verified checkpoint remains available for recovery.
 */
export class HeartbeatJournal<T> {
  private sequence = 0;
  private state?: T;
  private healthState: JournalHealth = { status: "ready", pending: 0 };
  private readonly file: string;
  private readonly lock: string;
  private readonly token = randomUUID();
  private closed = false;
  private readonly validate: (state: unknown) => boolean;

  constructor(directory: string, validate: (state: unknown) => boolean = () => true) {
    this.validate = validate;
    for (let at = directory; ; at = path.dirname(at)) {
      if (fs.existsSync(at) && fs.lstatSync(at).isSymbolicLink() && !(process.platform === "darwin" && ["/var", "/tmp", "/etc"].includes(at) && fs.realpathSync(at) === `/private${at}`)) throw new Error("journal_ownership_unconfirmed");
      if (path.dirname(at) === at) break;
    }
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.file = path.join(directory, "metadata.jsonl");
    this.lock = path.join(directory, "writer.lock");
    if (fs.existsSync(this.file) && fs.lstatSync(this.file).isSymbolicLink()) throw new Error("journal_ownership_unconfirmed");
    // Serialize lock reclamation as well as creation. If this tiny critical
    // section crashes, fail closed rather than stealing an uncertain writer.
    const guard = path.join(directory, "ownership.guard");
    fs.mkdirSync(guard, { mode: 0o700 });
    try {
      const identityPath = path.join(directory, "journal-identity.json");
      if (fs.existsSync(identityPath) && fs.lstatSync(identityPath).isSymbolicLink()) throw new Error("journal_ownership_unconfirmed");
      const directoryHash = checksum(fs.realpathSync(directory));
      let identity: { version: number; journalId: string; directoryHash: string };
      if (fs.existsSync(identityPath)) identity = JSON.parse(fs.readFileSync(identityPath, "utf8"));
      else {
        identity = { version: 1, journalId: randomUUID(), directoryHash };
        const fd = fs.openSync(identityPath, "wx", 0o600);
        try { fs.writeFileSync(fd, JSON.stringify(identity)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        if (process.platform !== "win32") { const fd = fs.openSync(directory, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
      }
      if (identity.version !== 1 || identity.directoryHash !== directoryHash || !/^[a-f0-9-]{36}$/.test(identity.journalId)) throw new Error("journal_ownership_unconfirmed");
      try { fs.mkdirSync(this.lock, { mode: 0o700 }); } catch {
        // Reclamation needs a matching journal identity and token, plus a dead
        // process. Legacy locks or a reused/live PID remain unconfirmed.
        if (fs.lstatSync(this.lock).isSymbolicLink()) throw new Error("journal_ownership_unconfirmed");
        const owner = JSON.parse(fs.readFileSync(path.join(this.lock, "owner.json"), "utf8"));
        if (owner.version !== 2 || owner.journalId !== identity.journalId || owner.directoryHash !== directoryHash || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.token !== "string" || !/^[a-f0-9-]{36}$/.test(owner.token)) throw new Error("journal_ownership_unconfirmed");
        let dead = false;
        try { process.kill(owner.pid, 0); } catch (error) { dead = (error as NodeJS.ErrnoException).code === "ESRCH"; }
        if (!dead) throw new Error("journal_locked");
        fs.renameSync(this.lock, path.join(directory, `abandoned-writer-${randomUUID()}.lock`));
        fs.mkdirSync(this.lock, { mode: 0o700 });
      }
      const owner = { version: 2, journalId: identity.journalId, directoryHash, pid: process.pid, token: this.token };
      const fd = fs.openSync(path.join(this.lock, "owner.json"), "wx", 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(owner)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    } finally {
      fs.rmdirSync(guard);
    }
    try { if (fs.existsSync(this.file)) this.recover(); }
    catch (error) { this.close(); throw error; }
  }

  private recover(): void {
    const scan = scanJournal<T>(fs.readFileSync(this.file), this.validate);
    this.sequence = scan.sequence; this.state = scan.state; this.healthState.pending = scan.pending;
    if (scan.errorCode) this.healthState = { ...this.healthState, status: "corrupt", errorCode: scan.errorCode };
  }

  /** Stable fallback for a pre-snapshot record without an assigned ID. */
  recoveryRecordId(record: unknown): string {
    const identity = JSON.parse(fs.readFileSync(path.join(path.dirname(this.file), "journal-identity.json"), "utf8"));
    const hash = checksum(JSON.stringify([identity.journalId,record]));
    return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
  }

  read(): T | undefined { return this.state === undefined ? undefined : structuredClone(this.state); }
  ownsDirectory(directory: string): boolean { return !this.closed && path.resolve(directory, "metadata.jsonl") === path.resolve(this.file); }
  health(): JournalHealth { return { ...this.healthState }; }

  append(state: T, pending: number): void {
    if (!this.validate(state)) throw new Error("journal_checkpoint_invalid");
    if (this.closed || this.healthState.status === "corrupt") throw new Error("journal_not_writable");
    const body = { version: 1, sequence: this.sequence + 1, state, pending };
    const line = JSON.stringify({ ...body, checksum: checksum(JSON.stringify(body)) }) + "\n";
    let fd: number | undefined;
    try {
      fd = fs.openSync(this.file, "a", 0o600);
      fs.writeFileSync(fd, line, "utf8");
      fs.fsyncSync(fd);
      // Ensure the directory entry is durable on POSIX (Windows disallows it).
      if (process.platform !== "win32") {
        const dir = fs.openSync(path.dirname(this.file), "r");
        try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
      }
      this.sequence++;
      this.state = structuredClone(state);
      this.healthState = { status: "ready", pending, lastSuccessfulWriteAt: new Date().toISOString() };
      if (pending === 0 && fs.statSync(this.file).size > 1024 * 1024) {
        // Only fully handed-off journals may be compacted. The current metadata
        // checkpoint survives either side of the atomic rename.
        const compacted = { version: 1, sequence: 1, state, pending: 0 };
        const replacement = this.file + ".compacted";
        const compactFd = fs.openSync(replacement, "w", 0o600);
        try {
          fs.writeFileSync(compactFd, JSON.stringify({ ...compacted, checksum: checksum(JSON.stringify(compacted)) }) + "\n");
          fs.fsyncSync(compactFd);
        } finally { fs.closeSync(compactFd); }
        fs.renameSync(replacement, this.file);
        if (process.platform !== "win32") {
          const parent = fs.openSync(path.dirname(this.file), "r");
          try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
        }
        this.sequence = 1;
      }
    } catch (error) {
      // A partial append must not be followed by another record or an ACK.
      this.healthState = { ...this.healthState, status: "corrupt", errorCode: (error as NodeJS.ErrnoException).code ?? "journal_write_failure" };
      throw new Error("journal_write_failure");
    } finally { if (fd !== undefined) fs.closeSync(fd); }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    const owner = JSON.parse(fs.readFileSync(path.join(this.lock, "owner.json"), "utf8"));
    if (owner.token === this.token) fs.rmSync(this.lock, { recursive: true });
  }
}

function checksum(body: string): string { return createHash("sha256").update(body).digest("hex"); }
