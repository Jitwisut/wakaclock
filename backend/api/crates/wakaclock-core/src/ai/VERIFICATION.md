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

## Still not verified against a live system

- Codex live delivery and cross-transport dedup: the "Phase 8 Codex verification"
  section above ran `--dry-run` only, against real transcripts but with no server
  contacted — an earlier same-day check against one smaller real rollout (before the
  `response_item` gap above was found) got the same result: dry-run parsing checked
  out, but delivery/dedup against a running server with a real credential is still
  open.
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
  covered by server unit tests.
