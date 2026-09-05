# Phase 8 end-to-end verification (2026-08-14)

This documents an actual run, not a description of intended behavior. `wakaclock ai
sync` was pointed at a real, live Claude Code session (the one that wrote this
codebase) against a local `wakaclock-server` + ClickHouse (docker-compose).

## What was run

```sh
wakaclock ai status
wakaclock ai sync --agent claude-code --dry-run
wakaclock ai sync --agent claude-code
wakaclock ai sync --agent claude-code   # again, to check idempotency
```

## What it found

- `wakaclock ai status` correctly discovered the transcript file for *this exact,
  currently-running* Claude Code session — proof discovery isn't reading a fixture or
  a stale file.
- The first `sync` parsed 32 real `Edit`/`Write` tool calls from this session and sent
  32 AI-attributed heartbeats (`ai_agent=claude-code`, `ai_source=transcript`,
  `ai_confidence=verified`, correct file paths, correct `ai_model=claude-sonnet-5`).
- A malformed record (a failed `Edit` attempt, and separately two tool calls blocked by
  an unrelated permission classifier) was correctly isolated as a warning per
  transcript line rather than aborting the whole batch — plan.md 8.4's per-agent error
  isolation, observed working against a real edge case, not just a fixture.
- The second `sync` run found 0 new events for already-delivered edits — idempotency
  holds via `state.rs`'s `delivered_events` table.

## A real bug found and fixed during this run

The first sync sent several heartbeats with `ai_lines_added = 0` for files that were
genuinely brand-new (not edits). Root cause: `claude.rs` assumed
`toolUseResult.structuredPatch` always contains the change; real data showed a
brand-new file's `structuredPatch` is an **empty array**, with the content only in
`toolUseResult.content`. Fixed by adding `patch::count_content_lines()` as a fallback
when `structuredPatch` is empty but `content` is present — see `CAPABILITIES.md`'s
2026-08-14 correction note and `write_tool_result.json`'s updated fixture (which now
matches the real shape, not the originally-assumed one).

This file's own creation (a genuine new-file `Write`) is itself the live end-to-end
check for that fix: query `wakaclock.heartbeats` for `entity` ending in
`VERIFICATION.md` and `ai_source = 'transcript'` — `ai_lines_added` should be non-zero,
not 0.

## Known artifact in the local demo database

The local ClickHouse instance used for this run still contains the ~17 pre-fix rows
with `ai_lines_added = 0` from before the fix above landed — `TRUNCATE` was correctly
blocked by the sandbox's destructive-action classifier, and re-running sync only
resends genuinely new events (by design — that's the idempotency guarantee working
as intended), not a re-send of already-delivered ones. This is a leftover of live
bug-hunting in a disposable local dev database, not a defect in the delivered code.

## Phase 8 Codex verification (2026-08-31)

Unlike the Claude Code run above, this used 156 pre-existing real local session files
under `~/.codex/sessions/` (past real usage, not a session created for this
verification pass) — `wakaclock ai sync --agent codex --dry-run --from-start` against
all of them, no server contacted.

## A real bug found and fixed during this run

