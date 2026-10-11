import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import type { KiloProducerMetadata } from "./event-normalizer.ts";

async function cliPath(): Promise<string> {
  const fromEnv = process.env.WAKACLOCK_CLI_PATH?.trim();
  if (fromEnv) return fromEnv;
  try {
    const managed = await readFile(`${homedir()}/.wakaclock/cli-path`, "utf8");
    if (managed.trim()) return managed.trim();
  } catch {
    // A missing path file is normal before setup.
  }
  return process.env.WAKACLOCK_CLI?.trim() || "wakaclock";
}

type ToolLifecycle = "before" | "after" | "abort";

type SessionLifecycle = "start" | "end";

interface SessionLifecycleInput {
  sessionId: string;
  agent: string;
  provider?: unknown;
  model?: unknown;
  directory?: string;
}

/** A native marker is accepted only after the CLI's local durable inbox ACK.
 * Missing/old CLI and response loss are failures, never an exit-code-only ACK.
 * The hook invocation itself is the observation boundary; no tool content is
 * copied into this payload and it carries no claimed execution interval.
 */
export async function emitActivityMarker(input: {
  phase: "before" | "after" | "failure";
  sessionId: string;
  callId: string;
  directory: string;
  surface: "cli" | "ide";
}): Promise<void> {
  const payload = JSON.stringify({
    hook_event_name: `tool.execute.${input.phase}`,
    sessionID: input.sessionId,
    callID: input.callId,
    directory: input.directory,
    timestamp: new Date().toISOString(),
  });
  const cli = await cliPath();
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const operation = hash(`${input.sessionId}\0${input.callId}`);
  const kind = input.phase === "before" ? "ToolStart" : "ToolEnd";
  const expectedId = hash(`activity-v3\0kilo-code\0${input.sessionId}\0${operation}\0${kind}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cli, ["ai", "activity-hook", "--adapter", "kilo-code", "--surface", input.surface], { stdio: ["pipe", "pipe", "ignore"] });
    let stdout = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("activity_handoff_timeout")); }, 8_000);
    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout) > 16_384) { child.kill(); clearTimeout(timer); reject(new Error("activity_handoff_invalid_ack")); }
    });
    child.stdin.on("error", () => { clearTimeout(timer); reject(new Error("activity_handoff_write_failed")); });
    child.once("error", () => { clearTimeout(timer); reject(new Error("activity_handoff_unavailable")); });
    child.once("close", code => {
      clearTimeout(timer);
      try {
        const ack = JSON.parse(stdout).acknowledgement;
        if (code !== 0 || ack?.schema_version !== 3 || ack.event_id !== expectedId || ack.durable !== true || !["accepted", "duplicate"].includes(ack.status)) throw new Error();
        resolve();
      } catch { reject(new Error("activity_handoff_not_durable")); }
    });
    child.stdin.end(payload);
  });
}

function runMetadataCommand(command: string, payload: string): Promise<void> {
  return cliPath().then((cli) => new Promise<void>((resolve) => {
    const child = spawn(cli, ["ai", command, "--json"], {
      stdio: ["pipe", "ignore", "ignore"]
    });
    child.stdin.end(payload);
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, 5_000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    child.once("error", () => {
      clearTimeout(timer);
      resolve();
    });
  }));
}

/**
 * Run the CLI's metadata-only shell snapshot lifecycle. Kilo's shell tool does
 * not expose a file list in its completion event, so the shared before/after
 * engine is the only safe fallback. The object is constructed from an explicit
 * allowlist; command text and tool output never cross this process boundary.
 */
export async function runToolLifecycle(
  phase: ToolLifecycle,
  input: {
    toolEventId: string;
    agent: string;
    provider?: unknown;
    model?: unknown;
    sessionId?: string;
    tool?: string;
    directory?: string;
  }
): Promise<void> {
  const command = phase === "before" ? "tool-before" : phase === "after" ? "tool-after" : "tool-abort";
  const payload = JSON.stringify({
    tool_event_id: input.toolEventId,
    agent: input.agent,
    provider: typeof input.provider === "string" ? input.provider : null,
    model: typeof input.model === "string" ? input.model : null,
    session_id: input.sessionId ?? null,
    tool: input.tool ?? null,
    transport: "tool_snapshot",
    workspace_root: input.directory ?? null
  });
  await runMetadataCommand(command, payload);
}

/**
 * Persist a bounded Kilo session interval through the CLI. Session hooks are
 * metadata-only and intentionally do not create file-change evidence; the CLI
 * owns the durable state and keeps the latest reported event as the interval end.
 */
export async function runSessionLifecycle(
  phase: SessionLifecycle,
  input: SessionLifecycleInput
): Promise<void> {
  if (!input.sessionId.trim()) return;
  const payload = JSON.stringify({
    session_id: input.sessionId,
    agent: input.agent,
    provider: typeof input.provider === "string" ? input.provider : null,
    model: typeof input.model === "string" ? input.model : null,
    cwd: input.directory ?? null,
    // `source` is the existing provenance enum. The transport of file events
    // is `native_plugin`, but session state currently accepts `agent_hook` and
    // must stay compatible with older CLI binaries.
    source: "agent_hook"
  });
  await runMetadataCommand(phase === "start" ? "session-start" : "session-end", payload);
}

/** Send one allowlisted metadata object to the local broker and never block Kilo. */
export async function emitMetadata(metadata: KiloProducerMetadata): Promise<void> {
  const payload = JSON.stringify({
    schema_version: 1,
    producer_version: 1,
    event_type: "file_change",
    event_id: metadata.event_id,
    occurred_at: metadata.occurred_at,
    entity: metadata.entity,
    project_root: metadata.project_root ?? null,
    change_kind: metadata.change_kind,
    previous_entity: metadata.previous_entity ?? null,
    agent: metadata.client_id,
    provider: metadata.provider_id ?? null,
    model: metadata.model_id ?? null,
    session_id: metadata.session_id ?? null,
    source: metadata.source,
    confidence: metadata.confidence,
    lines_added: metadata.lines_added ?? null,
    lines_deleted: metadata.lines_deleted ?? null,
    active_seconds: metadata.active_seconds ?? null,
    transport: metadata.transport,
    tool: metadata.tool ?? null,
    tool_event_id: metadata.tool_call_id ?? null
  });
  await runMetadataCommand("emit", payload);
}
