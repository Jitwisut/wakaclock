# F7-02/F7-03/F7-04 collector handoff — implementation record

วันที่: 2026-09-08  
สถานะ: **implementation and local lifecycle gates validated; live bridge/callback certification remains a release gate**

`wakaclock-core::ai::topology_handoff` defines the boundary between a topology-aware
collector and the existing local broker queue. `CollectorRegistration` requires an
explicit `TopologyContext`. SSH, WSL, dev-container and remote-extension collectors
use `AuthenticatedBridge`; cloud jobs use `CloudJobCallback`; a cloud topology cannot
register as a loopback broker. Registrations carry opaque ids and capability booleans
only. Credentials and listeners remain in the transport layer, so this contract
cannot expose the local broker publicly.

`HandoffLedger` is now used by `wakaclock ai emit`. The runtime restores the ledger
from SQLite, registers or reconnects the collector, records a receipt before broker
submission, and acknowledges it only after the broker accepts or confirms a duplicate.
If the process or backend fails after the receipt is written, the pending receipt and
the broker inbox are replayable after restart. Receipt ordering uses a per-boot source
sequence and local acceptance time; remote wall-clock skew cannot reorder events.

Cross-collector deduplication uses a shared event id or an explicit scoped pair of
producer operation id and per-file mutation id. A path, timestamp, line count,
process name or commit author cannot become a dedup alias. Disconnect and draining
reject new events but retain accepted receipts. Reconnect may rotate boot/session
metadata while keeping the device/workspace/worktree scope; a retired collector or a
different bridge/transport cannot be silently revived. A bounded snapshot is stored
beside the durable queue. Acknowledged aliases are pruned explicitly after the
retention cutoff; pending receipts are never deleted by a blind age cleanup.

`CloudJobEvidence` requires cloud topology plus an opaque authenticated callback-key
reference, job id, tool-event id, mutation id and event id. Its schema has no
commit/PR-author field. `wakaclock ai emit` validates this boundary before accepting a
cloud event; a real adapter must still supply a live authenticated tool-result
callback before a certificate can be promoted.

## Local verification

- `cargo test -p wakaclock-core handoff` passes handoff, retention, sequence and
  queue lifecycle tests.
- Queue reopen tests prove that an accepted-but-unacknowledged snapshot survives a
  process restart and can be cleared after acknowledgement.
- CLI smoke testing with two boot ids confirms the same mutation is deduplicated after
  reconnect without sending a second broker event.
- The full core suite, CLI unit suite, workspace check and `git diff --check` pass.

The code gates are closed locally. Release still needs an authenticated SSH/remote
extension fixture, a real WSL/dev-container teardown/restart, and a disposable cloud
job whose tool-result callback reaches the dashboard. Those environments are outside
this repository and cannot be honestly certified by a fixture-only run.
