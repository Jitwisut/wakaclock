# Agent transcript capability matrix

Verified 2026-08-14 against real local transcript files on a development machine
(`~/.claude/projects/*/*.jsonl`, `~/.codex/sessions/**/*.jsonl`). Fixture files under
`fixtures/` are synthetic — they reproduce the exact structural shape observed, with
placeholder file paths and content, never real project/prompt/patch data.

**Correction (2026-08-14, later same day):** the first pass got Claude Code's `Write`
result wrong. It assumed `structuredPatch` would contain one hunk representing the
whole new file. Running the real parser against a real live session showed otherwise:
for a brand-new file, `structuredPatch` is an **empty array** — the full content lives
only in `toolUseResult.content`, with no diff representation at all. `claude.rs` and
the `write_tool_result.json` fixture were updated to match; `patch.rs` gained
`count_content_lines()` for this content-only case. Filed as evidence that a fixture
built from *reading* a transcript format is not a substitute for running the parser
against one and checking the output.

Gemini CLI was **not** installed on the inspection machine, so its row is marked
`unknown` rather than guessed. Do not implement `gemini.rs` from assumption; repeat
this inventory pass on a machine with a real Gemini CLI transcript first.

| Capability | Claude Code | Codex CLI | Gemini CLI |
|---|---|---|---|
| Transcript format | JSONL, `~/.claude/projects/<cwd-slug>/<session-uuid>.jsonl` | JSONL, `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | unknown |
| File-edit tool call identity | `tool_use.id` (`toolu_...`), stable per call | `event_msg.payload.call_id` (`exec-<uuid>`) on `patch_apply_end` | unknown |
| File-edit tool result | `type:"user"` record's top-level `toolUseResult`, keyed by matching `tool_use_id` in `message.content[0]` | Same record as the call: `event_msg` with `payload.type == "patch_apply_end"` | unknown |
| Exact diff available | Yes — `toolUseResult.structuredPatch`: array of hunks `{oldStart, oldLines, newStart, newLines, lines[]}`, each line prefixed ` `/`+`/`-` | Yes — `payload.changes[<abs path>].unified_diff`, a standard unified-diff text blob (`@@ ... @@` + prefixed lines) | unknown |
| Multi-file patch shape | One `tool_use` per file (Edit/Write are single-file; MultiEdit's `input.edits[]` are multiple hunks within one file, one `tool_use` call) | One `patch_apply_end` event, `payload.changes` is a map of **all** files touched by that one `apply_patch` call — must be split into one `AiEditEvent` per key | unknown |
| Change kind (add/update/delete/rename) | Not explicit on Edit; `Write` implies whole-file create/overwrite (no reliable "existed before" signal without checking `originalFile`) | Explicit: `payload.changes[path].type` is `"add"` \| `"update"` \| `"delete"` (rename not yet confirmed observed) | unknown |
| Working directory / project root | Envelope `cwd` field on every record (top-level, present on both `assistant` and `user` records) | `session_meta.payload.cwd` (session-level) and `turn_context.payload.cwd` / `.workspace_roots[]` (per-turn, can differ from session cwd) | unknown |
| Session identity | `sessionId` (top-level, UUID, stable for the file) | `session_meta.payload.session_id` (UUID) | unknown |
| Timestamp precision | ISO-8601 with milliseconds, per-record (`timestamp` top-level field) | ISO-8601 with milliseconds, per-record (`timestamp` top-level field) | unknown |
| Model identity | `message.model` on the `assistant` record that issued the tool call (e.g. `"claude-sonnet-5"`) | `turn_context.payload.model` (per-turn; a session can change model mid-session) | unknown |
| Token usage | `message.usage` on each `assistant` record: `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` — **per assistant turn, not per tool call/file** | `event_msg` with `payload.type == "token_count"`: `info.total_token_usage` (cumulative) and `info.last_token_usage` (per-turn) — also **not per file** | unknown |
| Branch | `gitBranch` (top-level, present when the session ran inside a git repo) | Not observed as a direct field; would need derivation from `cwd` | unknown |
| Schema/version marker | No explicit schema version field observed; `version` (top-level) tracks the Claude Code app build, not a transcript schema | No explicit schema version field observed | unknown |

## Consequences for `event.rs` / `event_id` design (8.3 rule 1)

Neither agent exposes a single ID that is simultaneously (a) stable across process
restarts/log rotation and (b) scoped to one file within a multi-file patch:

- Claude Code's `tool_use.id` is already file-scoped (one call = one file, except
  `MultiEdit` which is one call for several *hunks in the same file* — still
  file-scoped) and is almost certainly usable as `event_id` directly, or as the input
  to a stable hash if it ever collides across sessions.
- Codex's `call_id` is scoped to the whole `apply_patch` call, which can span several
  files (`payload.changes` is a map). `event_id` must therefore be derived as a
  versioned hash of `(call_id, file_path)`, not `call_id` alone — otherwise splitting
  one call into N per-file events (required by 8.3 rule 6) would produce N events
  sharing one ID.

## Consequences for token/cost allocation (Phase 9 §9.4)

Both agents report token usage per *turn*, not per *file edit*. A turn can touch zero,
one, or several files. This confirms Phase 9's decision to keep per-file token
allocation as an explicit, documented estimate (or an `unattributed_project` bucket)
rather than something recoverable exactly from either transcript format.
