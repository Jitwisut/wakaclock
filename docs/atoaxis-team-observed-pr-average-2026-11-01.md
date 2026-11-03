# Observed fully priced PR average — 1 November 2026

Owner decision: completeness means **every received canonical fact that is
confirmed linked within the eligible PR scope is priced**. It does not mean all
real provider activity was captured. Stripe remains deferred. This increment is
uncommitted on `codex/team-closure-wip`, delivered base `1646cbf6`.

## Connected behavior

The previous implementation made average/denominator unavailable for every
input. New explicit additive fields now have a calculating path:

- `observed_average_microusd`: floor of exact numerator / denominator, in integer
  micro-USD. Floor is a display/storage rule, never a privacy defense.
- `fully_priced_observed_cost_microusd`: exact sum for eligible PRs.
- `fully_priced_observed_prs`: exact PR denominator, including its privacy support.
- Scope is `received_confirmed_linked_facts_until_merge`; capture completeness
  remains `unconfirmed` and all numeric observed metrics remain partial.

Legacy `average_microusd`/`complete_prs` keep their unavailable semantics for old
clients. Updated Team UI and weekly summary use explicit observed labels and
hide deprecated summary aliases when the new contract exists. API and both CSV
paths include numerator/denominator. Team CSV appends scope, capture-completeness
and rounding columns; its earlier columns are preserved.

PR eligibility requires nonempty received usage, unique confirmed allocation,
valid visibility/consent/project/retention boundaries and a price/provider/model
for every admitted fact. Any hidden/nonsharing/ambiguous link excludes that PR
from the fully priced cohort. No received facts does not become a complete
zero-cost PR. Explicitly observed priced zero remains a valid zero. Latest
canonical revisions are selected once; post-merge usage is excluded as before.
No duration, heartbeat, capture, timeout or personal usage formula was changed.

## Privacy publication and restore

Exact numerator and denominator expose an equation. Joint partition now includes
actual weekly fact identity membership, merged membership, average-numerator
membership, provider/model/pricing-version cells and PR-count support. Count
support records each PR's contributors privately, then groups by the count
equations in which that PR participates. Five people with five distinct PRs are
still a valid five-person aggregate; the rule does not require five people in
each individual PR.

If weekly and cumulative queries observe different revisions/value/pricing for a
shared canonical identity, the response fails changed-projection checks. New
identities between the reads are not assumed to be in the older weekly total;
their actual membership enters complementary-cohort suppression.

Migration064 adds optional private `team_weekly_publications.cost_equations`.
One atomic publication stores every cost equation's hashed fact identities and
every emitted PR count's work/contributor support. It copies no numeric cost,
source, diff, prompt, response or credential. The fingerprint binds canonical
data, links, equation schema/calculation version, numerator and denominator.

Historical reuse requires an identical fingerprint **and whole equation bundle**,
or disjoint cost and PR-count support. Existing conservative union/cohort and
Copilot temporal/cross-family barriers still apply. Overlapping legacy cost
history without equation evidence cannot authorize the new bundle; old writers
without support cannot introduce overlapping views either. Nothing is written
partially before all checks pass. Unsafe output is unavailable/withheld, not zero.

Independent publication marks include equation bytes only when present, so
legacy NULL markers keep their original form. Missing or changed equation proof
after restore fails history agreement; it is never reconstructed from current
facts. On expiry, cleanup clears equation contributor/fact support along with
derived numeric projections and retains the existing week barrier. Minimal
inference proof before expiry is private and never included in API/CSV.

Deploy/migrate receiver before privacy worker and UI. Migration064 was registered
but not applied here. Do not downgrade to a reader that ignores new publication
proof or reset an independent ledger. Previously published weeks may be
invalidated or withheld when calculation/fingerprint changes; corrected figures
are not silently republished. A legacy history barrier may withhold otherwise
priced new output until its non-inference safety can be established.

## Checks and source handoff

Final backend source passed `cargo check --all-targets -p wakaclock-server`
(session91590, 24.59s), including new ignored SQL regression source. Frontend
TypeScript and scoped ESLint results/source hashes are in the companion receipt.
One type-key ordering lint failure was fixed; warnings were not suppressed.
No behavioral test, service, Docker, provider call, migration, commit/push or
deployment was executed. Compile/typecheck do not certify calculation/privacy.

Run only after the owner starts verification:

1. In `backend/api`, `cargo test -p wakaclock-server --lib team_merged_cost::tests`:
   received complete/partial/hidden/empty PRs, exact rational/floor, canonical
   corrections, five distinct PRs, late inter-read facts and privacy partitions.
2. `cargo test -p wakaclock-server --lib team_cost_equations::tests`: identical
   bundles, corrected values, reused PR denominator support, missing facts and
   unknown versions must fail closed where applicable.
3. Disposable `POSTGRES_TEST_URL` database `atoaxis_team_test` only:
   `cargo test -p wakaclock-server --lib repository::team_cost_equations_tests -- --ignored --test-threads=1`.
   Fixture checks the DB before migration; it exercises atomic publication,
   repeated bundle, mixed-support rejection, legacy writer and restored missing
   equation proof. This is not physical Cloud restore certification.
4. In `frontend/app`, run the Team insights/summary component regressions. Expect
   explicit observed labels, exact denominator, unknown versus zero, no old
   completeness claim, and the existing scope/export cancellation behavior.
5. Integration acceptance still needs authenticated API/UI/CSV agreement,
   correction/consent races, retention/restore and independent numeric ledger on
   the same candidate. Strict Clippy and broad suites remain deferred.

This closes the observed-average code gap, not the whole Team Goal. Stripe,
external certification and the remaining original-scope completion audit are
separate. Production readiness and Checkout remain false.
