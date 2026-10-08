# Durable heartbeat delivery and recovery

Approved implementation: 2026-10-07. Duration formulas, deduplication, activity segments,
timestamps, revision IDs and the configured 15 minute idle timeout stay unchanged.

## Delivery contract

Filtered heartbeats are persisted to SQLite before any request. A failed local write
returns an error to the producer without attempting delivery. A scoped lease protects
requests from concurrent senders, renews during the request and expires after a crash.
Only an acknowledged server response removes a queued item. An ambiguous response
retries the same stable heartbeat identity; server ingest remains idempotent.

`wakaclock delivery run` is a delivery-only worker; it does not collect transcripts,
generate activity or restore the retired capture broker. It checks every 15 seconds,
sends up to five batches of 100 and starts no further batch after ten seconds.
Snapshot publication also runs when idle. The current request may exceed ten seconds;
the limit bounds the start of the next batch, not cancellation of an in-flight request.

Backoff remains 60 → 120 → 240 → 480 → 960 → 1920 → 3600 seconds, without an age or retry
limit. Recovery probing is opt-in (`WAKACLOCK_RECOVERY_PROBE=1`). It only accelerates
known network/5xx rows after a real successful POST newer than their failure. One probe
per credential/origin scope per 60 seconds is allowed. A successful probe releases the
eligible backlog. `Retry-After`, 429, permission errors and unknown legacy reasons are
never bypassed. 401/403 and 402 retain the original heartbeat for permission repair.
Mixed invalid batches isolate only invalid items in a recoverable dead letter.

## Operations on this Mac

```sh
~/.local/bin/wakaclock delivery status
~/.local/bin/wakaclock status --json
~/.local/bin/wakaclock delivery install --recovery-probe
```

The LaunchAgent is `com.atoaxis.wakaclock.delivery`. Its executable is the atomic
runtime copy `~/.wakaclock/bin/wakaclock-delivery`. State is written to
`~/.wakaclock/delivery-state.json`; metadata history is recorded once per minute in
`~/.wakaclock/delivery-history/YYYY-MM-DD.jsonl`. Delivery runs while logged in and
awake. macOS resumes the service on login; sleeping/offline periods remain queued.
Linux installation uses a user systemd service; other platforms can supervise
`delivery run` with their service manager.

Pause acceleration while retaining automatic delivery:

```sh
~/.local/bin/wakaclock delivery install
```

This reinstalls the service with the recovery probe disabled. Do not delete `queue.db`,
dead letters or additive columns. Inspect retained validation failures, repair the
payload using the original ID/time/revision/segments, and replay through the client
only after fixing the reported error. There is no new blanket dead-letter replay
command; do not requeue an invalid payload repeatedly or manufacture an alternate ID.

Before repair or rollback, use Python's SQLite backup API against the live connection;
copying the main `.db` file alone can omit WAL records. Record counts by event day and
scope plus `PRAGMA integrity_check` on the backup. Restrict raw backup permissions.
Backups from this incident are in `output/heartbeat-recovery-2026-10-07/181534/` and
`185122/` and are excluded from Git. Never restore an old database over a newer queue:
reconcile accepted IDs first, then replay only remaining original records.

Keep the backend that accepts snapshots v1 and v2 during a client/UI rollback. The
old client executable is retained at
`output/heartbeat-recovery-2026-10-07/wakaclock-before-recovery`. If rolling back the
worker too, uninstall the delivery service first and preserve its database. A v1
client must show details unavailable; it cannot certify an empty queue. Local canary
builds retain version `0.2.0`; use executable SHA-256 and embedded git SHA to identify
the running build. They have not been published as a release.

## Status and time interpretation

Connectivity, latest successful delivery and backlog completeness are separate.
Snapshots expose ready/leased counts, next retry, oldest event time, accepted progress
and the backlog error code/status/time. No credential, file content or raw HTTP error
body belongs in diagnostics. Pending shows immediately, warns above five minutes,
and escalates above thirty minutes or on permission/dead-letter errors. Missing v2
details, unavailable reads or snapshots older than five minutes leave completeness
unconfirmed. A known critical failure remains critical even with missing/stale details.
Unchanged polling does not repeat a notification; recovery dismisses the warning.

