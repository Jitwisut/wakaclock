# Universal producer boundary

`emit-event.sh` is the common shell boundary used by native AI-agent adapters.
It accepts an allowlisted metadata object on stdin and emits the existing Broker
Event v1 envelope through `wakaclock ai emit --json`.

The script never forwards stdin as a whole. It extracts only:

- event/session/tool identities
- client, provider and model labels
- workspace/file paths
- change kind and optional line counts
- timestamp, transport, source and confidence

Prompts, responses, source code, patch/diff bodies, command arguments, terminal
output and clipboard content are intentionally ignored. Hooks also fail open: a
missing CLI, `jq`, broker or network connection cannot block the agent's own edit.

Example metadata input:

```json
{
  "client_id": "kilo-code",
  "provider_id": "deepseek",
  "model_id": "deepseek-v4-pro",
  "session_id": "session-1",
  "tool_call_id": "call-1",
  "entity": "/workspace/src/main.rs",
  "project_root": "/workspace",
  "change_kind": "modify",
  "lines_added": 4,
  "lines_deleted": 1,
  "source": "agent_hook",
  "confidence": "verified",
  "transport": "native_plugin"
}
```

The Rust broker remains the final authority for path, actor, schema and payload
validation. This script is not a substitute for broker validation.

## Shared tool identity

`tool-event-id.sh` is the companion helper for `BeforeTool`, `AfterTool` and
failure/abort hooks. Source it and call `atoaxis_tool_event_id` with the agent,
working directory, session ID, call ID and tool name. The helper produces a
deterministic, path-safe ID so a failed tool can clear the same pending snapshot
created before execution. It is deliberately metadata-only and has no effect
when executed directly.

## Frozen repository context

`context-producer.py` and `activity-spool.ts` freeze context at the actual producer
boundary before any CLI identity handshake. They persist a metadata-only
`session_context` side observation through the existing spool before acknowledging
the primary observation. Native session identity and an explicit single workspace
root are required to observe Git; ambiguous roots, historical timestamps and
missing identity remain unresolved. Replay never reads current Git.

Retained context contains repository coordinates, branch/commit when observed,
native session identity, original observation time, scope and safe reason codes.
It excludes workspace paths, remote credentials, source/diff and message bodies.
An optional private `ATOAXIS_TEAM_CONTEXT_CONFIG` freezes a verified
account/origin/organization/collector/project/repository binding at the same
boundary. Adding configuration later does not establish historical binding.
The config must exist before the event and must match the verified queue scope.

The existing collector drains retained context during idle and preserves IDs and
hashes on retry. CLI durable inbox acceptance, server durable ingress and
canonical readback are separate observations. Empty queues do not certify
provider capture; provider/OS live certification remains a separate gate.
