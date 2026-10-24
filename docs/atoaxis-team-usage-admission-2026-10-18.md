# Team commercial usage admission — 18 Oct 2026

Branch `codex/team-closure-wip`, base `b4d68ec71393d0c1dfc03b9643208f4f9e6f576b`.
This slice is uncommitted. Goal remains active; public activation, live Checkout
and production readiness remain disabled. No personal heartbeat/usage writer,
duration, timeout or capture formula changed.

## Implemented

- Migration 052 records immutable organization/user/event admission metadata,
  original project/context/time, source revision/hash, consent and entitlement
  proof. It does not copy canonical costs or source content. Migration 053 stores
  restartable scan bounds/keyset, lease, retry and freshness separately.
- Admission uses the shared billing lock, current event-time and admission-time
  entitlement, current developer membership, aggregate consent and repository
  scope. A final locked privacy generation check rejects concurrent revocation.
  Enrollment advances generation once so an in-flight legacy response cannot
  bypass new admission requirements.
- Enrolled organizations' cost reports, comparison/weekly-summary cost source,
  cumulative merged-PR cost, receipts and link proposals filter through receipts
  before the existing privacy projection. Expiry stops new identities while
  historical admitted facts remain readable subject to current privacy/retention.
  Canonical cost/pricing corrections remain canonical; timestamp, project or
  session identity changes conflict instead of silently moving attribution.
- Cleanup phase 14 deletes at most 100 invalid/expired receipts and writes an
  absorbing disposition first. Existing independent privacy-registry export and
  restore carry these dispositions. Old restored receipts and replay are filtered
  even before physical cleanup catches up. This is not a full financial restore
  certification.
- The existing `team-privacy-worker` can run autonomous scans after explicit
  `ATOAXIS_TEAM_USAGE_ADMISSION_WORKER_ENABLED=true` and Team enablement. Default
  remains off. No additional process is installed. Each tick is capped at five
  100-record pages and a ten-second overall deadline, including PostgreSQL claim
  and retry waits. Requests do not hold transactions while reading ClickHouse.
- Scans select the latest logical canonical identity before filtering, use fixed
  bounds and lexical pagination, and resweep after five minutes to find delayed
  records behind the cursor. A sixty-second lease allows crash recovery. Receipt
  writes and page advancement commit atomically; stale workers cannot advance.
  Inactive/unconfirmed organizations receive cooldown without blocking others.

## Local evidence and its limits

`output/team-closure-2026-10-13/stripe-local.json` records the exact dirty-source
hashes, PostgreSQL version, architecture, timestamp and logs. Seven isolated
native PostgreSQL/local HTTP tests pass. Added cases cover duplicate concurrent
admission, mixed scope, transaction failure, cost correction versus timestamp or
session conflict, expiry while blocked, consent revocation during INSERT,
absorbing restore dispositions, scan lease replacement, response loss, atomic
checkpoint rollback and the shared worker deadline under a table lock.

Server library: **471 passed, 47 ignored**. Ignored integration tests are not
counted as passed. Strict workspace/all-target Clippy passed; exact logs and hashes are retained
in the associated machine evidence. No frontend source changed in this slice.

GPT-6 Astra reviewed both admission and scan changes. Two findings were fixed:
retain/admit disagreement about changed timestamps, and unbounded checkpoint
operations outside the shared-worker deadline. Native regressions cover both.

Additional acceptance on 19 Oct (Asia/Bangkok) ran against real ClickHouse
24.10.2.80 and PostgreSQL 16.15 with synthetic metadata. Autonomous enrollment
receipts, delayed-key resweeps, cost corrections, concurrent source changes and
privacy-controlled comparison/weekly-summary CSV matched an independent ledger
of 500/1000 micro-USD with five contributors. Evidence:
`output/team-closure-2026-10-13/cost-joint-local.json`.

This does not certify browser/HTTP enrollment, multi-store financial restore,
provider sessions or live Stripe. The cost fixture uses at most one owned
ClickHouse container plus native PostgreSQL; it stops its services and removes
private database data, retaining logs. Other tasks' pre-existing containers are
preserved; Docker Desktop is stopped when no workloads remain.

## Remaining work in priority order

1. Extend the passing real ClickHouse/PostgreSQL worker and service/CSV tests to
   full process restart, receipt/API/browser acceptance and multi-page recovery.
   Scan health is now wired to Trust (see the 19 Oct health update); full browser
   acceptance and end-to-end coverage remain unconfirmed.
2. Implement Copilot commercial admission at whole UTC-day granularity, preserving
   its separate daily fact identity, consent and privacy publication rules. Do not
   turn daily counters into sessions or PR costs.
3. Finish the independent financial enrollment/trial/payment restore ledger and
   retention policy. A backup lacking an enrollment row must not reopen legacy
   admission or restart a trial. Keep public activation closed until proved.
4. Finish the owner activation API/UI, trial seat-capacity checks, portal,
   confirmed proration, explicit-seat downgrade/cancellation and live billing
   acceptance. Reconcile all existing Team paths before enabling commercial mode.
5. Freeze a clean candidate after code gates, then complete the original G1–G6
   external gates: approved Cloud/pricing/configuration, GitHub second tester,
   Windows/provider certification, eight artifacts, actual canary and pilots.

These local results do not close G5 or the Team Goal. There was no push or merge
to `main`; the earlier merge brought local `main` into the feature branch only.


## Health and response privacy — 19 Oct 2026

Added optional `team.usage_admission` to measurement health and the existing Trust
panel. It distinguishes unenrolled/unconfirmed, pending scans, stale checkpoints,
dependency failure, expired access and observed sweeps. A fresh completed sweep
still explicitly leaves capture/provider coverage unconfirmed. Current commercial
coverage is read at health observation time, so an expired entitlement does not
wait for the next worker scan to display paused.

Only Owner/Admin receive this organization-operation status. Member/viewer output
is `withheld`; no contributor counts, usage IDs, lexical cursor or per-user
backlog ages are exposed. The endpoint rechecks role and privacy generation after
building diagnostics. A native test locks the final policy write, downgrades the
owner, then verifies the prebuilt admin response is rejected.

The UI handles an older server without this field as unconfirmed, clears old data
on query failure/account or organization switch, and notifies once on status/reason
transitions. Observation timestamp updates do not cause repeated notifications.

Local health evidence: server **472 passed / 47 ignored**, native PostgreSQL suite
**7 passed**, Trust/workflow UI **12 passed**, TypeScript and scoped product ESLint
passed. Tests follow the repository's existing ESLint ignore rule; they are checked
by TypeScript/Vitest. Strict Clippy status and exact source hashes are recorded in
`output/team-closure-2026-10-13/usage-admission-health-local.json`.
No Docker was opened for this health slice. This does not certify whole-product
browser acceptance or close commercial activation. Next: Copilot whole-UTC-day
admission and independent financial restore/enrollment proof, followed by the
remaining native process and UI acceptance gates.
