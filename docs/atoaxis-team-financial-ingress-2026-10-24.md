# Account financial ingress — 24 October 2026

Continues the [SQL inventory](atoaxis-team-financial-inventory-2026-10-23.md) and
[independent source protocol](atoaxis-team-financial-source-protocol-2026-10-23.md).
Developed on `codex/team-closure-wip` after `b4d68ec7`. The source is tested before
commit with exact hashes in the private local evidence ledger. This is account
notification evidence, **not organization financial-source/paid-access restore
certification**. Public trial, Checkout and production readiness remain disabled.

## Runtime path implemented

1. The existing signature verifier/account-mode parser validates a notification;
   raw bytes and signatures remain transient. Preserve only the allowlisted
   event identity, payload digest, type, original creation time, provider IDs and
   original supported/ignored classification.
2. Acquire an account advisory lock before billing, job or binding locks. A
   configured financial guard requires an explicitly reviewed account baseline
   and matching SQL account head. Missing proof never initializes from SQL.
3. Verify the whole bounded immutable inbox inventory against the independent
   account history. Mutable processing disposition/time is excluded; original
   classification and assigned revision are retained in an immutable receipt.
4. Build the exact next receipt with original receipt time, requested revision,
   absent/present job predecessor (requested/applied revisions) and transition ID.
   Stage inbox/job/head changes in the SQL transaction, then flush independent
   Prepare before SQL COMMIT. Flush independent Confirm after the known SQL
   commit. Return success only after durable agreement.
5. Unknown SQL commit or lost file confirmation leaves a pending transition.
   Another event cannot bypass it. The same signed event may reconcile:
   - Exact next SQL head/transition/full receipts: confirm only, without repeating
     job scheduling, even when subsequent processing state changed.
   - Exact predecessor head/full inventory and exact job predecessor: replay the
     **original** signed metadata, ID/time/revision and conditional job mutation.
     No new provider create or owner authorization is inferred.
   - Any other state: retain evidence and require reconciliation.
6. A committed receipt with a missing/mismatched SQL row/head fails closed,
   including the Duplicate ACK path. It never inserts a new record to hide the
   loss. Conflicting signed variants retain metadata/digests and freeze the
   account without overwriting its original receipt.

Ignored and unbound events are included from receipt time, before organization
association. Account/live scope is independent of current enabled bindings.
File locks are short and never cover a PostgreSQL await. Existing shared
append/fsync/checksum/size limits apply; exact retries reestablish file durability
through the existing loader, not just an in-memory acknowledgment.

`accept`, idle scheduling, claim and financial completion now use account-first
ordering. Checkout subscription receipt also acquires the account lock before
the organization lock. Job mutation preserves Retry-After/lease scheduling;
conditional replay uses the original predecessor rather than `revision+1` on
every retry. Lease checks use a fresh clock after waiting for the account lock.

The Checkout repository receives the **same pinned authority/configuration-error
state** as its parent Stripe repository. It must not rediscover a different or
absent environment guard in a nested write path. Normal standalone construction
captures its configured authority once; invalid configuration is retained as an
error rather than reinterpreted as an unguarded mode.

## Interface and rollout limits

Migration056 adds nullable immutable metadata/transition fields to the existing
inbox and an empty account ingress-head table. No backfill or baseline is applied.
The existing independent journal reads a new additive event family; deploy the
new reader before enabling guarded writers. No new product environment flag.

```sh
team-financial-guard inspect-ingress /private/operator/ledger.jsonl \
  --namespace <reviewed-namespace> --account <stripe-account-id>
```

Uses configured `POSTGRES_URL`; `--live` selects the live namespace. Read-only
safe status/count output, no IDs, hashes, credentials, raw data or paths. Possible
statuses include uninitialized, reconciliation_required, conflict, unconfirmed
and ingress_verified_only. The last status does not grant analytics or prove all
financial sources were restored. `financial_sources` stays `unconfirmed`.

The initial slice had only a `cfg(test)` empty-inbox seed. The follow-up
[explicit operator workflow](atoaxis-team-financial-recovery-2026-10-24.md) adds
reviewed prospective bootstrap and exact pending recovery; it does not admit
legacy/historical baselines automatically. No real account activation was run.
Legacy never-commercial deployments without a configured guard retain the
previous inbox path and cannot claim independent coverage. Required deployment
configuration/versioned storage must survive restore; deleting all configuration
is not a safe commercial fallback.

Stop/replace old receivers before enabling this protocol. An old binary does not
participate in the new SQL lock/head protocol and cannot be treated as a guarded
writer. Never remove new events/checkpoints/queues/schema for rollback; retain a
compatible reader and disable the affected worker/feature instead.

## Current validation

Private local `output/team-closure-2026-10-13/financial-ingress-local.json` records
exact hashes, commands, binary/logs and cleanup. The committed source report is a
summary; local fixture logs/data are not release artifacts.

| Check | Result |
|---|---|
| Server library regression | 499 passed, 53 ignored |
| Native isolated PostgreSQL Stripe suite | 11 commands passed |
| Native Copilot/report/restore/operator suite | 5 commands passed |
| Team Trust/workflow UI | 12 tests passed |
| TypeScript / scoped production ESLint | Passed |
| Workspace/all-target strict Clippy | Passed |

New native coverage includes signature rejection, missing baseline, SQL commit
failure after durable Prepare, lost confirmation, exact retry, ignored events,
other-event blocking, changed job predecessor, concurrent duplicate delivery,
committed SQL row/head loss, lease expiry during account-lock wait, marker scans
of stored metadata/journal and the actual built operator CLI. Explicit-authority
Checkout tests include unset environment and missing/pending/ready ingress.
No entitlement is created from those notifications. Fixtures are synthetic and
do not certify Stripe live calls, Cloud backup or Windows filesystem durability.

Astra's read-only review found the missing Checkout job writer in the lock graph
and the nested authority propagation gap; both were corrected. Follow-up found
no new high-confidence issue in that fix. Review is separate from executed tests.
The first ESLint invocation included a test file ignored by the repository's
configuration; its warning log is retained. Production-file lint and actual
Vitest checks are reported separately, without changing ignore policy.

## Still required, in order

1. Approved real-account baseline/recovery workflow with historical evidence,
   retention/deletion and independently versioned storage. The 10,000 receipt /
   existing 64 MiB journal bounds fail closed; capacity/checkpoint/sharding policy
   needs validation before production enablement. No evidence is silently pruned.
2. Normalize remaining semantic writers and wire organization source
   Prepare → SQL commit → Confirm, including customer/quote/Checkout/provider
   dispatch/outcome boundaries. Notification proof does not prove mutable job
   progress or those other financial facts.
3. Account/source proof in all final read/admission/restore boundaries, financial
   retention and full process/restore drills. Current enrollment/privacy fences
   remain prerequisites, not substitutes for this unfinished source integration.
4. Original G1–G6 gates: preserve/commit current source then latest-main
   integration, clean candidate artifacts; real staging, provider/client sessions,
   Windows/second tester/canary; approved Cloud/prices and customer pilots.

No Docker was opened for this slice. Native fixture databases are stopped and
removed by their runners; required local evidence/binaries and the existing
shared build cache are retained. No personal heartbeat/capture/counting baseline,
ID/revision or duration/timeout was changed.
