# Work Session Receipts — experimental rollout

A receipt represents one agent's native session on one collector, owned by one user. It assembles received usage facts and canonical operation evidence on read. It is not a task/productivity score or a record of every vendor interaction.

## Enable in a development deployment

1. Deploy all API replicas and usage fact-sink workers first, allowing their normal PostgreSQL and ClickHouse migrations to finish before updating collectors. PostgreSQL migration `027_work_session_outcomes.sql` stores outcomes/history; ClickHouse adds nullable `collector_id` to usage facts. Existing rows remain legacy. A mixed deployment with old fact writers cannot preserve the new collector metadata.
2. Deploy the updated collector/CLI. New usage records attach the persistent queue installation UUID and scope native sessions by installation + agent. AI heartbeat transport uses the same session scope and installation identity. Pending/delivered usage replays retain their original payload identity; queued heartbeats are delivered unchanged. Do not rewrite historical IDs or rescan old history to invent collector evidence.
3. Set `ATOAXIS_WORK_SESSIONS_ENABLED=true` and restart the API. Default is false. The AI page discovers the flag through `/api/v2/capabilities`; reload if a cached capability result is still displayed.
4. Open **AI Stats → Work sessions**. Filter by date, agent, and project. Selecting a session adds `?session=<opaque-id>` and opens its receipt. API keys/dashboard sessions use existing owner authorization; OAuth writers additionally need `write_ai_outcomes`.
5. PostgreSQL is optional for reading receipts. Without it, outcome controls remain unavailable. The feature flag gates both reads and outcome writes; ingestion continues when it is disabled.

Rollback: set the flag false and restart. Keep additive columns/tables and existing capture intact. No destructive rollback or automatic team sharing is required.

## Contracts

- `GET /api/v2/me/work-sessions`: start/end/timezone, optional agent/project_id/cursor/limit. Default 25, maximum 100. Date/project filters select sessions; summaries retain the whole session. Signed keyset cursors bind owner and filters and expire after one hour.
- `GET /api/v2/me/work-sessions/:id`: metadata-only receipt with field coverage, schema/calculation version, snapshot timestamp and revision fingerprint. Unknown owner/ID yields 404.
- `GET /api/v2/me/work-sessions/:id/evidence`: paginated canonical operation evidence; cursors also bind the revision set. Reload evidence after a correction changes that set.
- `PUT /api/v2/me/work-sessions/:id/outcome`: `{ "outcome": "completed" | "needs_work" | "abandoned" }`. Unknown fields/free text are rejected.
- `DELETE /api/v2/me/work-sessions/:id/outcome`: withdraw outcome. Each change is transactional and audited; both tables cascade on account deletion. The write holds the account activity lock and rechecks deletion.

Read routes require `read_ai_analytics`; outcome writes require `write_ai_outcomes`. Receipt facts and evidence are always scoped to the authenticated owner. Receipts never enter organization aggregates automatically.

Receipt reads have an explicit 10,000 usage-fact / 10,000 operation bound. Exceeding it returns an error rather than a partial total. This is an experimental read-time implementation; benchmark before increasing limits or adding materialization.

Only explicit project hints are used by receipt project filters/labels. Display names are resolved against the owner's project identities; missing names remain explicit. Legacy sole-project inferences are treated as unassigned in the receipt; no inferred allocation is silently promoted to source evidence. Legacy sessions without collector metadata or the new session scope retain usage visibility but do not join operations heuristically. Canonical winners are chosen before filtering mutable attribution fields, so a later unknown correction cannot resurrect an older verified row.

## Measurement semantics

- `null` is unavailable; a measured zero remains zero. Per-field coverage counts reporting records against **received** usage facts.
- `metrics_v2` adds nullable line-change shares. Existing numeric legacy shares retain their wire shape and are marked deprecated. Per-line token/cost ratios now return null for a zero denominator. Line changes mean additions + deletions, not retained code.
- Human attendance and human code authorship are separate. Dashboard line/keystroke totals display unavailable if no matching counters were reported.
- Observed window spans received session evidence; it is not execution time. Agent execution unions only explicit `ai_tool_v1` intervals on verified canonical rows. Legacy `ai` spans and gaps between usage events are excluded.
- Human context uses explicit `editor_active_v1` evidence for the same user's observed window. It does not prove work on the task. Combined/overlap remain unavailable unless both streams have interval evidence. Receipt times are not additive across sessions.
- Token classes are shown separately. Cost is estimated micro-USD with pricing versions; it is not a subscription bill. User outcomes are not test results.
- JSON download contains an allowlisted snapshot and up to 100 opaque evidence references; it is not a bulk evidence export. Project references use IDs; display names are omitted. No prompt, source, raw output, native session ID, absolute path or credential is exported.
- `ai_human_follow_up_events` means events can be received. `ai_human_follow_up` stays unavailable until its denominator/ledger is implemented.

## Runtime and field validation

Capture version metadata with:

```sh
python3 scripts/work-sessions/capture_runtime.py \
  --output /tmp/atoaxis-work-session-runtime.json \
  --collector-binary /path/to/the/actual/wakaclock
```

Omit `--collector-binary` if no tested binary exists yet; the digest stays null. This inventory always has `promotable: false` and does not certify a workflow.

Use the existing `scripts/ai-coverage/run_live_certification.py` harness with a real driver for Codex and Claude separately, exact tool/editor/extension/collector versions, build digest, tested commit and a reviewed metadata-only evidence artifact. Do not promote an adapter from synthetic tests or reuse an old certification for a changed tuple.

Campaign scenarios: human-only, AI-only, human follow-up, competing agents, formatter/external edit, multi-file and create/delete/rename, failed/no-op operation, retry/offline/out-of-order delivery, collector restart, sleep/idle and timezone boundaries. Record the expected action independently before inspecting receipt output. Use the duration-audit tools for an independent reference; WakaTime parity is a separate comparison.

For each scenario, keep a metadata-only ground-truth ledger with these columns. Fill the expected fields before opening analytics; leave unobserved values null rather than inferring them from the receipt.

| Field | Record |
| --- | --- |
| Run / runtime | Random run ID, inventory artifact, collector binary digest, tested commit |
| Scenario | Scenario name, Codex or Claude, opaque local session alias, project alias |
| Independent observation | UTC start/end, manually observed human/tool intervals, fixture diff additions/deletions when known |
| Delivery condition | Online/offline/retry/restart and the expected number of distinct operations |
| Expected missing data | Token classes, cost, authorship or intervals that cannot independently be checked |
| Readback | Receipt ID, snapshot fingerprint, observed mismatches, unknowns and evidence references |
| Review | Pass/fail/pending, reviewer, affected scenarios to repeat after a change |

Keep raw prompts, source code, output, credentials, native session IDs and absolute paths out of shared evidence bundles. Synthetic fixtures and independent live observations must be labeled separately.

Required before limited beta:

- At least seven calendar days of real observation, with at least ten sessions per agent on the tested tuple.
- Reviewed mismatches/unknowns, retry and isolation checks, privacy review, and database/browser checks on the release build.
- Five consenting pilot users; target four understand the key measurements/limits and three return for another session within seven days.
- If a capture/identity change affects a scenario, repeat the affected live evidence. Keep the unpassed adapter experimental.

No campaign or pilot completion is implied by the implementation or tests. Live certification, seven-day reference, ten sessions per agent and five-user pilot remain pending until actual evidence is collected.
