# Active timing v1

Active v1 is the strict coding-time metric. It runs beside the existing
WakaTime-compatible timeline so a rollout can compare both numbers on the same
heartbeats.

## Evidence rules

- VS Code emits `editor_active_v1` segments. Each segment is closed by the next
  editor activity and is capped at a 15-second lease. The 120-second heartbeat
  setting controls delivery cadence only.
- The editor lease is evidence of human presence, separate from line authorship:
  a mixed or missing before/after baseline may keep `actor_type=unknown` while
  the lease still counts as human Active time. An AI actor can never retain the
  editor marker.
- A gap of 16 seconds or more contributes no human Active time. A focus change,
  sleep/resume, or backwards clock jump resets the cursor.
- AI tool hooks emit `ai_tool_v1` with one stable tool operation and its observed
  start/end interval. The interval is bounded to six hours, counted once even if
  the operation changes multiple files, and remains separate from line-change
  attribution.
- Active total is `union(human, ai)`. The API also exposes human-only, AI-only,
  and human+AI overlap seconds; an overlapping second is counted once in total.
- The status endpoint exposes raw `active_intervals` separately from bridged
  compatibility intervals. The CLI unions those with locally queued Active segments,
  so an offline flush or a crash after server acceptance cannot add legacy time or
  count the same segment twice.
- Rows without a v1 marker are not backfilled. Their Active coverage is
  `partial`/`unavailable`, while the compatibility timeline remains available.
- A legacy heartbeat that sends only one large `active_seconds` claim contributes
  one trailing evidence window capped at 120 seconds. It cannot manufacture a
  long session by being split into adjacent windows; bridge time still needs a
  neighbouring heartbeat.

## Rollout

`DURATION_PRIMARY_MODE=wakatime_compatible` is the default. Set
`DURATION_PRIMARY_MODE=active_v1` only after the shadow comparison and live
campaign pass. Every response keeps `wakatime_compatible_seconds` and the
`active_*` fields so rollback does not require a data migration.

## Regression proof

The VS Code buffer tests cover one, fourteen, fifteen, and longer gaps through
the lease boundary, including the key case of seven minutes of activity followed
by one minute idle. The server timeline tests cover union and overlap. The AI
heartbeat service test verifies a ten-minute completed tool interval is retained
instead of being truncated to the legacy 120-second window.
