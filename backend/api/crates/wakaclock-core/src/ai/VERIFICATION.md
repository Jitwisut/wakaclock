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

## Still not verified against a live system

- Codex CLI's `patch_apply_end` path was exercised only against fixtures, not a live
  Codex session run during this same verification pass.
- Gemini CLI: still entirely unverified (no local installation).
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
