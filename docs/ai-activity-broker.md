# WakaClock AI Activity Broker

Phase 2 adds a local, durable ingress for AI file-activity evidence. It runs inside
the existing `wakaclock` binary; no second release artifact is required.

## Lifecycle

```text
wakaclock broker run
wakaclock broker install
wakaclock broker start
wakaclock broker stop
wakaclock broker status --json
wakaclock broker retry --event-id <id>
wakaclock broker retry --all
wakaclock broker rotate-token
```

`wakaclock agent` remains a compatibility alias for the same service implementation.
Interactive alias calls print a deprecation warning. The per-user service uses the
platform's existing LaunchAgent, systemd user service, or Task Scheduler integration.
Remote environments that cannot install a user service may keep `broker run` as an
Extension Host child process.

## Local API v1

The broker binds only to `127.0.0.1` on a dynamic port. Discovery metadata is written
to `~/.wakaclock/broker.json`; the bearer token is kept separately in
`~/.wakaclock/broker.token`. Both files are private to the current user on Unix, and
the token is not printed in logs, status output, or errors.

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

`accepted` means durable local acceptance, not successful backend delivery. The worker
processes the inbox and hands failed backend delivery to the existing outbound
heartbeat queue. Broker restart, backend outage, and process crash therefore leave the
event recoverable. A deterministic `broker:<event_id>` heartbeat identity makes retries
logically idempotent.

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

Claude Code, Codex CLI, and Gemini CLI native hooks emit the broker envelope through
`wakaclock ai emit`. Shell/MCP tools use `wakaclock ai tool-before` and
`wakaclock ai tool-after`; the latter emits one duration interval for a multi-file tool
call and one metadata event per changed file. Transcript sync also submits through the
broker. The old flat `wakaclock ai emit` JSON shape remains accepted and is normalized
before durable ingestion.

Human/editor and LSP heartbeats deliberately remain on their existing path in Phase 2.
Filesystem/process observers, native Tan middleware, and the full cross-producer
canonical evidence engine remain later Phase 3–5 and Phase 8–10 work.

## Diagnostics and privacy

Use `wakaclock broker status --json` to inspect running state, inbox counts, retry and
dead-letter counts, `last_received_at`, `last_processed_at`, `last_delivery_at`, and
the existing outbound queue depth.
Use `broker retry` only for dead-letter rows. Rotate the token with
`broker rotate-token`; a running service is restarted so the new token is active.

The inbox stores normalized event metadata and a payload hash. Processed payloads are
compacted after seven days while event IDs/hashes remain for thirty-day duplicate
detection. Dead-letter records are metadata-only and retained for thirty days. Logs,
status, and sidecar correlation records never contain prompts, responses, patch bodies,
source text, command arguments, or bearer tokens.
