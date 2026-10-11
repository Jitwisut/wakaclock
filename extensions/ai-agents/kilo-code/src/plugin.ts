import { extractFileChange, type KiloProducerMetadata } from "./event-normalizer.ts";
import { emitActivityMarker, emitMetadata, runSessionLifecycle, runToolLifecycle } from "./producer-client.ts";

type AnyRecord = Record<string, any>;

function getString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

function getMetadataLabel(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const object = value as AnyRecord;
    for (const key of ["id", "name", "slug", "provider", "model"]) {
      const candidate = object[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return undefined;
}

function isShellTool(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return ["shell", "bash", "run_shell", "shell_command", "exec", "execute"].includes(value.trim().toLowerCase());
}

function safePendingInput(input: AnyRecord, identity: ReturnType<typeof contextIdentity>): AnyRecord {
  return {
    session_id: getString(input.sessionID, input.sessionId, input.session_id, identity.sessionId),
    provider: getMetadataLabel(input.provider_id, input.provider, identity.provider),
    model: getMetadataLabel(input.model_id, input.model, identity.model),
    cwd: getString(input.cwd, input.directory, input.worktree, identity.directory),
    tool: getString(input.tool, input.name, input.tool_name),
    tool_call_id: getString(input.callID, input.callId, input.toolCallId, input.tool_call_id),
    file_path: getString(input.file_path, input.filePath, input.path)
  };
}

function contextIdentity(ctx: AnyRecord): { sessionId?: string; directory?: string; model?: unknown; provider?: unknown } {
  return {
    sessionId: getString(ctx.sessionID, ctx.sessionId, ctx.session_id),
    directory: getString(ctx.directory, ctx.worktree, ctx.project?.directory),
    model: ctx.model,
    provider: ctx.provider
  };
}

function sessionLifecycleInput(
  event: AnyRecord,
  current: ReturnType<typeof contextIdentity>
): { sessionId: string; agent: string; provider?: unknown; model?: unknown; directory?: string } | undefined {
  const data = event.data && typeof event.data === "object" ? event.data as AnyRecord : {};
  const properties = event.properties && typeof event.properties === "object" ? event.properties as AnyRecord : {};
  const sessionId = getString(
    event.sessionID,
    event.sessionId,
    event.session_id,
    data.sessionID,
    data.sessionId,
    data.session_id,
    properties.sessionID,
    properties.sessionId,
    properties.session_id,
    current.sessionId
  );
  if (!sessionId) return undefined;
  return {
    sessionId,
    agent: "kilo-code",
    provider: getMetadataLabel(event.provider_id, event.provider, data.provider_id, data.provider, current.provider),
    model: getMetadataLabel(event.model_id, event.model, data.model_id, data.model, current.model),
    directory: getString(
      event.cwd,
      event.directory,
      event.worktree,
      data.cwd,
      data.directory,
      data.worktree,
      current.directory
    )
  };
}

/** Kilo server plugin. All hooks are best-effort and fail open by design. */
const server = async (ctx: AnyRecord, options: { activitySurface?: "cli" | "ide" } = {}) => {
  const DEDUP_WINDOW_MS = 120_000;
  const pending = new Map<string, { input: AnyRecord; at: number }>();
  const emitted = new Map<string, number>();
  const identity = () => contextIdentity(ctx);
  const activity = async (phase: "before" | "after" | "failure", input: AnyRecord) => {
    // The same plugin runs in CLI and IDE. Require explicit configuration rather
    // than inferring a surface from a missing runtime or process name.
    if (!["cli", "ide"].includes(options.activitySurface ?? "")) return;
    const current = identity();
    const sessionId = getString(input.sessionID, input.sessionId, input.session_id, current.sessionId);
    const callId = getString(input.callID, input.callId, input.toolCallId, input.tool_call_id);
    const directory = getString(input.cwd, input.directory, input.worktree, current.directory);
    if (!sessionId || !callId || !directory) { console.warn("AtoAxis: activity_context_unresolved"); return; }
    await emitActivityMarker({ phase, sessionId, callId, directory, surface: options.activitySurface! }).catch(() => {
      // Keep the host fail-open while exposing the failure without payload text.
      console.warn("AtoAxis: activity_durable_handoff_failed");
    });
  };
  const emitOnce = async (raw: unknown) => {
    const metadata = extractFileChange(raw, identity());
    if (!metadata) return;
    // Kilo can report one successful tool through both `tool.execute.after` and
    // `file.edited`. Use the shared tool identity for that pair. Do not collapse
    // two independent edits to the same file merely because they happened within
    // the two-second reconciliation window; if Kilo omitted a tool id, event_id
    // is the only safe identity and each event is retained.
    const semanticKey = metadata.tool_call_id
      ? `${metadata.session_id ?? ""}|${metadata.tool_call_id}|${metadata.entity}|${metadata.change_kind}|${metadata.lines_added ?? ""}|${metadata.lines_deleted ?? ""}`
      : undefined;
    const now = Date.now();
    const last = emitted.get(metadata.event_id ?? "")
      ?? (semanticKey ? emitted.get(semanticKey) : undefined);
    // Kilo can deliver the paired `file.edited` callback well after the tool
    // completion callback. Keep exact operation identity long enough for the
    // callback/retry path to converge, while independent tool calls retain
    // distinct IDs and are never collapsed by elapsed time alone.
    if (last && now - last < DEDUP_WINDOW_MS) return;
    try { await emitMetadata(metadata, options.activitySurface ?? "unknown"); }
    catch { console.warn("AtoAxis: file_durable_handoff_failed"); return; }
    emitted.set(metadata.event_id ?? "", now);
    if (semanticKey) emitted.set(semanticKey, now);
    if (emitted.size > 4_000) {
      for (const [key, at] of emitted) if (now - at > 120_000) emitted.delete(key);
    }
  };
  const cleanup = () => {
    const cutoff = Date.now() - 120_000;
    for (const [id, state] of pending) if (state.at < cutoff) pending.delete(id);
  };

  return {
    "tool.execute.before": async (input: AnyRecord) => {
      const marker = activity("before", input);
      try {
      cleanup();
      const id = getString(input.callID, input.callId, input.toolCallId, input.tool_call_id);
      const tool = getString(input.tool, input.name, input.tool_name);
      if (id) {
        pending.set(id, { input: safePendingInput(input, identity()), at: Date.now() });
        if (isShellTool(tool)) {
          const current = identity();
          await runToolLifecycle("before", {
            surface: options.activitySurface ?? "unknown",
            toolEventId: id,
            agent: "kilo-code",
            provider: input.provider ?? current.provider,
            model: input.model ?? current.model,
            sessionId: input.sessionID ?? input.sessionId ?? current.sessionId,
            tool,
            directory: input.cwd ?? input.directory ?? input.worktree ?? current.directory
          });
        }
      }
      } catch { console.warn("AtoAxis: tool_durable_handoff_failed"); } finally { await marker; }
    },
    "tool.execute.after": async (input: AnyRecord, output: AnyRecord) => {
      const marker = activity(output?.error || output?.success === false ? "failure" : "after", input);
      try {
      cleanup();
      const id = getString(input.callID, input.callId, input.toolCallId, input.tool_call_id);
      const before = id ? pending.get(id) : undefined;
      if (id) pending.delete(id);
      const tool = getString(input.tool, input.name, input.tool_name, before?.input.tool);
      if (output?.error || output?.success === false) {
        if (id && isShellTool(tool)) await runToolLifecycle("abort", {
          surface: options.activitySurface ?? "unknown",
            toolEventId: id,
          agent: "kilo-code",
          provider: input.provider ?? ctx.provider,
          model: input.model ?? ctx.model,
          sessionId: input.sessionID ?? input.sessionId ?? ctx.sessionID,
          tool,
          directory: input.cwd ?? input.directory ?? input.worktree ?? ctx.directory
        });
        return;
      }
      if (id && isShellTool(tool)) {
        await runToolLifecycle("after", {
          surface: options.activitySurface ?? "unknown",
            toolEventId: id,
          agent: "kilo-code",
          provider: input.provider ?? ctx.provider,
          model: input.model ?? ctx.model,
          sessionId: input.sessionID ?? input.sessionId ?? ctx.sessionID,
          tool,
          directory: input.cwd ?? input.directory ?? input.worktree ?? ctx.directory
        });
        return;
      }
      // The object contains only paths/IDs/counts; extractFileChange ignores output text.
      await emitOnce({ ...input, ...output, tool_call_id: id });
      if (before && !getString(input.file_path, input.filePath, input.path)) {
        await emitOnce({ ...before.input, ...output, tool_call_id: id });
      }
      } catch { console.warn("AtoAxis: tool_durable_handoff_failed"); } finally { await marker; }
    },
    event: async ({ event }: { event: AnyRecord }) => {
      const eventData = event?.data && typeof event.data === "object" ? event.data as AnyRecord : {};
      const eventType = getString(event?.type, event?.event_type, eventData.type, eventData.event_type);
      const current = identity();
      // Kilo's event stream is the lifecycle surface shared by its CLI and VS
      // Code runtimes. A created/updated session starts (or resumes) the local
      // bounded interval; idle/error/deleted closes it at the last event Kilo
      // actually reported. We never use `now` or infer an interval from a file
      // edit, and all failures remain fail-open.
      const lifecycle = sessionLifecycleInput(event, current);
      if (lifecycle) {
        if (eventType === "session.created" || eventType === "session.updated") {
          await runSessionLifecycle("start", {...lifecycle,surface:options.activitySurface ?? "unknown"}).catch(()=>console.warn("AtoAxis: session_durable_handoff_failed"));
        } else if (["session.idle", "session.error", "session.deleted"].includes(eventType ?? "")) {
          await runSessionLifecycle("end", {...lifecycle,surface:options.activitySurface ?? "unknown"}).catch(()=>console.warn("AtoAxis: session_durable_handoff_failed"));
        }
      }
      // `file.edited` is emitted by Kilo's successful edit path. A filesystem
      // watcher update can also describe a human/external write, so it is not
      // promoted to AI evidence without a matching pending tool call.
      if (eventType === "file.edited") {
        await emitOnce(event);
      }
      if (["session.error", "session.deleted"].includes(eventType ?? "")) {
        for (const [id, state] of pending) {
          const tool = getString(state.input.tool);
          if (isShellTool(tool)) await runToolLifecycle("abort", {
            surface: options.activitySurface ?? "unknown",
            toolEventId: id,
            agent: "kilo-code",
            provider: state.input.provider,
            model: state.input.model,
            sessionId: state.input.session_id,
            tool,
            directory: state.input.cwd
          }).catch(() => console.warn("AtoAxis: tool_durable_handoff_failed"));
        }
        pending.clear();
        cleanup();
      }
    }
  };
};

export default { id: "atoaxis-kilo-code", server };
