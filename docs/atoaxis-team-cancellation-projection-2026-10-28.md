# Cancellation result projection — development, 28 October 2026

Branch `codex/team-closure-wip`, delivered HEAD `1646cbf6`, current source is
**uncommitted** and not a clean candidate. The development milestone remains
**กำลังพัฒนา**, then **พัฒนาครบ — รอทดสอบ** after all original code gaps close.
No behavioral tests, database/HTTP stub/service, real provider request, migration,
flag activation, commit or push was run by this increment.

## Connected code

- Prepared Exchange now records an optional previous observation ID before HTTP.
  It is part of the metadata digest, SQL exchange/audit proof, lifecycle exact-next
  readback and final preflight. A changed predecessor rejects preparation rather
  than adopting a different historical state. Migration059 is additive; None
  omits the new serialized field, and null SQL predecessors are omitted from the
  old root encoding. Existing empty-predecessor hashes remain stable.
- The shared sealed result selector now distinguishes Customer/Checkout/
  cancellation families. Cancellation selects the exact accepted frozen request,
  normalized observation and **one** pending Outcome occurrence, verifying other
  known identities without resolving them implicitly. All account participants,
  enrollment/source heads and canonical before/after roots remain observed with
  account → sorted billing locks. Other operation families reject this selection.
- `Writer::CancellationResult` contains the immutable request, exact observation/
  exchange, prior row basis, current vs retained-only policy and Outcome digest.
  Current projection requires real opaque provider-result correlation, current
  Owner/rollout/row/authorization, live operation and account leases, the same
  predecessor, valid event timing and the newest confirmed prepared exchange.
  Prepared exchanges are ordered by their SQL source-root generation, not by
  timestamp proximity or UUID ordering. Normal provider facts do not increase
  authorization revision or create a new permission grant.
- A current read that observes no cancellation can enable only the original
  existing mutation authority. A scheduled/effective/changed result makes the
  operation read-only. An unchanged mutation response or read-only recovery that
  still finds no cancellation becomes recovery-required. Effective cancellation
  needs actual provider canceled status and ended_at at the original accepted
  boundary; elapsed time or canceled_at alone is insufficient.
- Historical/cold/stale results never become current facts by replay. They are
  retained with audit. A park action can affect only the same old revision/actor,
  unchanged predecessor and expired original lease with no newer exchange; it
  preserves the last current observation/time and makes further mutation read-only.
  An older/newer-lease mismatch records evidence without changing the current row.
  This does not invent permission or silently discard other pending results.
- SQL projection uses revision + previous-observation CAS while locked, preserving
  all original request/first-attempt fields. It writes parent state and a strict
  allowlisted append-only projection record in the same typed Prepare → SQL commit
  → Confirm group. Migration060, inventory normalization and the existing exact-next
  operator/worker decoder cover the audit and every participant's checkpoint.
  Response loss returns reconciliation-required; there is no predecessor replay,
  row reconstruction, new provider request or Owner grant in historical confirmation.
- `project_result` can attempt a current projection only with the opaque actual
  provider result. `resume_next_result` is one bounded cold recovery step and
  cannot treat a file receipt as a live result. Already-resolved receipts are not
  reprojected to renew freshness. The bounded worker still needs wiring.
- Monitoring leases/read exchanges can handle provider_scheduled state without
  reopening mutation. A fresh mutation precondition continues to require the exact
  accepted binding/item/price/currency/amount/quantity/period and a current applied
  ResourceRead. Later canonical source revisions are allowed only when they are
  at least the accepted source revision, requested=applied=current and **all frozen
  business terms stay identical**. The source token still rejects any change after
  proof mint/network waits. A restored earlier revision or changed terms fails;
  ordinary identical reconciliation does not force a different body/key or purchase.

Projection touches no paid coverage, seats, consent, usage allocation or personal
heartbeat/duration data. Provider state is observational; it is not payment or
deployment/business-value evidence. API status rendering and user controls remain
unfinished and are not declared complete from this model/repository work.

## Development checks / test handoff

The actual source receipt is
`output/team-closure-2026-10-13/cancellation-projection-development-2026-10-28.json`.
All-target Rust compilation and static checks are development evidence only.
The first compile of the native test found unwrap requiring Debug on the deliberately
non-Debug error type; the test now uses closed fixture failures, without weakening
the privacy boundary. No new warnings were suppressed and no behavioral tests ran.
An independent Astra read-only review of this projection increment completed after
the earlier usage-limit window. It found no high-confidence authority/data-loss/CAS
defect in the reviewed code. This is not a native HTTP/SQL test or worker/API
readiness pass. The earlier provider-executor/negative-receipt review and broader
runtime verification remain separate handoff items.

| Check | How to run after owner starts verification | Expected behavior / prerequisites |
|---|---|---|
| Projection policy | From `backend/api`: `cargo test -p wakaclock-server --lib services::team_subscription_cancellation::projection_tests` | Causal predecessor mismatch cannot overwrite newer state; cold/live-lease/readonly rules; exact one occurrence; scheduled vs changed vs provider-ended-at-boundary. Synthetic model only |
| Actual local HTTP + SQL flow | From repo root: `python3 scripts/team-stripe-local-check.py --target-dir backend/api/target` | Existing isolated Homebrew PostgreSQL16, unused fixture port56442, serial fixture DB. New `financial_cancellation_result_projection_current_cas_and_history` creates a local TCP stub, verifies methods/version/key/body, actual opaque read/mutation boundary, projections and exact lost-Confirm recovery; stale receipt retry leaves newest ID/state intact; private body/key markers absent in journal. Not real Stripe evidence |
| Legacy predecessor/hash | Run lifecycle and inventory regressions with migrations twice | Missing optional predecessor retains old bytes; real predecessor changes digest; null old exchange root remains stable; mismatched pointer/unknown metadata rejected |
| Required fault/race expansion | Add/run SQL + actual HTTP-stub cases | Old result after newer exchange; multiple pending outcomes; Original/Recovery actors; Owner revoked during HTTP/projection/export; active newer lease vs expired old; current result vs cold result; DB/file failure before/after commit; malformed/missing audit/auth/root; account/live isolation; restored lower source revision; same terms under later reconciliation; changed terms, unknown price and marked private fields |

The synthetic SQL fixture now uses provider-second billing boundaries and retains
microsecond DB acceptance/audit timestamps. This matches the actual provider JSON
contract and avoids manufacturing sub-second billing boundaries in the new HTTP
fixture; assertions were not relaxed. The original duration/timeout golden data
and 1,191-heartbeat regression inputs were untouched.

## Remaining development

Connect bounded worker, operation retry/release, automatic original-actor readonly
readback after crash, runtime status/health and session-only confirm/recover UI/API.
Resolve the explicitly remaining financial retention/restore and original upgrade/
proration/retained-seat downgrade/tooling gaps. Preserve all raw accepted IDs,
receipts, migrations and backups when a feature flag is disabled. No external gate
blocks this independent development, and no remaining code is called a pending test.
