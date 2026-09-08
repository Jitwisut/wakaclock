# F5-02 Codex CLI runtime hardening — 2026-09-06

F5-02 now has the local parser and broker fixes needed before a current Codex
CLI certification run. This closeout deliberately separates implementation
evidence from the live exact-tuple gate.

## What changed

- `session_meta` accepts `id`, `session_id`, or both. When both are present the
  canonical `id` wins, so current Codex Desktop records no longer lose their
  session and workspace context because of a serde duplicate-field error.
- JSONL reads expose each complete line's starting offset. When an
  `apply_patch` call is read before its completion record, the returned cursor
  rewinds to that call. A later scan can pair the output without dropping the
  edit; replayed earlier events remain safe through the existing delivered-event
  identity store.
- Explicit failed/cancelled tool statuses are ignored. A successful
  `patch_apply_end` is authoritative when a transcript also contains a
  `custom_tool_call_output`, preventing one edit from becoming two events.
  Desktop/modern output-only calls still require a matching completion record.
- Codex `apply_patch` markers now preserve create, modify, delete and rename
  semantics, including the old path for a move. The broker envelope carries the
  same `change_kind` and `previous_entity` values.
- Provider identity is read from `session_meta.model_provider` with the existing
  OpenAI fallback for older records. Raw prompt, patch and source content remain
  outside the event contract.
- The built-in Codex manifest is now `scaffold` until the current executable's
  exact tuple is re-certified. The previous `0.151.0-alpha.7.1` native-hook run
  remains historical evidence; this machine currently resolves `codex-cli
  0.153.4`.
- Diagnostics no longer invent a Codex `cli`/`native_single_file` certification
  tuple from any discovered transcript. Until CLI versus Desktop origin is
  captured, the tuple reports the observed tool version and an `unclassified`
  edit mode so the server cannot borrow a different runtime's certificate.

## Detection regression found and fixed

The recent Codex detection failure was caused by two independent runtime paths:

- The macOS LaunchAgent was still executing `target/release/wakaclock`, while
  the parser and per-event validation fixes had only been built in `target/debug`.
  The old release process aborted the entire automatic sync when one historical
  transcript record referred to a file outside the active `project_root`.
- A Codex Desktop full replacement can encode one file as `Delete File` followed
  by `Add File` in the same tool call. Both changes previously used the same
  event ID even though their payloads differed, so the broker rejected the whole
  batch as a conflicting duplicate.

Automatic sync now skips only the invalid path event, acknowledges only events
that actually entered the broker batch, and assigns deterministic occurrence
suffixes to repeated paths in one call. A 520-event replay of the current local
transcript accepted 507 events with zero broker conflicts; 13 historical
out-of-root records were skipped individually. The replay used a temporary HOME
and loopback endpoint, so it did not send transcript data to the configured API.

## Local evidence

- 17 Codex parser tests pass, including both session-id fields, a completion that
  arrives after the cursor pass, failed calls, duplicate completion records,
  Desktop `exec` wrappers, multi-file patches, and create/delete/rename markers.
- Patch parser tests pass with per-file operation kinds and rename paths.
- CLI broker tests pass, including duplicate-batch atomicity and rename identity
  validation (10 tests).
- `cargo check --workspace --all-targets` passes.
- `cargo fmt --all` and the local direct-mode replay pass after the regression
  fix.

## Live gate still open

The final campaign used authenticated `codex-cli 0.153.4` with the shipped
release binary and a disposable API identity. It captured 8 events across
single-file, multi-file, create/delete/rename and failure/no-op scenarios. The
delivered retry scenario replayed one event with zero new events. The same run
passed event-bound API delivery, canonical reconciliation and dashboard
readback: 8 unique API rows, 8 canonical winners, 8 unique fingerprints, and
the dashboard AI delta matched canonical line counts.

The sanitized pending artifact records all six mandatory stages as `passed`,
with `review_status=pending` and `promotable=false`. The nested execution row
is still `not_run` because Codex does not expose a stable privacy-safe
parent/child execution identity. A separate process invocation re-opened the
local broker store for retry/dedup; a service-level restart remains a release
rehearsal item when the managed broker is available. Codex Desktop/IDE evidence
remains an independent F5-04 tuple and must not reuse the CLI result.

The complete F5-01…F5-18 status matrix is in the [F5 closeout report](ai-coverage-f5-closeout-2026-09-07.md).
