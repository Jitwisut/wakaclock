# Recorded readiness evidence — 2 November 2026

Connected development increment on `codex/team-closure-wip`, delivered base
`1646cbf6549565b008e9dadebe6ff76ebe221258`, uncommitted. Stripe stays deferred.
This closes the Phase 2 external-evidence DTO/UI gap; it does not certify external
gates or finish the entire Team Goal.

## Behavior

The existing authenticated launch-readiness route returns additive
`evidence_details` schema1 with separate local/external records. Each record has
gate, recorded result, reference, checked timestamp, build, nullable comparison
with the current server SHA, metadata status and reason. A matching SHA or stored
`passed=true` assertion never becomes certification: every detail has
`certified=false`, external certification stays unconfirmed, and production and
Checkout stay false. Legacy `evidence_scope`/`gates` fields remain compatible;
they are not a new release authorization mechanism.

Missing build/reference, unknown gate/scope, future timestamp or evidence outside
the twelve-month review window is unconfirmed. Build comparison is nullable when
either full SHA is unknown. No records means unavailable evidence, not passed
verification. References render as plain text, without navigation/provider calls.
No credential, file content or private enrollment token is added.

Repository queries use one read-only repeatable-read snapshot for rollout,
generation, optional timezone and evidence. They never create policy/rollout rows.
More than 1000 records is an explicit failure, not silent truncation. Service
recaptures the same source and current ManageSecurity role before responding;
changed evidence/access cancels the result.

Trust has an explicit Owner/Admin evidence review, with no automatic request
before opening it and no action to run tests, grant rollout or open Checkout.
Keys include account/org and numeric session observation, never a token/hash.
Transport checks session before dispatch, checks the shared interceptor's selected
identity without setting Authorization, then rejects a late old-session response.
Account/org/session change remounts the scope; fetching/error hides old data.
Unsupported or malformed details show unavailable rather than an inferred pass.

## Validation actually performed

`cargo check --all-targets -p wakaclock-server` passed in `backend/api`
(session34968, 25.92s), including pure/ignored SQL test source. Final frontend
typecheck session91742 and scoped ESLint session67521 passed with zero warnings.
Import/JSX ordering and nested-conditional lint findings were corrected without
suppression. New source/touched methods were formatted without a bulk rewrite of
large modules. Source hashes/storage/diff checks are in the companion receipt.

No behavioral/native tests, database/service/Docker, migrations, actual provider,
workflow dispatch, feature activation, commit/push or deployment ran. No new
migration/environment setting is needed. Protected router retains its five
previously authorized added lines; identity sync is unchanged.

## Deferred acceptance handoff

After the owner starts verification:

1. In `backend/api`, run
   `cargo test -p wakaclock-server --lib services::team_release::tests`.
   Expect local/external separation, missing/unknown metadata unconfirmed,
   nullable build match and no certification from stored assertions.
2. Disposable `POSTGRES_TEST_URL` database `atoaxis_team_test` only:
   `cargo test -p wakaclock-server --lib repository::team_readiness_tests -- --ignored --test-threads=1`.
   Fixture checks DB identity before migration. Expect tenant isolation, no
   policy/rollout creation, changed-source detection and explicit capacity error.
3. In `frontend/app`, run readiness component/transport tests plus existing Trust
   regressions. Expect explicit load, recorded labels, account/session/scope
   fences, old-data closure, unknown-schema unavailability and no token in keys.
4. Verify authenticated HTTP Owner/Admin/member/cross-tenant requests, role or
   evidence changes during processing, missing/mismatched server build, old
   responses, network/permission failure and a real browser. Compile alone does
   not establish concurrency or actual UI behavior.

Next: original-scope non-Stripe completion inventory and test handoff. Actual
GitHub/provider/Windows/Cloud/canary/customer evidence and Stripe are not passed
by this metadata interface. No real evidence record was created or marked passed.