`Measured Active` uses `active_seconds`. `Activity with timeout` uses
`wakatime_compatible_seconds` (or the legacy equivalent `total_seconds` for summaries).
Project totals and session timelines use the latter. Do not add the two metrics.
`comparable_seconds` is presented as `Editor-only activity`, which excludes AI Coding
and may be zero while measured activity is positive. Session heartbeat counts are
distinct contributing IDs, not interval counts. Empty observations do not prove a
day had no work.

## Seven completed working days

An hourly scheduled follow-up in this chat runs the metadata-only script:

```sh
python3 scripts/heartbeat-delivery-canary.py
```

It starts with the first full post-install day, October 8, counts completed Monday–Friday
days with activity, and stores results in `output/heartbeat-recovery-2026-10-07/canary/`.
Worker/history observations are scope-bound. Missing service responses or unconfirmed
delivery are not treated as zero or as a passing day. `max_tick_ms` and minute history
are useful observations, not an exact end-to-end ACK latency. Current-day comparisons
are diagnostic and do not count as completed canary days.

The scheduled follow-up stays quiet on unchanged/non-actionable state and reports a
meaningful failure, recovery, required decision or completion. Keep the computer on
and Codex open for local scheduled checks, as described in
[OpenAI's scheduled tasks documentation](https://learn.chatgpt.com/docs/automations?surface=app).
The delivery LaunchAgent itself does not require the dashboard or Codex to be open.

After seven observed days, report delivery age/drain performance and capture gaps,
then pause the follow-up. Compare WakaTime only with the same date/cutoff/timezone,
timeout and coding category scope. The 1% criterion applies to identical input.
Different capture streams require interval evidence and may fail that criterion;
never fill the gap by guessing time or changing timeout.

## Codex capture v2 and local service recovery (October 7)

The supported one-shot broker interface, `wakaclock ai emit --json`, accepts the
strict `BrokerActivityEventV2` envelope in addition to unchanged v1/legacy edit
inputs. V2 contains an event kind, actual timestamp, optional measured tool start,
session/operation IDs, project root and native/wrapper provenance. Unknown fields
are rejected. An activity becomes an `App` heartbeat for `codex` with project
attribution, no invented filename, no write flag and no line-change credit.
Task/message boundaries are anchors only. Only paired tool execution contributes
measured segments; reasoning and known tools waiting for a user carry no measured
interval. Failed tools still represent observed activity. File-change attribution
continues through its existing mutation-evidence pipeline.

Native and wrapper evidence use stable operation/event identity. Native corrections
retain the event ID. Evidence priorities are mapped to dense transport revisions
from zero, with all accepted versions retained; same-revision conflicts return an
error, and lower-priority repeats are duplicates. Dedup is scoped to account/origin.
Temporal overlap alone does not prove operation identity. Outer exec/patch wrappers
become anchors when native child evidence exists and do not extend a file mutation.

The independent collector scans appended complete JSONL records every 15 seconds.
Its bounded cursor and metadata events commit together into `capture.db` before
cursor advancement. Partial lines, restart and inode rotation preserve evidence;
failed writes leave the prior cursor available. Inbox-to-delivery handoff commits
the original heartbeat ID/revision before marking the inbox version handed off.
Receiver capability `capture_activity_versions: [2]` gates handoff, so an unavailable
or older receiver leaves accepted evidence in the inbox. Live discovery uses a
persisted 24-hour initial lower bound; historical replay requires an explicit date.
This rollout scans Codex sources only; other providers retain their existing capture.

```sh
~/.local/bin/wakaclock capture status
~/.local/bin/wakaclock capture install
~/.local/bin/wakaclock capture run --dry-run --date 2026-10-07 --transcript PATH
```

For explicit replay, stop the collector with `capture uninstall`, run `capture run
--date YYYY-MM-DD` against verified sources, then `capture install`. The collector
resumes any inbox remainder automatically. Dry run writes no cursor/inbox/queue and
does not POST. Do not replay guessed intervals or WakaTime-derived compensation.

Capture health is an additive optional field inside delivery snapshot v2; v1 remains
accepted. Old clients have unavailable capture details rather than assumed health.
Overview, Heartbeats, CLI and editor report capture scan/error/pending independently
of delivery. Empty delivery queues alone cannot certify completeness. Canary archives
include collector/worker executable hashes to distinguish local builds sharing 0.2.0
and a dirty git SHA. Metadata-only ambiguous AI days remain unconfirmed; the monitor's
output artifacts and monitoring markers do not qualify a user's working day.

The backend LaunchAgent `com.atoaxis.wakaclock.backend` runs the private runtime in
`~/.wakaclock/runtime/`, outside Desktop permissions. The supervisor checks the sealed
account/data binding, exact pre-existing volume identities, container/service labels,
mounts and loopback port mappings. It refuses an unmanaged endpoint or replacement
volume. Dependencies use Docker Compose and their existing external volumes, with
`--pull never`; Docker is opened on login if its engine is unavailable. Backend starts
after readiness and restarts with 15–300 second backoff. State and transition history
retain health failure, exit status, restart time and wake gap, without credentials.

```sh
python3 scripts/heartbeat-local-runtime.py preflight
python3 scripts/heartbeat-local-runtime.py install
```

Installation requires the previously verified binding manifest. If that evidence or
the original volumes are missing, stop recovery and investigate; never initialize an
empty replacement. After reinstall, wait for health/capability readiness before
deploying a producer. LaunchAgent installers wait for asynchronous bootout before
bootstrap, and fail explicitly if registration fails.

Capture rollback: `capture uninstall` writes the feature flag off and stops only the
new collector. It preserves `capture.db`, queue IDs, all versions, cursors and additive
tables. Preserve a backup before a client/UI downgrade and retain the compatible
backend. Keep the delivery worker draining accepted data. Disable recovery probing
only if evidence attributes a regression to it. Never restore an older queue over
new accepted data or delete backlog as a reset.

The implementation and recovery evidence is in
`output/heartbeat-recovery-2026-10-07/capture-recovery/report-th.md`.
Actual reboot/login and sleep/wake verification and seven completed active working
days remain open acceptance items; controlled backend/Redis restart tests are recorded
separately and must not be presented as those real lifecycle tests.


### Capture compatibility guard (8 October 2026)

Unknown native `item_completed` variants or unknown tool-like response records now
report a static parser failure code instead of silently advancing their source.
Required operation IDs/tool metadata missing from recognized activity records also
fail the batch. Cursor and inbox remain at the previous committed batch; the original
transcript remains the recovery source. Other sources can continue. After adding
support for the format, resume from the retained cursor and reconcile stable IDs;
do not fabricate markers or clear the cursor/inbox to dismiss the alert.

Known reasoning, user-message, compaction, plan and file-change variants retain their
existing handling. The compatibility check respects the live capture start and the
explicit replay day in Asia/Bangkok, so unsupported historical records outside the
selected window cannot cause a false capture failure. The optional cursor end bound
is additive and has a default for old cursor JSON. No duration, timeout, identity,
queue retry or snapshot wire contract changes are included.

Server reachability through GET alone does not unlock deferred recovery probes.
The approved recovery policy still requires an actual successful POST after the
known network/5xx failure, respects Retry-After and probes at most once per scope
per minute. Without that success, the independent worker retries when the recorded
due time arrives even if no new typing occurs. Do not report mere reachability as
immediate backlog completion.


### Local health and the selected editor CLI (8 October 2026)

Capture status re-evaluates checked_at and last_scan_success_at at read time. A stopped,
missing or malformed collector cannot preserve a saved complete value indefinitely.
Delivery state exposes delivery_incomplete and capture_incomplete separately and
combines them in incomplete. A second collector's lock contention must not overwrite
the active owner's health; real storage errors still report unavailable.

Before signing off a client rollout, inspect the global wakaclock.cliPath setting.
An explicit override bypasses the VSIX's managed CLI; installing/reloading the VSIX
alone does not update that executable. Preserve a binary backup, upgrade the approved
selected path atomically, verify its hash, and confirm capture/delivery fields in the
live editor. The deployed override in this recovery is the tested debug CLI at the
existing target/release path; the path name does not identify its compilation profile.

The canary reads default-profile Code JSONC settings metadata and compares an explicit
absolute override with the known deployed hashes. Mismatch/unreadable/unresolvable
metadata is unconfirmed and prevents counting a completed day as observed. Other
profiles or PATH-based overrides need explicit verification; this audit does not
claim to resolve arbitrary VS Code process environments. When intentionally deploying
a different build, verify it and update deployment evidence; do not dismiss the flag
by clearing queue data or claiming that the version string alone proves equivalence.
