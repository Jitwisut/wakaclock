import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export interface JournalHealth {
  status: "ready" | "write_failure" | "corrupt" | "locked";
  pending: number;
  lastSuccessfulWriteAt?: string;
  errorCode?: string;
  deadLetter?: number;
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

  constructor(directory: string) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.file = path.join(directory, "metadata.jsonl");
    this.lock = path.join(directory, "writer.lock");
    // Serialize lock reclamation as well as creation. If this tiny critical
    // section crashes, fail closed rather than stealing an uncertain writer.
    const guard = path.join(directory, "ownership.guard");
    fs.mkdirSync(guard, { mode: 0o700 });
    try {
      try { fs.mkdirSync(this.lock, { mode: 0o700 }); } catch {
      // Never steal a live/unknown lock. Dead-process ownership is kernel-checked.
      const owner = JSON.parse(fs.readFileSync(path.join(this.lock, "owner.json"), "utf8"));
      let dead = false;
      try { process.kill(owner.pid, 0); } catch (error) {
        dead = (error as NodeJS.ErrnoException).code === "ESRCH";
      }
      if (!dead) throw new Error("journal_locked");
      fs.rmSync(this.lock, { recursive: true });
      fs.mkdirSync(this.lock, { mode: 0o700 });
      }
      fs.writeFileSync(path.join(this.lock, "owner.json"), JSON.stringify({ pid: process.pid, token: this.token }), { mode: 0o600 });
    } finally {
      fs.rmdirSync(guard);
    }
    try { if (fs.existsSync(this.file)) this.recover(); }
    catch (error) { this.close(); throw error; }
  }

  private recover(): void {
    const bytes = fs.readFileSync(this.file, "utf8");
    const lines = bytes.split("\n");
    if (lines.pop() !== "") this.healthState = { ...this.healthState, status: "corrupt", errorCode: "journal_torn_write" };
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        const body = JSON.stringify({ version: record.version, sequence: record.sequence, state: record.state, pending: record.pending });
        if (record.version !== 1 || record.sequence !== this.sequence + 1 || checksum(body) !== record.checksum) throw new Error();
        this.sequence = record.sequence;
        this.state = record.state as T;
        this.healthState.pending = record.pending;
      } catch {
        this.healthState = { ...this.healthState, status: "corrupt", errorCode: "journal_checksum_or_sequence" };
        break;
      }
    }
  }

  read(): T | undefined { return this.state === undefined ? undefined : structuredClone(this.state); }
  health(): JournalHealth { return { ...this.healthState }; }

  append(state: T, pending: number): void {
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
