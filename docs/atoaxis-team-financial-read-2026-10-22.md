# Financial read fences — 22 October 2026

Source: uncommitted work on `codex/team-closure-wip` after `b4d68ec7`.
This closes a read-side slice of G4/G5, not the Team launch gate. Public trial,
production Checkout and production readiness remain disabled.

## Behavior implemented

The shared Team privacy/restore guard now also verifies independent financial
enrollment agreement. It observes the live organization and exact entitlement
revision/state between equal per-organization independent-log tokens. Unknown,
deleted, quarantined, pending, missing, mismatched or wrongly configured scope
fails closed. A matching pending proposal is not committed proof. The ledger is
read-only here; no read enrolls an organization, repairs a log or creates coverage.

An expired current entitlement does not by itself prohibit retained historical
reads. Admission receipts, their original event-time coverage, current consent,
repository access, suppression and retention still determine those reads.

The request must retain its original proof through processing, rather than merely
check that the *latest* DB and ledger agree. Cost projections and both own/shared
receipts retain a private financial fence, validate it before returning from the
service and again at the HTTP/CSV response boundary. The fence is excluded from
serialized responses. Copilot daily/weekly, cost comparison, weekly-summary source
proofs and improvement-action read fences include the same independent state.
Owner link/history pages now use the shared restore/privacy and financial gates
before and after processing.

A completed entitlement transition invalidates an older in-flight projection even
when its privacy generation is unchanged. Financial observation freshness does
not bump privacy generation or invalidate previously published weekly reports on
its own. Privacy, cost-source correction and publication rules continue separately.
The health endpoint remains available for diagnosis; its combined restore-guard
reason names both privacy and enrollment checks, not a claim of full billing restore.

## Local evidence

See `output/team-closure-2026-10-13/financial-read-local.json` for dated source
hashes, exact commands, logs, native versions and current results. Native fixtures
use synthetic metadata on isolated PostgreSQL and, for the joint cost test, one
temporary ClickHouse container. These do not certify GitHub/Stripe, browser flow,
Cloud restore, Windows, provider sessions or a clean release candidate.

The joint regression checks the independent five-contributor 500/1,000 micro-USD
cost ledger, canonical correction races, non-republication, summary CSV, receipt
privacy, pending external transitions and completed transitions after response
capture. The financial restore regression includes a pre-enrollment DB restore,
wrong namespace, unknown/deleted scope, pending/committed disagreement, retained
expired history and an unrelated organization's transition.

The first joint attempt failed on an exposed ClickHouse HTTP listener before any
test setup/data read. The runner now checks the published HTTP endpoint as well as
the native endpoint. Keep that failed run as evidence; later successful runs are
distinct. Fixtures stop owned services and retain logs before deleting only their
private test data. Docker is stopped when no unrelated containers are active.

Build storage was reviewed: the reused shared Rust target changed from
18,399,928 KiB to 18,433,752 KiB (about 17.6 GiB). It exceeds the 10 GiB review
threshold and remains the active checkout cache, including the verified operator
binary. No new target/worktree was created. Disposable native fixtures were
removed after stopping; evidence and other tasks' files were retained.

## Still required, in order

1. Enforce the independent proof inside all admission/scan/scheduler transaction
   boundaries and finish the remaining Team reader audit. Current outer guards and
   final response fences are not a replacement for protecting every receipt mint.
   The SQL legacy fallback in receipt views alone cannot prove legitimate legacy.
2. Require the guard independently of DB contents at every commercial activation
   and readiness entry point. Missing configuration is permitted only in a never-
   enrolled precommercial deployment, not as proof after restoring an enrolled DB.
3. Finish new-organization roster lifecycle and explicit failed-commit/provider
   reconciliation, preserving independent binding/account/live-scope, quote,
   customer/Checkout, invoice and subscription source evidence. Agreement of the
   entitlement heads alone cannot approve restored financial inputs.
4. Complete financial retention/deletion, independently versioned log backup and
   restore drills. Checksums cannot detect replacement by a valid older log prefix.
5. Continue portal, trial/billing UI, package changes/prorate/downgrade/grace and
   the original clean-candidate, Cloud, provider/OS, pilot and canary gates.

No commit, push, main update, live configuration or external certification is
included in this delivery. Heartbeat identity, duration, capture and timeout are
unchanged. The full G1–G6 Goal remains active.

## Admission follow-up

The selected admission/scan/scheduler transaction work in remaining item 1 has since been implemented and checked locally; see [admission transactions](atoaxis-team-financial-admission-2026-10-22.md). This does not broaden the earlier read-only evidence or complete the remaining reader/configuration/financial-source restore audit.
