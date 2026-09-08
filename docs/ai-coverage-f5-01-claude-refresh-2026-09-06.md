# F5-01 Claude Code refresh — 2026-09-06

F5-01 has a current local transcript-shape refresh. This record is local
implementation evidence; it is not a new live certificate or a catalog
promotion.

## Observed local shape

- Executable present: Claude Code `2.1.246`.
- A current project transcript was replayed from the local Claude projects
  directory with a temporary HOME and `--dry-run`. No model call was started and
  no event was sent to the configured API.
- The transcript contained 665 valid JSON records: 228 `assistant` records and
  127 `user` records. Edit tool uses included 25 `Edit` and 8 `Write` calls;
  `Bash` and browser/MCP calls were observed separately and are not treated as
  file edits without an explicit file-edit result.
- `toolUseResult` appeared as an object for 108 records, a list for 7, and a
  string for 5. The parser now treats the latter two as valid non-edit shapes
  instead of malformed transcript records.
- The replay emitted 33 bounded file-edit events with zero malformed-record
  warnings after the refresh.

## Parser changes

- Structured content blocks and ordinary text/progress values are decoded as
  separate shapes. Unsupported values are ignored without retaining their
  contents or emitting a false parser warning.
- Structured `toolUseResult` objects remain the only transcript evidence that
  emits an edit. Lists and strings cannot become file events.
- When the `user` tool result omits `cwd`, the parser reuses the workspace root
  recorded on the matching `assistant` tool call. This keeps relative file paths
  inside the correct workspace without guessing from a process name.
- Existing failure/no-op behavior remains: errored results and empty results
  emit no edit event.

## Local gates

- Claude parser tests: 7 passed.
- `cargo clippy -p wakaclock-core --all-targets -- -D warnings`: passed.
- Current transcript dry-run: 33 events, 0 malformed-record warnings.
- Local direct broker replay accepted all 33 events with zero duplicates. The
  command's final exit was non-zero only because the temporary loopback endpoint
  had no `/api/v1/ai/usage` server; no external API was contacted.

## Remaining live gate

F5-01 still needs a fresh authenticated native-hook plus transcript replay run
through the shipped bundle, broker, API and dashboard. The local refresh does not
promote the historical Claude certificate or claim shell/MCP file attribution;
those paths require explicit file evidence and a real certification campaign.
