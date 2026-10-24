# Financial ingress operator recovery — 24 October 2026

Continues [account ingress](atoaxis-team-financial-ingress-2026-10-24.md) from
`6dfdd5f6` on `codex/team-closure-wip`. This private local operator workflow is
**ingress-only**. It neither authorizes paid analytics nor proves historical
financial completeness. No real account baseline is applied by this work.
Public trial, Checkout and production readiness remain disabled.

## Implemented scope

- `prepare-ingress-recovery` writes an immutable private metadata plan, never a
  baseline. Explicit Apply requires namespace, account/live scope, the exact plan
  digest and acknowledgment of prospective-only coverage. Plans expire after
  15 minutes; scope, evidence digest, action, current file/account/source state,
  SQL inventory/job predecessor, absent/present head and DB-instance descriptor
  are bound into the digest. The descriptor binds a process/database observation;
  **it does not prove the database has never been restored or rolled back**.
- New-account bootstrap is allowed only with an empty scoped financial inventory
  and no independent account/source evidence. Checks include customers, quotes,
  checkout, bindings/snapshots, source heads/tombstones, inbox and jobs. A legacy
  Stripe customer without account scope, or orphan snapshot, blocks bootstrap
  conservatively. It does not invent an association to a current organization.
- A durable `PrepareBootstrap` records the original plan/digest/evidence and the
  system-observed coverage start before SQL COMMIT. Only known committed SQL
  agreement plus durable `ConfirmBootstrap` makes the account usable. Coverage
  starts prospectively at the system timestamp of that original proposal; it
  does not certify anything before that point.
- COMMIT failure or lost confirmation requires a **new reviewed plan** for the
  original pending bootstrap. It retains the original ID/coverage/evidence.
  A committed account whose SQL head/receipts later disappear is blocked; it is
  never reinitialized as an empty account, including with an already-applied
  plan. Historical/legacy/ambiguous recovery remains unimplemented and gated.
- An independently retained pending signed receipt can be reconciled without a
  fresh provider notification. Apply reuses its exact original ID, timestamp,
  classification, revision and job predecessor. Both ordinary signed retries and
  operator Apply call the same SQL replay helper. No provider create request is
  made and no fallback creates a new event if the pending transition disappeared.
- Applied review IDs/digests remain in the independent journal. Exact retries
  verify current SQL/file agreement and return `already_applied` without mutation,
  even after later receipts. They cannot empty a newer inventory or repair SQL
  loss with an old plan.
- Short file locks never cover SQL awaits. The operator takes account-first
  ordering, then briefly fences financial table writers while observing/applying.
  Table waits/timeouts/deadlocks abort safely. This rare tool can briefly block
  other financial writers; it is not a worker or public endpoint. Original and
  predicted post-Prepare account/source fences are checked before SQL COMMIT.
  Expiry is rechecked after lock waits and before durable changes/commit.
- Plans are create-only, bounded and strict-schema. The same opened descriptor
  is checked for private permissions, regular file identity and a single link,
  then fsynced along with its parent before trust. Damaged/partial files are
  preserved and rejected. A file/hash alone is not approval.

## Operator sequence

Use the already-reviewed private ledger, a private directory and the existing
`POSTGRES_URL` configuration. Never put a URL, credential or financial row in a
command transcript or diagnostic report. These examples contain placeholders.
Stop old writers before guarded deployment; do not use this to bypass review of
legacy or restored financial history.

```sh
team-financial-guard prepare-ingress-recovery /private/operator/ledger.jsonl \
  --namespace <reviewed-namespace> --account <stripe-account-id> \
  --evidence-hash <sha256-of-reviewed-evidence> \
  --output /private/operator/recovery-plan.json

# Inspect the safe summary and the private plan locally. Apply only after review.
team-financial-guard apply-ingress-recovery /private/operator/ledger.jsonl \
  --namespace <reviewed-namespace> --account <stripe-account-id> \
  --plan /private/operator/recovery-plan.json \
  --approve-plan <exact-plan-digest> --acknowledge-prospective-only
```

Use `--live` on both commands only for that explicitly reviewed scope. Reusing an
output filename is rejected. A stale/expired plan must be prepared again; do not
edit/re-sign a plan by hand. `blocked`/`no_change` plans cannot be applied. A failed
Apply may leave a durable pending bootstrap/receipt; inspect and prepare again,
never delete/reset the journal or SQL head. The summary contains counts, digest,
reason, action and times, not provider IDs, payloads, file contents or credentials.

## Validation and limits

The isolated native suite exercises actual CLI Prepare/Apply, missing approval,
private plan integrity, lost bootstrap confirmation, deferred SQL COMMIT failure,
original pending receipt replay without redelivery, stale inventory/instance,
expiry while waiting on the account lock, committed SQL loss, exact idempotent
retry after later receipts and an independent source append during bootstrap.
Legacy Confirm records retain their exact checksum serialization when the new
optional review is absent; a test writes an old-format journal and reads it with
the new loader. The race was found in Astra's read-only review, fixed using a predicted
post-Prepare fence, and added as a deterministic regression. Follow-up review
found no additional high-confidence defect; executed results are recorded in the
private evidence ledger, separately from review.

Current checks/results are recorded in
`output/team-closure-2026-10-13/financial-recovery-local.json`. The final delivery
message and evidence ledger identify the actual committed source and push.
| Local check | Result |
|---|---|
| Server library | 503 passed; 54 opt-in tests ignored in this command |
| Native isolated PostgreSQL Stripe/recovery | 12 commands passed |
| Native Copilot/report/restore/operator | 5 commands passed |
| Strict workspace/all-target Clippy | Passed |
| Built operator CLI metadata-only smoke | Passed |

These synthetic tests are not live Stripe, Windows or Cloud restore evidence.
No Docker is needed; the fixture runner stops/deletes its private PostgreSQL.
The existing shared Rust target is reused with debug=1/incremental=false.

Still required:

1. Approved historical real-account baseline/recovery and independently versioned
   authority storage, retention/deletion and full process/restore drills. An old
   valid journal prefix plus matching old SQL is not detectable by this local
   agreement protocol alone. Neither an evidence hash nor an empty database
   proves historic completeness.
2. Remaining semantic organization financial writers and provider dispatch/outcome
   boundaries, all final read/admission/restore fences, capacity/checkpoint policy
   for the 10,000-receipt/64 MiB journal limits. Never prune accepted evidence to
   make the tool pass.
3. Latest-main integration, clean candidate artifacts and the original G1–G6
   external staging/client/Windows/second-tester/canary/Cloud/prices/pilot gates.

Deploy the compatible journal reader/CLI before using new Bootstrap events;
old readers must fail closed rather than ignore unknown records. Rollback keeps
all accepted journal events, pending operations, plan files and additive SQL
schema. Disable the affected feature/worker; never truncate evidence. No personal
heartbeat, capture, duration, timeout, overlap or canonical IDs were changed.
