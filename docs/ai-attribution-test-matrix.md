# AI attribution integration matrix

This matrix is the executable verification index for `code-calm-crown.md` C-4. Each
scenario has one owning test location; the test name is intentionally specific so a
failure points to the producer or boundary that regressed.

| Scenario | Expected | Owner / test |
|---|---|---|
| Human typing VS Code | HUMAN | `extensions/vscode/test/buffer.test.ts` — `still counts an ordinary edit when reason is undefined` |
| Human save file | HUMAN | `extensions/vscode/test/buffer.test.ts` — `save flushes immediately with write=true` |
| Claude Edit | AI_VERIFIED | `backend/api/crates/wakaclock-core` — `parse_since_extracts_edit_with_model_from_preceding_assistant_record`; broker `normalizes_paths_agent_and_verified_actor` |
| Claude Write | AI_VERIFIED | `extensions/vscode/test/buffer.test.ts` — `attributes a whole-file agent overwrite as AI on the save that follows it` |
| Claude Bash + sed | AI | `scripts/ai-attribution-integration.py` — `Claude Bash + sed`: real `ai tool-before`/`ai tool-after` CLI round trip around a real `sed -i` on a real git-tracked file |
| Claude Python codemod | AI | `scripts/ai-attribution-integration.py` — `Claude Python codemod`: same round trip around a real multi-line Python rewrite; the 50-file broker bound is tested separately |
| Codex apply_patch | AI_VERIFIED | `backend/api/crates/wakaclock-core` — `parse_since_splits_multi_file_patch_into_one_event_per_file`; broker `normalizes_paths_agent_and_verified_actor` |
| Codex shell | AI | `scripts/ai-attribution-integration.py` — `Codex shell`: same tool-before/tool-after engine, `agent=codex` |
| Gemini replace | AI | `backend/api/crates/wakaclock-core/src/ai/gemini.rs` — `parses_verified_write_record_without_retaining_content` |
| Gemini shell | AI | `scripts/ai-attribution-integration.py` — `Gemini shell`: same tool-before/tool-after engine, `agent=gemini-cli` |
| ChatGPT → tan.apply_patch | AI_VERIFIED | CLI generic ingress tests — `generic_ingress_defaults_to_verified_mcp_and_normalizes_agent` |
| MCP move file | AI_VERIFIED | `backend/api/crates/wakaclock-cli/src/tool_snapshot.rs` — `infers_a_one_to_one_pure_rename_from_the_content_hash`; broker `rename_requires_previous_entity` |
| MCP delete/create | AI_VERIFIED | `backend/api/crates/wakaclock-cli/src/tool_snapshot.rs` — `detects_create_and_delete_with_exact_whole_file_line_counts`; broker `rename_previous_entity_must_stay_inside_project_root` |
| prettier save | not false AI | `extensions/vscode/test/buffer.test.ts` — `does not attribute prettier or eslint whole-file reformat to AI without sidecar evidence` (covers both formatter paths) |
| eslint --fix | not false AI | `extensions/vscode/test/buffer.test.ts` — `does not attribute prettier or eslint whole-file reformat to AI without sidecar evidence` (same regression test, explicit eslint fixture) |
| git checkout | not false AI; current known gap on `--write` | `scripts/ai-attribution-integration.py` — `git checkout`: a real `git checkout` reverting a real tracked file, asserted two ways — see note below |
| git merge | not false AI; current known gap on `--write` | `scripts/ai-attribution-integration.py` — `git merge`: a real feature-branch merge, same two-part assertion |
| AI edit 50 files | all captured | `backend/api/crates/wakaclock-core/src/broker.rs` — `an_ai_edit_touching_fifty_files_is_captured_once_per_file` (50 unique event IDs and acknowledgements) |
| VS Code + AI hook duplicate | one canonical activity | backend inline `backend/api/src/services/heartbeat.rs` — `hook_and_transcript_payloads_share_one_cross_transport_fingerprint`; state `backend/api/crates/wakaclock-core/src/ai/state.rs` — `hook_fingerprint_deduplicates_a_transcript_event_with_a_different_id`; broker `duplicate_and_conflicting_ids_are_distinguished` |
| Backend offline | event queued | `extensions/vscode/test/buffer.test.ts` — `retries a failed snapshot with the same ID without absorbing newer activity` |
| Restart broker | event retained | `backend/api/crates/wakaclock-cli/tests/broker_process.rs` — `broker_restart_reclaims_processing_lease_without_duplicate_inbox_row` |
| API rejection | diagnostics preserved | `backend/api/crates/wakaclock-cli/src/broker.rs` — `invalid_batch_is_atomic_and_duplicate_batch_is_ok`, `http_event_statuses_are_accepted_duplicate_and_conflict`, `concurrent_duplicate_is_one_event_and_limits_are_enforced` |
| Cursor edit (scaffold) | AI_VERIFIED — **wiring only, payload shape unverified** | `scripts/ai-attribution-integration.py` — `Cursor shell (scaffold, ...)`, `Cursor afterFileEdit (scaffold, ...)`: real `extensions/ai-agents/cursor/scripts/*.sh` against synthetic stdin shaped from Cursor's public docs, not a real Cursor payload — see `extensions/ai-agents/cursor/README.md` before treating this row as equivalent to the others above |

`scripts/ai-attribution-integration.py` builds the real `wakaclock` CLI binary and
drives it as a real subprocess against real temporary git repositories — real `sed`,
a real Python rewrite, a real `git checkout`/`git merge` — capturing what actually
reaches a fake backend HTTP server. It runs in the `backend` CI job right after
`cargo test --workspace` (which already produces the debug binary it needs). This
replaced six rows that were previously "Manual CI external-process check" placeholders
with no automated owner; running it against the real binary for the first time also
found and fixed a real bug (`change_kind: modified` vs `modify` — see
`broker_event_from_generic_accepts_the_change_kind_the_shell_hook_engine_sends` in
`wakaclock-cli/src/main.rs`) that made every shell-mutation-driven AI heartbeat for an
*existing* file fail silently before this matrix existed.

**git checkout / git merge, in detail.** These two rows check two different claims,
not one:

1. A bare heartbeat with no `--write` and no AI evidence at all (what a future Phase 3
   Universal Workspace Observer would send) resolves to `unknown` — never to an AI
   actor. This holds today.
2. A `--write` heartbeat — what an editor sends on an ordinary save, the only path that
   exists right now — resolves to `human`, even for a file a `git checkout` or
   `git merge` just changed. This is `docs/duration-accuracy-audit.md`'s Finding-2-
   adjacent gap: nothing yet distinguishes "the editor's own save" from "an external
   process changed this open file", because the filesystem/process observer that would
   make that distinction (planai.md Phase 3/4) has not been built. The script asserts
   this second case as today's *known* behavior, not as the desired end state — if it
   ever starts failing, that means Phase 3 landed and this whole scenario needs
   rewriting to assert `unknown`/`system` instead, together with this file.

The source table in `planai.md` currently contains 22 scenario rows (the plan summary
calls them 21); all 22 are listed here so no owner is silently dropped.
