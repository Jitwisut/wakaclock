# Heartbeat delivery and duration review — 2026-09-16

Scope: VS Code buffer/CLI, Rust offline queue/HTTP client, direct ingest, and canonical duration calculation. P1 = high priority; P2 = normal priority.

## Repair status

The seven findings below describe the pre-fix failure modes. The current working tree now:

- binds queue rows to a normalized destination and credential owner fingerprint;
- retains base and correction revisions in delivery order;
- decides idle bridging from original timestamps and clips only afterward;
- transfers ownership at each anchor/project switch;
- parks 401/403 rows and moves malformed permanent rows to dead-letter storage;
- preserves the original VS Code activity timestamp across delayed delivery and retries; and
- force-flushes all recent buffers through an awaited `deactivate` promise.

Transport work is bounded to 100 leased rows, HTTP requests have connect/request deadlines, VS Code CLI processes have a 45-second deadline, and unsent queue rows no longer expire silently after 30 days. Regression tests cover each corrected calculation and delivery invariant.

## Findings

### 1. P1 — Queue has no account or destination binding

Evidence: `crates/wakaclock-core/src/queue.rs:20,38,472`, `api_client.rs:275,595,643`, `src/handlers/v1/heartbeats.rs:239` (Rust paths relative to backend/api).

All configurations use ~/.wakaclock/queue.db. Rows carry no destination or authenticated-owner envelope. Flush uses the current client URL and Authorization header, while the server correctly derives ownership from that header. Switching from account A to B, or from localhost to a hosted server, can therefore replay A's backlog to B/the new destination. A payload user_id does not protect against this because the API must ignore client-supplied ownership.

Verified by tracing the code; no cross-account request was sent. Fix: bind queued records to normalized destination and verified account identity, pause incompatible queues, and permit key rotation only after confirming it is still the same owner. Do not fix this by trusting a payload user_id on the server.

### 2. P1 — Offline queue discards correction revisions

Evidence: `queue.rs:145-160,177-193`.

The unique key is heartbeat_id alone, and push returns success when that ID already exists. Enqueue revision 0 then revision 1: only revision 0 survives. Session/entity distinctions used by the server are also absent. Reopening the queue deletes duplicate IDs while retaining the oldest record.

Reproduced against the actual Queue implementation using a disposable database: one row, revision 0. Fix the durable identity and migration to include owner/destination, logical event scope and revision; retain required base revisions and deliver in revision order. Replacing the base with only the highest revision is unsafe because ingest rejects orphan/gapped corrections.

### 3. P1 — Day/range boundaries shorten idle gaps before testing the timeout

Evidence: `src/services/activity_timeline.rs:300-317,435-439`.

The nearest event before the range is moved to range.start; the successor is moved to range.end. Bridging subsequently compares the rewritten times. With timeout 15 minutes, events at 23:46 and 00:14 are actually 28 minutes apart. A daily query moves the first to 00:00 and credits 14 minutes that should not be bridged. The symmetric problem affects range end. Daily totals can disagree with a wider-range calculation.

Reproduced the bridge calculation with the exact before/after coordinates produced by the reader: original 0 seconds, rewritten 840 seconds. This reproduction does not execute the SQL reader. Fix: make session/timeout decisions with original timestamps, then clip the resulting intervals to the requested range. Preserve boundary context per relevant stream.

### 4. P1 — Anchor-only switches retain the first project's ownership

Evidence: `src/services/activity_timeline.rs:785-814` (also examine the analogous branch in bridge_by_attendance).

After extending the previous interval to an anchor, the function continues without retaining the anchor's dimensions. Anchors A at 0, B at 600, C at 1200 seconds with a 900-second timeout yield A=1200 seconds, B=0. Expected attribution is A=600, B=600. Total duration can be correct while project/file/language breakdowns are wrong. Timeline's comparable and combined_v2 editor paths call this function too.

Reproduced against bridge_idle_gaps_with_anchors. Fix: let the new anchor own subsequent time after the earlier interval is closed; retain zero-length anchors as cursors until the next event.

