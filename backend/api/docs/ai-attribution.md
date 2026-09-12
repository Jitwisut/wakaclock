# AI attribution identity

Wakaclock treats **who changed a file** and **which model was used** as separate
facts. A completed Codex or Claude Code tool call can therefore stay in the AI
activity totals when the transcript does not report a model, while the model
table only includes rows whose agent, provider, and model are all backed by the
same trusted event or turn.

## Wire fields

The following fields are optional additions to heartbeat payloads and responses:

| Field | Meaning |
| --- | --- |
| `identity_status` | `confirmed`, `partial`, `conflict`, or `unavailable` |
| `identity_reason` | Stable reason code when the tuple is incomplete or conflicting |
| `identity_source` | The source used for the tuple (`transcript`, `agent_hook`, `mcp`, or `structured_mcp`) |
| `identity_schema_version` | Current value is `1` |
| `session_id` | Opaque stable agent session scope; prevents reused tool ids crossing sessions |
| `identity_turn_id` / `identity_message_id` | Opaque references used to audit the match |

`confirmed` requires a known adapter, a canonical provider from a documented
alias/first-party endpoint, an explicit model, and a trusted source/confidence.
The server never infers a provider from an agent name or a model prefix. A new
model ID is accepted when the provider reports it, but an unknown provider stays
unresolved until its alias or endpoint is explicitly supported. Values such as
`Model not reported`, `Internal model marker`, `unknown`, and `<synthetic>` are
treated as missing evidence.

Older clients remain ingestible. A legacy payload that happens to contain three
non-empty strings is not promoted to `confirmed` without the source and
confidence evidence.

## Repair workflow

The CLI reads local transcripts and is read-only by default:

```text
wakaclock ai repair --agent codex --from 2026-09-01 --to 2026-09-12
```

The report includes parser version, transcript count, event/heartbeat count,
line totals, identity status/reason counts, and opaque event/session/tool
references. It never uploads prompts, responses, patches, or source code.

After reviewing the dry-run report, apply only complete candidates:

```text
wakaclock ai repair --agent codex --from 2026-09-01 --to 2026-09-12 --apply
```

`--apply` sends metadata corrections to `POST /api/v1/ai/identity/repair`.
The server looks up each existing canonical heartbeat by the `ai_event_id` and
optional `session_id` scope, writes
an append-only revision, and copies the original activity segments, measured
seconds, timestamps, and line counters unchanged. Identity references are not
part of the canonical operation key, so adding a turn/message reference still
replaces the same heartbeat revision. Repeating the same request is idempotent;
conflicting or unmatched references remain unresolved and a conflict never
silently overwrites an earlier confirmed tuple.

Each applied run is recorded in `ai_identity_repair_runs`; each changed tuple is
audited in `ai_identity_repair_corrections` with identity-only before/after JSON.
The correction endpoint cannot accept measured values or content fields. To roll
back a correction, create a later revision with the previous tuple; do not delete
the audit history.

Historical rows without a stable `ai_event_id` or matching tool/turn evidence
cannot be repaired safely. They remain in the incomplete/inferred sections so
their original activity and heartbeat totals stay visible.

## Dashboard contract

The primary AI table selects `ai_verified + identity_status=confirmed`. Incomplete
and conflict rows remain available in the review section with reason codes and
their full AI line/heartbeat totals. Human and unknown authorship stays visible.
The API `identity` summary is computed after the canonical max-revision
projection, so a correction cannot make the original and corrected revision
count twice.