Every one of the 156 real sessions returned **zero** events, even from a cold cursor.
`codex.rs` was written against an `event_msg`/`payload.type == "patch_apply_end"`
shape that does not exist in any of these real files. The actual real-world shape is a
`response_item` pair: `custom_tool_call` (`name: "apply_patch"`, carrying the patch
text in `input`) followed by a `custom_tool_call_output` proving the call completed —
confirmed by inspecting field names and record-type distributions directly (never the
patch/prompt content itself, per this module's own privacy contract). `record_type`'s
match had no arm for `"response_item"` at all, so every real apply_patch call in every
real session was silently invisible to `wakaclock ai sync` — this had never been
caught because Codex verification had only ever run against fixtures (see the
"Still not verified" note this replaces).

Fixed by:
- Adding a `"response_item"` match arm that tracks `custom_tool_call`/
  `custom_tool_call_output` pairs by `call_id`, correlating each to the most recently
  seen `turn_context` for model/cwd (these records carry no `turn_id` of their own,
  unlike `patch_apply_end`).
- Adding `patch::parse_apply_patch()`, a Rust port of the OpenAI apply_patch DSL
  parser the shell hook (`extensions/ai-agents/codex/heartbeat-hook.sh`) already
  implements in awk, so the transcript parser and the shell hook agree on one rule.
- `SessionMetaPayload.session_id` gained `#[serde(alias = "id")]`: real `session_meta`
  payloads key the session id as `id`, not `session_id`.
- The old `event_msg`/`patch_apply_end` arm was kept, not removed — a smaller number
  of real sessions (older Codex builds, by session date) do still use it, confirmed by
  the dry-run output.

Re-running the same dry-run after the fix against the same 156 real sessions: **2,642
events found** (up from 0), of which 649 came from the new `response_item` path this
fix added. No content was sent anywhere — `--dry-run` only.

## planai2.md Phase 0.3 — Codex integration (partial, 2026-08-31)

Done and tested: the VS Code installer now (a) repoints a stale `command = "…"`
line inside an AtoAxis-managed block in `~/.codex/config.toml` when a plugin
upgrade moves the bundled scripts to a new version-stamped directory, touching
nothing outside the managed markers (`refreshManagedCodexHookCommands`), and
(b) refuses to register a hook path outside `~/.wakaclock/agent-plugins/`
(`assertStableManagedHookPath`) so a VSIX-unpack or dev-worktree path can never
be written into a user's config. `ensureCodexHook` / `ensureCodexHooksFeature`
were already idempotent and already migrated the deprecated `codex_hooks`
feature name.

**Not done — native Codex plugin packaging.** planai2.md §0.3 also asks for an
"AtoAxis Codex plugin package in the current native plugin layout" to replace
the direct-TOML hook block. This machine has no Codex build exposing a
documented plugin/extension install API (unlike `claude plugin marketplace add`
/ `gemini extensions install`), so there is no real target to package against
and no way to live-verify one. The shipped, working mechanism remains the
direct managed-TOML block. This sub-item is deferred, not certified — revisit on
a machine with a Codex release that documents a plugin manifest format.

## planai2.md Phase 2 — adapter rollout (p2.3, 2026-08-31)

`AdapterRegistry::builtin()` now also carries manifests for the rollout-order 4–10
agents so the pipeline *knows about* them and shows them honestly, rather than
silently having no entry. **None is live-verified. None has a parser.** They are
data only:

| id | status | why |
|---|---|---|
| `cursor` | `scaffold` | hook payload shape (`afterFileEdit`, `.cursor/hooks.json`) is from Cursor's public docs + `extensions/ai-agents/cursor/` — never run against a real Cursor, never inspected a real `stdin.json` |
| `generic-mcp` | `scaffold` | the `wakaclock ai emit --json` / `ai tool-before` / `ai tool-after` ingress path itself is real and tested (p2.2); no specific external MCP producer is verified |
| `antigravity`, `copilot`, `windsurf`, `cline`, `roo-code`, `opencode` | `unverified` | no tool on any inspection machine, no documented AtoAxis integration point inspected yet |

To promote any of these: install the real tool, capture a real payload, write the
parser, run it end to end, then set `Verification::verified(<when>, <tool version>)`
and record the run here. A fixture is not enough (planai2.md line 604).

## Still not verified against a live system

- Claude post-migration real API/tool execution: the installed plugin is wired and
  its metadata-only smoke reached the broker, but the local OAuth session expired
  before Claude could make a tool call. The pre-migration live baseline is retained;
  re-authentication is required before promoting the migrated hook.
- Kilo Code and Kimi Code CLI: both adapters are installed as tested scaffolds, but
  neither native executable is installed on this machine, so there is no honest live
  tool-version/backend-row claim yet.
- Gemini CLI: still entirely unverified — no local installation and no real Gemini
  transcript available on this machine, so no fixture is being promoted to a live
  verification claim.
- `correlation.rs` (matching against a live VS Code editor buffer) was not exercised
  here — this sync path intentionally bypasses it, per its own doc comment, since
  there is no editor buffer when reading a transcript directly.
- The old `extensions/ai-agents/` hooks are still active in parallel on this machine
  and also send heartbeats for the same edits under `ai_source = 'agent_hook'` with a
  different `ai_event_id` scheme. The server now bridges that transport boundary with a
  privacy-safe fingerprint (normalized path suffix, project/branch, five-second bucket and
  line deltas), while preserving explicit event IDs as the strongest dedup key. A real
  cross-transport run is still an operational verification task; the fingerprint itself is
  covered by server unit tests. Codex native-hook plus transcript replay was verified
  against one backend row, but a separate legacy shell-hook collision run is still
  required before this item can be promoted broadly.

## Universal producer rollout (Phase 1, 2026-09-01)

The shared Rust producer contract and metadata-only shell boundary are implemented
and covered by unit/smoke tests. Identity is normalized as separate
`client_id`/`provider_id`/`model_id` values, event IDs are stable across retries,
and native wrappers reject/ignore content-bearing fields before broker validation.
This is code/test evidence only; no new live adapter is promoted by this section.

## Kilo Code and Kimi Code (Phases 4–5, 2026-09-01)

Both adapters are shipped as scaffolds. Kilo has a TypeScript server plugin that
works in the documented CLI/VS Code plugin runtime, a top-level auto-discovered
entrypoint, and a VS Code setup path that copies it into the global plugin directory.
Kimi has Beta lifecycle hook scripts,
an idempotent marker-bounded installer, direct file-tool evidence, shell snapshot
cleanup, and Stop/StopFailure session cleanup. Fixture and privacy tests pass, but
no Kilo/Kimi executable was run on this machine, so neither manifest may claim
`verified` until a live run records the tool version and resulting broker/backend
row.

## Codex native hook live check (Phases 0/2, 2026-09-02)

This is a real local run, not a synthetic hook fixture. The machine used
`codex-cli 0.151.0-alpha.7.1` with the managed global hook in
`~/.codex/config.toml`, where the hook resolved through the stable managed bundle
`~/.wakaclock/agent-plugins/0.1.0`, plus the current debug `wakaclock` binary and a
fresh isolated temporary project. The broker was running at
`http://127.0.0.1:54838` with zero
pending and zero dead-letter items after delivery.

The Codex PostToolUse payload exposed the apply-patch DSL as
`tool_input.command` (the older `input`/`patch` shapes remain accepted for
backward compatibility). The hook emitted one metadata-only event for the created
file, and the broker wrote the expected sidecar record with `agent=codex`,
`source=agent_hook`, `transport=native_plugin`, `confidence=verified`, the real
session/model identifiers, a bounded line count, and no patch or prompt fields.
`doctor ai --json` then reported the processed event and its latest native-hook
timestamp. The global managed matcher was changed to the anchored regex
`^apply_patch$`; this was required by the current Codex matcher semantics and is
covered by the VS Code installer regression test.

The native hook also preserves the real `tool_use_id` as `tool_event_id` across all
files in one multi-file patch; each file retains its own deterministic event ID.
The change is covered by the shell regression test and a fresh real Codex run at
2026-09-01T19:18:51Z through the refreshed stable bundle (exit status 0, exactly one
matching sidecar event for the target file).

A follow-up real single-call three-file probe produced three `apply_patch` broker
rows with one shared native `tool_event_id` and three distinct file events; all three
target files existed. This closes the previous multi-file tool-identity gap at the
local-broker layer while leaving the backend/cross-transport reconciliation gate
explicitly separate.

The same probe rows were then located in the local ClickHouse backend using only
metadata columns: all three are `actor_type=ai_verified`, `ai_source=agent_hook`,
`user_agent=wakaclock-cli/ai-sync`, share one `ai_change_id`, and carry one added line.
The installed Claude smoke row also persisted as `ai_verified`. The backend query was
scoped to the temporary target names and did not select source, prompt or payload
content.

Finally, a fresh real Codex edit was replayed from its exact transcript via
`wakaclock ai sync --agent codex --transcript ... --from-start`. The target backend
row count remained one before and after replay (one event ID, one change ID,
`actor_type=ai_verified`, `ai_source=agent_hook`), demonstrating live native-hook +
transcript dedup rather than a fixture-only claim. No broker retry/dead-letter row
was left behind.

This promotes the single-file and multi-file Codex native-hook paths, their backend
metadata rows, and native-hook plus transcript replay dedup for the exercised edit.
The remaining Codex acceptance item is a deliberate collision run with the legacy
shell transport; the server fingerprint and explicit-ID rules are already covered
by tests. Claude re-authentication, Kilo/Kimi live runs, and other tool adapters
remain external verification work.

After the portability/privacy hardening, a second real single-file run at
2026-09-01T18:57:45Z (session
`01a05e55-85d6-74a3-9fd9-bf7766e7957e`) through the refreshed stable bundle produced
one additional accepted sidecar event (`lines_added=1`, `lines_deleted=0`) and left
the broker inbox/dead-letter queues empty. This confirms the hardening did not break
the already verified Codex delivery path; it does not replace the separate
legacy-shell cross-transport collision certification.

A subsequent bundle refresh and probe at 2026-09-01T18:58:54Z produced one more
single-file event with the same metadata-only shape (`source=agent_hook`,
`transport=native_plugin`), confirming the installed copy—not only the worktree—was
the script exercised.

## Claude migration refresh attempt (2026-09-02)

An isolated `claude 2.1.246` run was attempted with the migrated plugin loaded and
one requested `Write` call. The CLI stopped before making an API/tool call because
the local OAuth session had expired and could not be refreshed (`api_error`). This
is recorded as an external authentication blocker; the existing 2026-08-14 live
Claude evidence remains valid for the pre-migration baseline, while the post-
migration live promotion is still pending a re-authenticated run.

The user-scoped marketplace install was then upgraded from plugin version 1.0.1 to
1.0.2. A metadata-only smoke payload through the installed cache path reached the
running local broker and appended exactly one sidecar event; the synthetic content
was absent from the sidecar. This confirms package/install wiring only and does not
replace the blocked real Claude API/tool run.

## Input Activity ClickHouse regression check (2026-09-02)

The isolated backend integration suite was run single-threaded against the local
ClickHouse 24.10 and PostgreSQL test containers (explicit `*_TEST_URL` values; no
production database). All seven ignored backend tests passed, including
`range_deserializes_nullable_aggregates_as_non_nullable_values`. That test initially
exposed a ClickHouse 24.10 alias collision in the project/daily filters: the selected
aggregate alias `copy_actions` could be resolved from inside `WHERE`, producing
`ILLEGAL_AGGREGATION`. The service now qualifies raw heartbeat columns with the `hb`
table alias, and the test verifies nullable metrics, `NULL`/empty projects,
actor filtering, totals, daily rows and clipboard coverage without a UTF-8 decode
failure.

## Broker runtime hardening (2026-09-02)

The broker worker now invokes the bounded transcript scanner automatically before
each inbox poll. A process-level integration test starts an isolated broker with a
real Codex transcript, never calls `ai sync`, and verifies that cursor state,
metadata-only sidecar events, delivery and fail-open retry behavior complete on
their own. The same test suite passes after broker restart.

The per-user singleton now holds an `fs2` exclusive lock for the full broker
lifetime and keeps the lock path in place after release; this prevents an old
launchd process from deleting a newly-created lock during restart. macOS service
manifests also pass the user's `HOME` explicitly because LaunchAgents do not
inherit it consistently. On this inspection host, launchd test children remained
inside the macOS dynamic loader before reaching broker userland, so the managed
LaunchAgent health check is retained as an environment-specific follow-up rather
than promoted to a successful service certification. The broker implementation,
lock unit test, auto-scan process test and all workspace/backend acceptance gates
pass locally.

The producer privacy audit also covers transcript-derived IDs. Codex's legacy
`call:path` IDs and Gemini's `id:path` IDs are now replaced with deterministic
UUIDv5 values that retain per-file/retry identity without putting a raw path in the
wire value. The shared shell emitter and Rust broker apply the same protection to
older adapters that provide a path-bearing event ID. `filesystem_observer` maps to
the existing weak filesystem bucket, while `process_observer` remains weakest
(`Other`) because a running process alone cannot prove a file edit.

## Universal adapter completion record (Phases 6–9, 2026-09-03)

Phase 6 keeps provider identity separate from the coding client. The core provider
map accepts explicit DeepSeek aliases and the first-party API host, while an
arbitrary compatible gateway or a model display name remains unknown. Codex,
Claude Code and Kilo therefore retain their own `client_id` when routed to
DeepSeek. The registry contains a `deep-code` manifest only to report the
unsupported standalone case; it is not promoted to a working client.

Phase 7 uses the shared versioned `caf1` canonical fingerprint in local/server
heartbeat ingestion. Transport, provider, model and retry identifiers are not
fingerprint inputs, so native hook and transcript observations converge without
transport-specific hashing. A read-side lookup of the previous `v1` fingerprint
keeps existing rows replay-safe during the scheme upgrade. Explicit heartbeat and
event IDs remain the first dedup layers. The live Codex native + transcript replay
run stayed at one backend row; a separate legacy shell collision run is still an
operational follow-up.

Phase 8 ships the product surface: standalone setup and uninstall preserve
user-owned agent configuration, `ai status --json` and `doctor ai` use the same
adapter registry, and the doctor snapshot can be pushed to the backend with a
bounded fail-open request. Backend validation accepts only bounded metadata and
newer snapshots cannot be replaced by delayed reports. The dashboard integration
panel separates detection, verification, capture and delivery health. The local
kill switch `WAKACLOCK_DISABLED_AI_ADAPTERS` disables selected clients without
stopping the broker or ordinary heartbeat stream; its diagnostic code is
`disabled_by_policy`.

Phase 9 artifacts are metadata-only and checked by
`scripts/verify_ai_certification.py` in CI:

| Adapter | Status | Artifact | Evidence boundary |
|---|---|---|---|
| Codex | `verified` | `certifications/ai-adapters/codex/2026-09-03.json` | real native single-/multi-file hook, backend row inspection and transcript replay dedup |
| Claude Code | `verified` | `certifications/ai-adapters/claude-code/2026-09-03.json` | retained pre-migration live baseline and installed plugin wiring; fresh OAuth run remains required |
| Kilo Code | `scaffold` | `certifications/ai-adapters/kilo-code/2026-09-03.json` | implementation and fixture tests; executable unavailable on this host |
| Kimi Code CLI | `scaffold` | `certifications/ai-adapters/kimi-code-cli/2026-09-03.json` | implementation and fixture tests; executable unavailable on this host |
| Deep Code | `unverified` | `certifications/ai-adapters/deep-code/2026-09-03.json` | no supported standalone hook/transcript contract; API/browser activity is not file evidence |

Each artifact records only client/provider/model IDs, versions, contract and
fingerprint versions, scenario IDs, bounded counters, timestamps, timezone, SHA,
status and blockers. The verifier rejects paths, users, prompts, source, patches,
commands, tokens, unknown fields, invalid counters, expired reports and false
live claims. Rollout and rollback instructions, including the per-adapter kill
switch, are in `docs/ai-adapter-rollout.md`.

The remaining acceptance work is external rather than a fixture gap: re-authenticate
Claude and run the live Kilo/Kimi matrices with broker/backend row inspection,
exercise the legacy shell collision for Codex, and promote only artifacts backed by
those runs. No scaffold or unverified adapter is represented as live-certified.
