# Backend admission and heartbeat integrity

Base: main `e183c863` (PR #137). The owner authorized these six fixes on
2026-11-17 after the main-branch audit. This increment does not deploy, merge,
repair historical data, change the locked time-counting constants, or change
the activity timeline/duration algorithms.

## Changes

| Item | Behavior |
| --- | --- |
| Early-access | Resolve client IP only through configured trusted proxies. Use a separate 5/minute, burst-5 signup budget; login/logout budgets are unaffected. Throttles return 429 with Retry-After: 60. |
| Diagnostics | Keep the device budget at 12/minute, burst 3; add account-wide 60/minute, burst 10. Rotating client device IDs cannot reset the account budget. |
| H1 | Legacy change-ID dedup/revision lookup includes entity alongside change ID and session, matching the existing canonical per-file identity. |
| H2 | Sequential revisions use the maximum of persisted and already staged revisions in the same batch. Missing/skipped bases remain rejected. |
| H3 | Assign a random server transport ID to an ID-less HTTP heartbeat before persistence and bulk response construction, in every ingest mode. Returned IDs can address the stored row for deletion. |
| H4 | Select candidate logical identities from the requested window, rank all revisions of those identities within the account, then filter winning rows by the requested window. Apply the same rule to measurement-repair lookup. |

Historical ID-less rows remain untouched and independent. New server IDs are
random, never inferred from path/time/content. An ID-less retry that does not
reuse a returned ID is still an independent observation, as before. Existing
client IDs remain unchanged. A nonzero HTTP revision without any operation ID
now returns 400 before ID generation; a server-generated ID cannot identify its
base and must not turn this malformed input into an endlessly retryable 500.

## Diagnostics bounds and compatibility

- Signup and diagnostics limiter maps are process-local, bounded to 10,000 keys,
  with expired-bucket cleanup and serialized key admission. At global key
  capacity they fail closed until buckets age out. Limits multiply with API
  replica count; they are not advertised as distributed request quotas.
- PostgreSQL serializes diagnostics admission by locking the account's user row
  within the same transaction as existence check, count and insertion. At most
  32 retained devices may be newly admitted per account across updated replicas.
  Existing devices remain writable even for pre-existing over-cap accounts.
- Expired device records still count toward this cap: expiry hides a snapshot,
  not its retired-boot fences. No old boot history is automatically erased.
  Device retirement/reclamation is a separate future workflow; clients must
  reuse stable device IDs instead of minting IDs on every boot.
- The ephemeral compatibility store has a total 10,000-device ceiling and retains
  fences until process restart. Storage capacity failures return 503; per-account
  device-cap failures return 429 without pretending they will clear after a short
  Retry-After interval. Transient request throttles include Retry-After: 60.
- Latest reads return at most 32 active reports, with an additive `incomplete`
  flag when more exist. Both dashboard layouts show incomplete coverage. Old
  response payloads without the optional frontend field remain compatible.
- No new endpoint or schema migration is required. Heartbeat queues and retry
  policy are unchanged.

## Validation

Validation is performed against synthetic accounts on disposable PostgreSQL 16
and ClickHouse 24.10, using only `POSTGRES_TEST_URL`/`CLICKHOUSE_TEST_*`, never
application credentials or volumes. Final results on 2026-11-17:

| Check | Result |
| --- | --- |
| Server library, final sources | 665 passed, 0 failed, 95 opt-in tests ignored |
| Heartbeat ClickHouse regressions | 3 passed (explicitly enabled ignored tests) |
| PostgreSQL diagnostics ordering/admission concurrency | 1 passed |
| PostgreSQL/ClickHouse logout regressions | 2 passed |
| PostgreSQL OAuth allocation regression | 1 passed |
| Diagnostics panel, both frontend layouts | 36 passed |
| Backend library/server Clippy with warnings denied | Passed |
| Frontend TypeScript, touched-product-file ESLint, diff whitespace check | Passed |

Seven database tests were enabled explicitly; the other opt-in suites were not
run. Logs are in the workspace's ignored `output/backend-integrity-20261117/`
directory. No production dataset, runtime installation or rollout is claimed.

- Standard server-library regressions, including existing locked time-counting
  tests, plus new limiter/validation/cap tests.
- `heartbeat_integrity` database tests: multiple files sharing change/session,
  all three staged revision branches, retry/skipped revisions, same IDs in two
  accounts, persisted generated IDs, delete/tombstone replay, projection recovery,
  moved timestamps, old/new/wide windows, and independent historical ID-less rows.
- An independent 15-second overlapping-interval expectation checks that new random
  IDs do not double counted time; projection recovery preserves the same total.
  This is not a production-wide parity or historical repair claim.
- PostgreSQL diagnostics tests exercise two independent connections racing for
  the last device slot, durable boot ordering, restart and existing-device updates.
- Both dashboard layout tests cover incomplete coverage; TypeScript and ESLint
  validate the touched frontend product files.

An initial isolated ClickHouse fixture omitted the analytics migration required
by project identity; the fixture was corrected to use startup order. A projection
recovery assertion initially reused a segment ID for two independent observations;
the fixture now uses distinct segment IDs while preserving identical time spans.
Neither correction changes production projection or counting behavior.

## Rollout and rollback

Upgrade and validate all API replicas before claiming the new device cap or
heartbeat behavior cluster-wide, then deploy the frontend coverage notice.
Verify create/read/delete with an actual client in staging and compare unaffected
canonical rows/segments/lines/duration against the previous artifact. Bug fixtures
must match independent expected results; restored acceptance of previously dropped
rows must not be misreported as a formula change.

No production deployment or full production dataset comparison is part of this
increment. Do not automatically repair old rows dropped by previous deduplication.
Rollback can restore the previous artifacts without deleting stored IDs, history,
queues or boot fences, but it reintroduces the old admission and readback defects.

The existing Rust target was reused (about 23 GiB before and after, rounded);
default space-saving profiles were preserved and no new target/worktree was
created. Task-only database containers, frontend test output and the temporary
dependency symlink are removed after validation. Shared dependencies/build
artifacts remain available for review and evidence logs are preserved.
