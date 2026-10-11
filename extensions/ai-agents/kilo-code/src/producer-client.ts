import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { retainToolMarker, retainMetadata } from "../../common/activity-spool.ts";
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

type Surface = "cli" | "ide" | "unknown";
interface SessionLifecycleInput {
  surface?: Surface;
  sessionId: string;
  agent: string;
  provider?: unknown;
  model?: unknown;
  directory?: string;
}

/** A native marker is retained in the private producer spool before CLI handoff.
 * Missing/old CLI and response loss keep the original observation for the idle collector.
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
  await retainToolMarker(await cliPath(), { ...input, adapter: "kilo-code" }, process.env.ATOAXIS_PRODUCER_HOME || homedir());
}

function runToolBoundary(cli: string, phase: ToolLifecycle, metadata: string, surface: Surface): Promise<void> {
  const helper = fileURLToPath(new URL("../../common/tool-boundary-producer.py", import.meta.url));
  return new Promise<void>((resolve, reject) => {
    const child = spawn("python3", [helper, "--phase", phase, "--cli", cli, "--surface", surface], {
      stdio: ["pipe", "ignore", "pipe"]
    });
    // The helper freezes and fsyncs evidence before touching the CLI. Its stderr
    // contains safe status codes only, including pending/ownership failures.
    child.stderr.on("data", () => { console.warn("AtoAxis: tool_boundary_status_pending"); });
    child.stdin.on("error", () => undefined);
    child.stdin.end(metadata);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("producer_boundary_capture_timeout"));
    }, 60_000);
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(); else reject(new Error("producer_boundary_capture_failure"));
    });
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("producer_boundary_capture_failure"));
    });
  });
}

/**
 * Freeze a metadata-only shell snapshot at the hook boundary. Kilo's shell tool does
 * not expose a file list in its completion event, so the shared before/after
 * engine is the only safe fallback. The object is constructed from an explicit
 * allowlist; command text and tool output never cross this process boundary.
 */
export async function runToolLifecycle(
  phase: ToolLifecycle,
  input: {
    surface?: Surface;
    toolEventId: string;
    agent: string;
    provider?: unknown;
    model?: unknown;
    sessionId?: string;
    tool?: string;
    directory?: string;
  }
): Promise<void> {
  const metadata = {
    tool_event_id: input.toolEventId,
    agent: input.agent,
    provider: typeof input.provider === "string" ? input.provider : null,
    model: typeof input.model === "string" ? input.model : null,
    session_id: input.sessionId ?? null,
    tool: input.tool ?? null,
    transport: "tool_snapshot",
    workspace_root: input.directory ?? null
  };
  await runToolBoundary(await cliPath(), phase, JSON.stringify(metadata), input.surface ?? "unknown");
}

/**
 * Retain Kilo session lifecycle markers with their observed timestamps. These
 * metadata-only markers claim neither measured execution intervals nor edits.
 */
export async function runSessionLifecycle(
  phase: SessionLifecycle,
  input: SessionLifecycleInput
): Promise<void> {
  if (!input.sessionId.trim()) return;
  const metadata = {
    session_id: input.sessionId,
    agent: input.agent,
    provider: typeof input.provider === "string" ? input.provider : null,
    model: typeof input.model === "string" ? input.model : null,
    cwd: input.directory ?? null,
    // `source` is the existing provenance enum. The transport of file events
    // is `native_plugin`, but session state currently accepts `agent_hook` and
    // must stay compatible with older CLI binaries.
    source: "agent_hook",
    occurred_at: new Date().toISOString()
  };
  await retainMetadata(await cliPath(), {adapter: "kilo-code", surface: input.surface ?? "unknown", kind: phase === "start" ? "session_start" : "session_end", metadata}, process.env.ATOAXIS_PRODUCER_HOME || homedir());
}

/** Send one allowlisted metadata object to the local broker and never block Kilo. */
export async function emitMetadata(metadata: KiloProducerMetadata, surface: Surface = "unknown"): Promise<void> {
  const payload = {
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
  };
  await retainMetadata(await cliPath(), {adapter: "kilo-code", surface, kind: "file_mutation", metadata: payload}, process.env.ATOAXIS_PRODUCER_HOME || homedir());
}
