import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { HeartbeatJournal } from "../src/heartbeatJournal";

const directories: string[] = [];
const faults = vi.hoisted(() => ({ sync: false, compact: false }));
vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual,
    fsyncSync: (fd: number) => { if (faults.sync) throw Object.assign(new Error("fixture disk full"), { code: "ENOSPC" }); actual.fsyncSync(fd); },
    renameSync: (from: fs.PathLike, to: fs.PathLike) => { if (faults.compact && String(from).endsWith(".compacted")) throw Object.assign(new Error("fixture compaction interrupted"), { code: "EIO" }); actual.renameSync(from, to); },
  };
});
function directory() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atoaxis-journal-")); directories.push(dir); return dir; }
afterEach(() => { faults.sync = false; faults.compact = false; for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe("durable editor journal", () => {
  it("recovers a durably acknowledged record after the writer is killed", async () => {
    const dir = directory();
    const module = pathToFileURL(path.resolve("src/heartbeatJournal.ts")).href;
    const script = `require("module").registerHooks({resolve(specifier, context, next) {try {return next(specifier, context);} catch (error) {if(specifier === "./journalScanner") return next(specifier+".ts", context); throw error;}}});import(${JSON.stringify(module)}).then(({HeartbeatJournal})=>{const journal=new HeartbeatJournal(${JSON.stringify(dir)});journal.append({id:'kill-original',time:1234},1);process.stdout.write('durable\\n');setInterval(()=>{},1000);})`;
    const child = spawn(process.execPath, ["--experimental-strip-types", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
    const closed = once(child, "close");
    const timer = setTimeout(() => child.kill("SIGKILL"), 3_000);
    try {
      const [bytes] = await Promise.race([once(child.stdout, "data"), closed.then(() => { throw new Error("journal_fixture_writer_exited_before_ack"); })]);
      expect(bytes.toString()).toBe("durable\n");
      child.kill("SIGKILL");await closed;
      const recovered = new HeartbeatJournal(dir);
      expect(recovered.read()).toEqual({id:"kill-original",time:1234});expect(recovered.health().pending).toBe(1);recovered.close();
    } finally { clearTimeout(timer);child.kill("SIGKILL");await closed; }
  });
  it("refuses ACK and further writes after a disk sync failure", () => {
    const dir = directory();const journal = new HeartbeatJournal(dir);journal.append({id:"original"},1);
    faults.sync = true;
    expect(() => journal.append({id:"uncertain"},2)).toThrow("journal_write_failure");
    faults.sync = false;
    expect(journal.health().status).toBe("corrupt");expect(journal.read()).toEqual({id:"original"});
    expect(() => journal.append({id:"later"},3)).toThrow("journal_not_writable");journal.close();
  });
  it("never compacts pending records and preserves the original file if compaction is interrupted", () => {
    const dir = directory();const journal = new HeartbeatJournal(dir);
    const metadata = {id:"pending",references:Array(50_000).fill("metadata-reference")};
    journal.append(metadata,1);journal.append({id:"also-pending"},2);
    expect(fs.readFileSync(path.join(dir,"metadata.jsonl"),"utf8").split("\n").filter(Boolean)).toHaveLength(2);
    faults.compact = true;
    expect(() => journal.append({id:"handoff-complete"},0)).toThrow("journal_write_failure");
    faults.compact = false;journal.close();
    const recovered = new HeartbeatJournal(dir);expect(recovered.read()).toEqual({id:"handoff-complete"});expect(recovered.health().pending).toBe(0);recovered.close();
  });
  it("recovers original identity/time after restart, without requiring current file contents", () => {
    const dir = directory();
    const first = new HeartbeatJournal(dir);
    first.append({ heartbeat_id: "original", time: 1234, activity_segments: [{ start: 1200, end: 1215 }] }, 1);
    first.close();
    const next = new HeartbeatJournal(dir);
    expect(next.read()).toEqual({ heartbeat_id: "original", time: 1234, activity_segments: [{ start: 1200, end: 1215 }] });
    expect(next.health().pending).toBe(1);
    next.close();
  });
  it("rejects concurrent ownership and permits ownership after graceful shutdown", () => {
    const dir = directory(); const first = new HeartbeatJournal(dir);
    expect(() => new HeartbeatJournal(dir)).toThrow("journal_locked");
    first.close(); const next = new HeartbeatJournal(dir); next.close();
  });
  it("preserves the verified prefix on a torn write and refuses further ACKs", () => {
    const dir = directory(); const first = new HeartbeatJournal(dir); first.append({ id: "keep" }, 1); first.close();
    fs.appendFileSync(path.join(dir, "metadata.jsonl"), '{"version":1');
    const next = new HeartbeatJournal(dir);
    expect(next.read()).toEqual({ id: "keep" }); expect(next.health().status).toBe("corrupt");
    expect(() => next.append({ id: "new" }, 2)).toThrow("journal_not_writable"); next.close();
  });
  it("detects metadata tampering and does not recover corrupted records", () => {
    const dir = directory(); const first = new HeartbeatJournal(dir); first.append({ id: "keep" }, 1); first.close();
    const file = path.join(dir, "metadata.jsonl"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("keep", "fake"));
    const next = new HeartbeatJournal(dir); expect(next.read()).toBeUndefined(); expect(next.health().status).toBe("corrupt"); next.close();
  });
});
