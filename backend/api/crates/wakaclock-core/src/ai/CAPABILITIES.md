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

**Correction (2026-08-31):** the Codex column below describes `event_msg`/
`patch_apply_end`, which turned out to be a format observed in older sessions only.
Checked against 156 real local Codex session files: the current, dominant real shape
is a `response_item` pair instead — `custom_tool_call` (`payload.name ==
"apply_patch"`, patch text in `payload.input`) followed by `custom_tool_call_output`
(`payload.call_id` matching, proof the call completed). `codex.rs` now handles both;
see `VERIFICATION.md`'s "Phase 8 Codex verification (2026-08-31)" for the fix and the
before/after event counts. The rows below are corrected for the current shape, with
the older shape noted where it still differs.

**Correction (2026-09-05):** Codex Desktop can wrap the same native call in a
`custom_tool_call` whose `payload.name` is `"exec"`; its `payload.input` contains
`text(await tools.apply_patch("..."))`, or assigns the patch to a variable before
calling `tools.apply_patch(variable)`. The parser unwraps both forms and still waits
for the matching `custom_tool_call_output` before emitting file evidence. This is the
shape emitted by the current Codex Desktop session in the workspace used for this
verification.

| Capability | Claude Code | Codex CLI | Gemini CLI |
|---|---|---|---|
| Transcript format | JSONL, `~/.claude/projects/<cwd-slug>/<session-uuid>.jsonl` | JSONL, `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | unknown |
| File-edit tool call identity | `tool_use.id` (`toolu_...`), stable per call | `response_item.payload.call_id` (`call_<id>`) on `custom_tool_call`/`custom_tool_call_output`; Desktop may set `payload.name` to `"exec"` and wrap `tools.apply_patch(...)` in `payload.input` (older sessions: `event_msg.payload.call_id`, `exec-<uuid>`, on `patch_apply_end`) | unknown |
| File-edit tool result | `type:"user"` record's top-level `toolUseResult`, keyed by matching `tool_use_id` in `message.content[0]` | Two records: `response_item`/`custom_tool_call` (the patch text) plus a separate `response_item`/`custom_tool_call_output` (completion proof, matched by `call_id` — its own content is not parsed) (older sessions: one `event_msg` with `payload.type == "patch_apply_end"`) | unknown |
| Exact diff available | Yes — `toolUseResult.structuredPatch`: array of hunks `{oldStart, oldLines, newStart, newLines, lines[]}`, each line prefixed ` `/`+`/`-` | Yes — the direct `custom_tool_call` input, or the string unwrapped from Desktop's `exec` bridge, is the OpenAI apply_patch DSL (`*** Update/Add/Delete File:`/`*** Move to:` markers, `+`/`-` body lines) — not a standard unified diff; parsed by `patch::parse_apply_patch()` (older sessions: `payload.changes[<abs path>].unified_diff`, standard unified diff) | unknown |
| Multi-file patch shape | One `tool_use` per file (Edit/Write are single-file; MultiEdit's `input.edits[]` are multiple hunks within one file, one `tool_use` call) | One `input` blob can contain several `*** Update/Add/Delete File:` sections — `parse_apply_patch()` splits it into one `AiEditEvent` per file (older sessions: one `patch_apply_end`, `payload.changes` is a map of all files touched) | unknown |
| Change kind (add/update/delete/rename) | Not explicit on Edit; `Write` implies whole-file create/overwrite (no reliable "existed before" signal without checking `originalFile`) | Explicit marker per file section (`*** Update/Add/Delete File:`, `*** Move to:` for rename) (older sessions: `payload.changes[path].type` is `"add"` \| `"update"` \| `"delete"`) | unknown |
| Working directory / project root | Envelope `cwd` field on every record (top-level, present on both `assistant` and `user` records) | `session_meta.payload.cwd` (session-level) and `turn_context.payload.cwd` / `.workspace_roots[]` (per-turn). `custom_tool_call`/`custom_tool_call_output` carry no `turn_id`, so the parser correlates to whichever `turn_context` most recently preceded them in stream order | unknown |
| Session identity | `sessionId` (top-level, UUID, stable for the file) | `session_meta.payload.id` (UUID) — **not** `session_id`; real payloads do not have a `session_id` key. `#[serde(alias = "id")]` accepts both | unknown |
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

## GitHub Copilot (`copilot.rs`, added 2026-10-26)

