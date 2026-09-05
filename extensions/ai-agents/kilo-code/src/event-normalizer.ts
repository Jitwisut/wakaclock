import { createHash } from "node:crypto";
import { normalizeModel, normalizeProvider } from "./provider-identity.ts";

export type ChangeKind = "create" | "modify" | "rename" | "delete";

export interface KiloProducerMetadata {
  client_id: "kilo-code";
  provider_id?: string;
  model_id?: string;
  event_id?: string;
  session_id?: string;
  tool_call_id?: string;
  occurred_at?: string;
  project_root?: string;
  entity: string;
  previous_entity?: string;
  change_kind: ChangeKind;
  lines_added?: number;
  lines_deleted?: number;
  source: "agent_hook";
  confidence: "verified" | "correlated" | "inferred";
  transport: "native_plugin";
  tool?: string;
  active_seconds?: number;
}

const MAX_ID = 128;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function label(value: unknown, keys: readonly string[]): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  const object = record(value);
  for (const key of keys) {
    const candidate = object[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

function firstLabel(keys: readonly string[], ...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = label(value, keys);
    if (result) return result;
  }
  return undefined;
}

function bounded(value: string | undefined): string | undefined {
  return value && value.length <= MAX_ID && !/[\u0000-\u001f\u007f]/.test(value) ? value : undefined;
}

function finiteCount(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number >= 0 && number <= 0xffffffff ? number : undefined;
}

function kind(raw: unknown): ChangeKind {
  const value = String(raw ?? "modify").trim().toLowerCase().replace(/[ -]+/g, "_");
  if (["create", "created", "add", "added", "new", "new_file"].includes(value)) return "create";
  if (["delete", "deleted", "remove", "removed", "unlink"].includes(value)) return "delete";
  if (["rename", "renamed", "move", "moved"].includes(value)) return "rename";
  return "modify";
}

/** Build a stable per-file ID without embedding the path in a wire event. */
export function stableEventId(input: {
  sessionId?: string;
  toolCallId?: string;
  entity: string;
  changeKind: ChangeKind;
  occurredAt?: string;
}): string {
  const material = [
    "atoaxis-kilo-code-v1",
    input.sessionId ?? "",
    input.toolCallId ?? "",
    input.entity,
    input.changeKind,
    input.occurredAt ?? ""
  ].join("|");
  return `ape1:${createHash("sha256").update(material).digest("hex").slice(0, 40)}`;
}

/**
 * Extract only file-change metadata from a Kilo event/tool object. This function
 * intentionally does not inspect `content`, `patch`, `command`, or tool output.
 */
export function extractFileChange(
  input: unknown,
  context: { sessionId?: string; directory?: string; model?: unknown; provider?: unknown } = {}
): KiloProducerMetadata | undefined {
  const root = record(input);
  const data = record(root.data);
  const properties = record(root.properties);
  const toolInput = record(root.tool_input ?? root.toolInput ?? root.args ?? data.tool_input);
  const toolOutput = record(root.tool_output ?? root.toolOutput ?? data.tool_output);
  const entity = firstString(
    root.entity, root.file_path, root.filePath, root.path,
    data.entity, data.file_path, data.filePath, data.path,
    properties.entity, properties.file_path, properties.filePath, properties.path,
    toolInput.file_path, toolInput.filePath, toolInput.path,
    toolOutput.file_path, toolOutput.filePath, toolOutput.path
  );
  if (!entity) return undefined;
  const projectRoot = firstString(root.project_root, root.workspace_root, root.cwd, context.directory);
  const sessionId = bounded(firstString(root.session_id, root.sessionId, data.session_id, context.sessionId));
  const toolCallId = bounded(firstString(root.tool_call_id, root.toolCallId, root.call_id, root.callId));
  const occurredAt = firstString(root.occurred_at, root.occurredAt, root.timestamp) ?? new Date().toISOString();
  const provider = normalizeProvider(firstLabel(
    ["id", "name", "slug", "provider"],
    root.provider_id,
    root.provider,
    data.provider_id,
    data.provider,
    context.provider
  ));
  const model = normalizeModel(firstLabel(
    ["id", "name", "slug", "model"],
    root.model_id,
    root.model,
    data.model_id,
    data.model,
    context.model
  ));
  const changeKind = kind(firstString(root.change_kind, root.changeKind, root.operation, root.kind, toolInput.operation));
  // Event IDs are opaque identities, never a transport for prompts, commands,
  // or path-bearing values. Keep the shared broker alphabet at this adapter
  // boundary so malformed/free-form IDs remain retry-stable after hashing.
  const suppliedEventId = bounded(firstString(root.event_id, root.eventId));
  const eventId = suppliedEventId && /^[A-Za-z0-9._:-]+$/.test(suppliedEventId)
    ? suppliedEventId
    : stableEventId({
    sessionId,
    toolCallId,
    entity,
    changeKind,
    occurredAt
  });
  const result: KiloProducerMetadata = {
    client_id: "kilo-code",
    provider_id: provider,
    model_id: model,
    event_id: eventId,
    session_id: sessionId,
    tool_call_id: toolCallId,
    occurred_at: occurredAt,
    project_root: projectRoot,
    entity,
    previous_entity: firstString(root.previous_entity, root.previousEntity, root.old_path, data.old_path),
    change_kind: changeKind,
    lines_added: finiteCount(root.lines_added ?? root.linesAdded ?? data.lines_added),
    lines_deleted: finiteCount(root.lines_deleted ?? root.linesDeleted ?? data.lines_deleted),
    source: "agent_hook",
    confidence: "verified",
    transport: "native_plugin",
    tool: bounded(firstString(root.tool, root.tool_name, root.toolName, toolInput.tool)),
    active_seconds: typeof root.active_seconds === "number" && Number.isFinite(root.active_seconds) && root.active_seconds >= 0
      ? Math.min(root.active_seconds, 120)
      : undefined
  };
  return result;
}