### 5. P1 — Authentication failures delete queued activity rather than parking it

Evidence: `api_client.rs:125-160,617-623`.

A queued row receiving 401/403 is classified non-retryable and removed. Despite the comment saying “quarantined,” there is no quarantine write here. Repeated status/flush calls with an expired or wrong credential can delete the backlog one row at a time; fixing the credential later cannot recover these rows from the queue. HTTP 402 already has a separate durable policy.

Verified by control-flow inspection. Fix: pause delivery for auth/scope problems while retaining owner-bound data; store genuinely invalid payloads in a bounded, inspectable dead-letter store instead of deleting them without recovery.

### 6. P2 — Editor retry does not preserve the event timestamp

Evidence: `extensions/vscode/src/buffer.ts:487,685`, `extensions/vscode/src/cli.ts:37-149`, `crates/wakaclock-cli/src/main.rs:5858`, `crates/wakaclock-core/src/heartbeat.rs:597`.

The editor snapshot preserves its ID and measured segments but carries no event time through the CLI. build_heartbeat calls Heartbeat::new, which timestamps the event at CLI execution. If starting the CLI fails, a later retry gets a new anchor timestamp even though its measurements are old. Delayed flushes have the same problem. The timeline uses heartbeat.time as presence evidence, which can create apparent activity during a later idle period or on another day. Already-queued Rust payloads preserve their serialized time; this finding concerns the editor-to-CLI boundary.

Verified by tracing the payload construction. Fix: capture occurred_at in the snapshot and preserve it through primary and extra CLI payloads; keep received_at separate.

### 7. P1 — Shutdown flush skips recent buffers and is not awaited

Evidence: `extensions/vscode/src/events.ts:199-202`, `buffer.ts:310-320,472-484`, `extension.ts:326`.

Shutdown invokes flushDueBuffers, which still requires the normal heartbeat cadence to have elapsed. Work after a recent heartbeat can therefore be skipped when VS Code closes. The disposable also discards the returned Promise, and deactivate returns void, leaving no awaited shutdown completion. Retry snapshots exist only in memory.

Verified by control-flow inspection, not a live editor termination test. Fix: shutdown must drain all pending buffers independent of cadence; persist before asynchronous delivery, and return the bounded drain Promise from deactivate. Crash recovery still requires durable snapshots rather than relying on shutdown callbacks.

## Remaining operational risks

- **Connection pressure:** account_activity_lock detaches a PostgreSQL connection from its pool for each direct ingest. This protects lock lifetime, but should be load-tested because detached connections are no longer governed by the pool's normal in-use bound while requests wait on per-account locks.
- **Hard extension-host crashes:** normal VS Code shutdown is now awaited, and once the CLI starts its Rust queue owns network retries. A process kill between capturing an in-memory editor change and starting the CLI can still lose that most recent buffer. Closing this last window requires a small extension-side journal and recovery protocol.
- **Credential rotation recovery:** owner fingerprints prevent cross-account replay. Backlog created under an old API key stays parked after key replacement because the client cannot prove locally that both keys belong to the same account. A future authenticated rebind endpoint can recover it safely; automatically rebinding would recreate the cross-account leak.

## Reproduction and limitations

`scripts/duration-audit/heartbeat_delivery_review.rs` is a standalone regression probe for findings 2–4. It uses real library functions and a temporary SQLite database and asserts the corrected behavior.

To reproduce from repository root, copy it temporarily to `backend/api/examples/heartbeat_audit_review.rs` and run from backend/api:

```sh
DEVELOPER_DIR=/Library/Developer/CommandLineTools cargo run --locked --offline --example heartbeat_audit_review
```

Remove the temporary example afterward. Expected output:

```text
heartbeat delivery and duration regression checks passed
```

No destructive multi-account or infrastructure load test was run. Unit tests cover queue scoping/leasing, correction ordering, dead-lettering, boundary clipping, anchor ownership, timestamp retries, and shutdown force-flush. Historical data is not rewritten by these repairs.