| | VS Code chat/agent | Copilot CLI |
| --- | --- | --- |
| Source | `<editor>/User/workspaceStorage/<hash>/GitHub.copilot-chat/transcripts/*.jsonl` | `~/.copilot/session-state/<id>/events.jsonl` |
| Envelope | JSONL `{type, id, parentId, timestamp, data}` | same event family |
| Verified locally | `session.start`, `user.message`, `assistant.message` (`toolRequests`), `assistant.turn_start`/`turn_end` — one real session, keys only | no local sample |
| Assumed (synthetic fixture) | `tool.execution_complete`, `assistant.usage`, `session.model_change` and their fields | same |
| Agent ID | `copilot`, with `producer_surface` = `vscode` or `cli` | |
| Edits | a file-naming tool request plus its successful completion; lines only when telemetry reports them | |
| Sending | usage only; edits kept as local dry-run evidence until certified (catalog runtime `None`) | |

Not read yet: `chatSessions/*.jsonl` (patch log with `modelId` and request token counts) and
`chatEditingSessions/*/state.json`; inline completions are out of scope.

## Cursor IDE and Windsurf (`cursor.rs` + `vscdb_kv.rs`, added 2026-10-26)

| | |
| --- | --- |
| Source | `<editor>/User/globalStorage/state.vscdb` (`Cursor`, `Windsurf`, `Windsurf - Next`), table `cursorDiskKV` |
| Rows read | only keys `bubbleId:<composerId>:<bubbleId>` (JSON value); every other key is ignored |
| Verified locally | nothing — neither editor is installed on the development machine; schema from public facts, synthetic SQLite in tests |
| Edits | assistant bubble (`type = 2`) whose `toolFormerData` names an editing tool with `status = completed`; path from `params` (often workspace-relative, kept relative); lines only if the tool result reports them |
| Usage | assistant bubble `tokenCount` once the bubble is at least two minutes old; model from the bubble; provider unset (the editor routes to several model vendors); prompt counts not yet derived |
| Re-reads | a window of recent rowids is re-read each pass because bubbles are updated in place; event and usage IDs are stable, so downstream delivery stays idempotent |
| Sending | usage only; edits kept as local dry-run evidence until certified (catalog runtime `None`) |

Not covered: `cursor-agent` CLI (moved to the Tier 2 survey), Tab completions, resolving
workspace-relative paths to a workspace root.

## Antigravity (`antigravity.rs`, added 2026-10-26)

| | |
| --- | --- |
| Source | `~/.gemini/{antigravity,antigravity-ide,antigravity-cli}/brain/<session>/.system_generated/logs/transcript.jsonl` |
| Surface | `producer_surface` = `desktop`, `ide` or `cli` from the directory |
| Verified locally | nothing — Antigravity is not installed on the development machine; record shape assumed to match Gemini CLI |
| Edits | same successful-tool-result rule as Gemini CLI (`gemini::edit_from_record`, shared with an identity parameter) |
| Usage | none: the SQLite stores hold protobuf payloads and are not decoded (owner decision Q4) |
| Sending | edits kept as local dry-run evidence until certified (catalog runtime `None`) |

## Cline extension family (`ui_messages.rs`, added 2026-10-26)

| | |
| --- | --- |
| Tools | Cline (`saoudrizwan.claude-dev`), Roo Code (`rooveterinaryinc.roo-cline`, `…roo-code-nightly`), Kilo Code (`kilocode.kilo-code`); profile for IBM Bob (`ibm.bob-code`) exists but is not registered — there is no catalog manifest for it yet |
| Source | `<editor>/User/globalStorage/<extension>/tasks/<task>/ui_messages.json` for Code, Code - Insiders, Cursor, Windsurf, VSCodium, plus remote `~/.{vscode,cursor,windsurf}-server/data/User/globalStorage` |
| Verified locally | nothing — none of these extensions is installed on the development machine |
| Edits | `tool` messages (`ask` or `say`) for `editedExistingFile`, `appliedDiff`, `searchAndReplace`, `insertContent`, `newFileCreated`, `writeToFile`, `fileDeleted`; lines from SEARCH/REPLACE or unified diff, or new content; paths stay workspace-relative |
| Usage | `api_req_started` `tokensIn`/`tokensOut`/`cacheReads`/`cacheWrites` once two minutes old; no model or prompt counts yet |
| Re-reads | the file is rewritten as the task runs; it is re-read when its fingerprint changes and IDs are stable per message; first discovery marks existing messages seen |
| Sending | usage only; edits kept as local dry-run evidence (whether an approval-gated edit was rejected is not yet verified) |

Cody is not parsed: its chat history (`state.vscdb` `ItemTable` key `sourcegraph.cody-ai`) has no per-edit record, so edits could only be inferred from context-file diffs, which the accuracy-first rule does not allow.
