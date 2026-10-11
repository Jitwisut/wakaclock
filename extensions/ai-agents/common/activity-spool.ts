import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

export interface ProducerObservation {
  schema_version: 1;
  scope_id: string;
  adapter_id: "kilo-code" | "opencode";
  execution_surface: "cli" | "ide";
  observation_id: string;
  observed_at: string;
  metadata: { hook_event_name: string; sessionID: string; callID: string; directory: string };
}
function safe(target: string): void {
  for (let current = target; ; current = path.dirname(current)) {
    try {
      if (fs.lstatSync(current).isSymbolicLink() && !(process.platform === "darwin" && ["/var", "/tmp", "/etc"].includes(current) && fs.realpathSync(current) === `/private${current}`)) throw new Error("producer_symlink_refused");
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (path.dirname(current) === current) break;
  }
}
function write(file: string, value: unknown): void {
  safe(file); const fd = fs.openSync(file, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (process.platform !== "win32") { const parent = fs.openSync(path.dirname(file), "r"); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); } }
}
function syncDirectory(directory: string): void {
  if (process.platform === "win32") return;
  const fd = fs.openSync(directory, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function runProducerCli(cli: string, args: string[], payload?: unknown): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, { stdio: ["pipe", "pipe", "ignore"] });
    let bytes = ""; const timer = setTimeout(() => { child.kill(); reject(new Error("producer_cli_timeout")); }, 8000);
    child.stdout.on("data", chunk => { bytes += chunk.toString(); if (Buffer.byteLength(bytes) > 16384) { child.kill(); reject(new Error("producer_cli_ack_invalid")); } });
    child.stdin.on("error", () => reject(new Error("producer_cli_unavailable")));
    child.once("error", () => { clearTimeout(timer); reject(new Error("producer_cli_unavailable")); });
    child.once("close", code => { clearTimeout(timer); try { if (code !== 0) throw new Error(); resolve(JSON.parse(bytes)); } catch { reject(new Error("producer_cli_ack_invalid")); } });
    child.stdin.end(payload === undefined ? undefined : JSON.stringify(payload));
  });
}
/** Disk acceptance precedes handoff; only the shared Rust collector removes files.
 * Unconfirmed observations remain parked separately and are never rebound by name.
 */
export async function retainToolMarker(cli: string, input: { adapter: "kilo-code" | "opencode"; phase: "before" | "after" | "failure"; surface: "cli" | "ide"; sessionId: string; callId: string; directory: string; observedAt?: string }, home = homedir()): Promise<{ file: string; observation: ProducerObservation } | undefined> {
  const observedAt = input.observedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("producer_timestamp_invalid");
  const base = path.join(home, ".wakaclock"); safe(base);
  const runtimeFile = path.join(base, "runtime-desired.json"); safe(runtimeFile);
  if (fs.existsSync(runtimeFile)) {
    const state = JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
    if (state.schema_version !== 1 || !state.desired || !Array.isArray(state.intervals)) throw new Error("producer_runtime_unconfirmed");
    if (state.desired.capture === false) return undefined;
  }
  const bindings = path.join(base, "native-producer-bindings"); safe(bindings); fs.mkdirSync(bindings, { recursive: true, mode: 0o700 });
  const binding = path.join(bindings, `${input.adapter}-${input.surface}.json`); safe(binding);
  let scope: string | undefined;
  try {
    const handshake = await runProducerCli(cli, ["journal-scope"]);
    if (handshake.schema_version !== 1 || handshake.owner_confirmed !== true || !/^[a-f0-9]{64}$/.test(handshake.scope_id ?? "") || !handshake.capabilities?.includes("activity_envelope_v3")) throw new Error();
    scope = handshake.scope_id;
    const stage = path.join(bindings, `${randomUUID()}.metadata`); write(stage, { scope_id: scope }); fs.renameSync(stage, binding);
    if (process.platform !== "win32") { const fd = fs.openSync(bindings, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
  } catch {
    if (fs.existsSync(binding)) { const existing = JSON.parse(fs.readFileSync(binding, "utf8")); if (/^[a-f0-9]{64}$/.test(existing.scope_id ?? "")) scope = existing.scope_id; }
  }
  const metadata = { hook_event_name: `tool.execute.${input.phase}`, sessionID: input.sessionId, callID: input.callId, directory: input.directory };
  if (Object.values(metadata).some(value => typeof value !== "string" || value.length > 4096) || !path.isAbsolute(input.directory)) throw new Error("producer_metadata_invalid");
  const observation: ProducerObservation = { schema_version: 1, scope_id: scope ?? "unconfirmed", adapter_id: input.adapter, execution_surface: input.surface, observation_id: randomUUID(), observed_at: observedAt, metadata };
  const root = path.join(base, "native-producer-spool", observation.scope_id); safe(root); fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  for (const parent of [path.dirname(root), base, home]) syncDirectory(parent);
  const file = path.join(root, `${observation.observation_id}.json`); write(file, observation);
  if (!scope) throw new Error("producer_scope_unconfirmed_retained");
  try {
    await runProducerCli(cli, ["ai", "activity-hook", "--adapter", input.adapter, "--surface", input.surface, "--scope-id", scope, "--observation-id", observation.observation_id, "--observed-at", observation.observed_at], metadata);
  } catch { /* Already retained: the idle collector performs the durable reconciliation. */ }
  return { file, observation };
}
