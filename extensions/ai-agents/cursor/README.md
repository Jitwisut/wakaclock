# Cursor adapter — SCAFFOLD, NOT YET VERIFIED

**Do not treat this as a working integration until it has been run against a real
Cursor installation and its hook payloads have been inspected.** Every field name and
event name below comes from Cursor's public documentation and third-party write-ups
found on 2026-08-31, not from a real `stdin.json` this codebase has actually printed
and read. `CAPABILITIES.md`'s own rule — "Do not implement `gemini.rs` from
assumption; repeat this inventory pass on a machine with a real transcript first" —
applies here just as much. The Claude Code and Codex adapters both had real,
confirmed bugs (wrong field names, wrong record shapes) that only surfaced once someone
ran the real thing; assume this one does too until proven otherwise.

## What this is based on

Cursor (2026) has its own hook system, unrelated to any other agent this repo
integrates with:

- Config: a project's `.cursor/hooks.json`, `{"version": 1, "hooks": {...}}`, with
  command paths resolved relative to `.cursor/`.
- Events referenced here: `beforeShellExecution`, `afterShellExecution`,
  `afterFileEdit`. Cursor also documents `sessionStart`/`sessionEnd`,
  `beforeMCPExecution`/`afterMCPExecution`, `beforeSubmitPrompt`, `preCompact`, `stop`,
  `beforeReadFile`/`beforeTabFileRead`/`afterTabFileEdit` — not used here yet.
- `afterFileEdit`'s stdin payload reportedly includes `file_path`, `edits` (an array of
  `{old_string, new_string}` pairs), `conversation_id`, `generation_id`,
  `hook_event_name`, `workspace_roots`. This is the one field shape most different from
  every other adapter in this repo: it hands the edit's own before/after text directly,
  rather than requiring a filesystem snapshot diff the way Codex/Claude's shell path
  does. `heartbeat-hook.sh` below only ever counts lines from `old_string`/`new_string`
  in memory — it must never write that text to disk or include it in the emitted event,
  matching this repo's `deny_unknown_fields`/metadata-only contract everywhere else.
- `beforeShellExecution`/`afterShellExecution` are assumed to pair the same way
  Claude/Codex/Gemini's shell hooks do, so `git-sweep-before.sh`/`git-sweep-after.sh`
  are reused verbatim (only the `agent`/`provider` arguments differ) through
  `wakaclock ai tool-before`/`tool-after` — the same metadata-only snapshot-diff
  engine already proven against three other agents.
- Provider is set to `anysphere` (Cursor's maker) to match this repo's convention of
  using the company name, not the product name, as `provider` (`claude-code` →
  `anthropic`, `codex` → `openai`, `gemini-cli` → `google`). Unverified whether
  Cursor's own hook payload calls itself anything different.

Sources (accessed 2026-08-31, not verified against a live install):
- https://cursor.com/docs/hooks (canonical reference, not fetched directly here)
- https://www.truefoundry.com/docs/platform/cursor-hooks
- https://ntorres.dev/blog/cursor-hooks-json-guide
- https://blog.gitbutler.com/cursor-hooks-deep-dive

## Install (once verified)

Copy `hooks.json` into the target repo's `.cursor/hooks.json` (merge with any existing
hooks that repo already has — do not overwrite), and copy `scripts/` next to it as
`.cursor/scripts/`. Requires `jq` and a `wakaclock` binary on `PATH` (or
`WAKACLOCK_CLI_PATH` set), same as every other adapter in this directory.

## Before this can be marked verified

1. Run Cursor with these hooks installed against a real repo, make it edit a file, and
   capture the real `stdin.json` for `afterFileEdit` — confirm `file_path`/`edits[]`
   field names and whether `edits[]` can span multiple files in one call (assumed
   single-file here, unlike Codex's `apply_patch`) or only one.
2. Confirm `beforeShellExecution`/`afterShellExecution` actually pair by some call/step
   identifier the way Claude/Codex/Gemini's do — this scaffold assumes so but has not
   checked.
3. Confirm hook command paths resolve as documented (relative to `.cursor/`) and that
   a user-level (not just project-level) `hooks.json` is possible, if broad rollout
   needs it.
4. Record the outcome in `backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md`
   and `CAPABILITIES.md`, following the same pattern as the Claude Code and Codex
   entries — including any bug found and fixed, not just a "works" checkbox.
