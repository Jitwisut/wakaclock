# WakaClock on-demand AI activity pipeline

The supported runtime is a short-lived `wakaclock` CLI process. Hooks and editor
events write to the existing SQLite inbox, process a bounded batch, and exit. The
old local HTTP broker remains only as migration/compatibility code and is never
started or discovered by producers.

## Lifecycle

```text
wakaclock sync --json                 # one bounded transcript + queue pass
wakaclock sync --agent codex --json   # one adapter, then exit
wakaclock broker status --json        # local queue and legacy-service diagnostics
wakaclock broker retry --event-id <id>
wakaclock broker retry --all
```

`wakaclock broker install`, `broker start`, `broker run`, and the `agent` aliases are
deprecated cleanup shims. They remove a legacy registration and/or perform one bounded
sync; they never create a LaunchAgent, systemd unit, scheduled task, socket, or token.

## Legacy local API (migration only)

No supported command binds this API or writes discovery/token files. Existing files are
removed by the migration shims. The HTTP handlers remain in the binary only so older
test fixtures and cleanup paths can be retired without changing the event schema.

```text
GET  /v1/health          # public liveness/version check
GET  /v1/status          # Authorization: Bearer <token>
POST /v1/events          # Authorization: Bearer <token>
POST /v1/events/batch    # Authorization: Bearer <token>
```

Single events are limited to 64 KiB. A batch is limited to 500 events and 2 MiB. A
single event returns `202` when it is newly committed to the SQLite inbox, `200` when
the same event ID and payload hash already exist, and `409` when an event ID is reused
with a different payload. Missing/invalid credentials return `401`; invalid schema or
attribution returns `422`; an oversized request returns `413`.

`accepted` means durable local acceptance, not successful backend delivery. The same
short-lived CLI invocation claims a leased batch and hands failed backend delivery to
the existing outbound heartbeat queue. A crash leaves the lease recoverable; a
deterministic `broker:<event_id>` heartbeat identity makes retries logically idempotent.

## Event contract

`POST /v1/events` accepts the strict metadata-only `BrokerEventV1` envelope. The first
version supports `event_type: "file_change"` and `change_kind: "create"`, `"modify"`,
`"rename"`, or `"delete"`.

```json
{
  "schema_version": 1,
  "event_type": "file_change",
  "event_id": "session-42:tool-7:src/app.ts",
  "occurred_at": "2026-08-30T10:30:00Z",
  "entity": "/project/src/app.ts",
  "project_root": "/project",
  "change_kind": "modify",
  "agent": "chatgpt",
  "provider": "openai",
  "session_id": "session-42",
  "source": "mcp",
  "confidence": "verified",
  "lines_added": 12,
  "lines_deleted": 4,
  "transport": "mcp",
  "tool": "tan.apply_patch",
  "tool_event_id": "tool-7"
}
```

Paths must be absolute; an entity must remain under `project_root` when a root is
provided. Rename events must include `previous_entity`. A null line counter means
unknown and is never converted to zero. Prompt text, model responses, patch bodies,
source content, command arguments, and unknown fields are rejected.

The shared attribution resolver fills `actor_type` and `actor_confidence` in every
response. Native verified hooks resolve to `ai_verified/1.0`, structured MCP events to
`ai_verified/0.95`, correlated evidence to `ai_inferred/0.8`, and transcript or weak
legacy evidence to `ai_inferred/0.6`. Unknown editor evidence remains `unknown/0.0`.
The deprecated `is_ai_generated` heartbeat field is derived only at the final heartbeat
adapter and is never used to infer Human activity.

## Producer migration

Claude Code, Codex CLI, and Gemini CLI native hooks emit the metadata envelope through
`wakaclock ai emit` and trigger a bounded `wakaclock sync --automatic --json` pass.
Shell/MCP tools use `wakaclock ai tool-before` and
`wakaclock ai tool-after`; the latter emits one duration interval for a multi-file tool
call and one metadata event per changed file. Transcript sync also submits through the
broker. The old flat `wakaclock ai emit` JSON shape remains accepted and is normalized
before durable ingestion.

Human/editor and LSP heartbeats deliberately remain on their existing path. The
cross-producer filesystem/process observer and canonical correlation engine are now
wired into the local broker, but remain disabled until `observer.toml` is explicitly
enabled and the shadow precision gate is met. Native Tan middleware is still a
separate producer rollout; it is not silently installed by the broker.

## Diagnostics and privacy

Use `wakaclock broker status --json` to inspect `runtime_mode=on_demand`, inbox counts,
retry/dead-letter counts, `last_received_at`, `last_processed_at`, `last_delivery_at`,
legacy-service presence, and the existing outbound queue depth. Use `broker retry` only
for dead-letter rows. There is no runtime token to rotate.

The inbox stores normalized event metadata and a payload hash. Processed payloads are
compacted after seven days while event IDs/hashes remain for thirty-day duplicate
detection. Dead-letter records are metadata-only and retained for thirty days. Logs,
status, and sidecar correlation records never contain prompts, responses, patch bodies,
source text, command arguments, or bearer tokens.

## Universal observer rollout

The on-demand CLI can correlate native/transcript events with bounded filesystem and
process/session evidence. It reads only the session/workspace needed for the triggering
event; `$HOME`, `/`, `/tmp`, and non-Git directories are never watched continuously.

The rollout is fail-closed by default. Create `~/.wakaclock/observer.toml` to enable
shadow capture first:

```toml
enabled = true
attribution_mode = "observe_only"
```

After an independently labelled shadow corpus reaches the documented precision gate,
change only `attribution_mode` to `"infer"`. This is a reversible config change and
does not migrate or delete heartbeat data. `wakaclock ai shadow-report --json` reads
the bounded metadata-only corpus and reports universal inference precision separately
from native adapter recall. Pipeline states are available in
`wakaclock broker status --json` and `wakaclock doctor ai --json`.
