# Fresh organization onboarding — 30 October 2026

Connected development increment; compile/static checks only. Uncommitted on
`codex/team-closure-wip`, base `1646cbf6`. Stripe remains deferred. This does not
close all non-Stripe Team development or certify an actual trial.

## Implemented

- Default-off `ATOAXIS_TEAM_ORGANIZATION_ONBOARDING_ENABLED`. Requires an already
  initialized independent journal, pinned namespace and required deployment mode;
  no Stripe credentials/account. No automatic initialization from a database.
- New `FreshUnenrolled` predecessor instead of automatic legacy registration.
  Prepare reserves organization/nonce/creation/audit IDs before SQL writes.
  Confirm appends/fsyncs only after exact existing SQL receipt/audit verification.
  Pending creation is not trial permission; later confirmation/retry cannot reset
  enrollment or reopen quarantine/deletion. Legacy serialized variants stay intact.
- Migration062 stores minimal birth receipt/audit metadata, separate from analytics
  and the twelve-month administrative audit. Organization + initial Owner + normal
  audit + minimal evidence commit in one SQL transaction. No name/slug/content/key
  is stored in the independent birth ledger. Minimal evidence has no cascading FK.
  Registered in the migration sequence; **not applied** in this development run.
- Enabled onboarding requires a nonnil caller retry nonce; actor comes from the
  existing authenticated handler. The nonce is not trusted as an org/user identity.
  Optional response `creation_receipt` confirms only this original creation key,
  not trial, payment, analytics or sharing. No protected handler/router edit.
- Original-key retry checks retained metadata, current Owner and exact SQL birth.
  Missing SQL stays unconfirmed and is never recreated. Legitimate later workspace
  name changes do not rewrite its birth fact. Historical creator is not authority.
- Dedicated UI/transport retains frozen form/nonce/account/server metadata before
  POST. Storage failure sends nothing; corrupt metadata is preserved. Unknown
  response or old-server ordinary 201 retains the request across reload. A matching
  versioned durable creation receipt is required before clearing it. Late account
  callbacks cannot clear another account's operation. Only a known first-attempt
  pre-reservation validation error releases a draft; a later slug conflict does not
  disprove an earlier unknown response.
- The form's in-memory session is checked before request preparation/dispatch and
  response acceptance. A request transformer checks the shared interceptor's chosen
  auth header without setting its own header or persisting a token. This prevents
  the previous account's form from being submitted under a switched session.
- Initial trial/status/lost-trial-ACK recovery accepts a confirmed fresh predecessor
  and verifies retained SQL birth. Read projections and new developer-seat admission
  also check retained birth. Operator inspection distinguishes fresh scopes and
  pending births from legacy/enrolled/closed counts.

Creation does not enable rollout, trial, consent, sharing, repository mapping or
analytics. Existing Owner/package/capacity/rollout/privacy/suppression checks still
apply. Trial dates/coverage/transition identity do not reset on retry. Personal
identity sync, heartbeat, duration, queue, API keys and protected routes unchanged.

## Compile and static evidence

`cargo check --all-targets -p wakaclock-server` passed in `backend/api`, including
pure and ignored SQL regression source (session60978, 18.21s). Source is captured
by hash in `output/team-closure-2026-10-13/organization-onboarding-development-2026-10-30.json`.
Final frontend typecheck/scoped ESLint/diff check details are in that receipt.
Test files are excluded by repository ESLint configuration; no test-lint result
is claimed. No test behavior has been executed.

Shared Rust target reviewed above the 10GiB threshold and retained for this active
checkout: 19,831,932KiB before, 19,832,208KiB after the Rust check. No new target,
worktree, service, Docker container, provider HTTP or actual trial was started.

## Verification handoff — deferred, not passed

During the later owner-authorized verification phase:

1. In `backend/api`, run
   `cargo test -p wakaclock-server --lib organization_birth_tests`.
   Expect prepare-only/unknown/changed namespace/conflicting nonce to fail closed;
   revision1 needs confirmation; retry/late confirmation never resets enrollment
   or reopens closure. Existing legacy serialization remains unchanged.
2. Use only disposable PostgreSQL database `atoaxis_team_onboarding_test`; configure
   `POSTGRES_TEST_URL` through the test environment, then run
   `cargo test -p wakaclock-server --lib repository::team_organization_birth::tests -- --ignored --test-threads=1`.
   These tests apply migrations only after asserting the database name. Expected:
   concurrent same-key requests produce one org; wrong actor/changed original terms
   fail; birth-loss restore blocks trial/retry; Prepare without SQL cannot replay
   creation. Synthetic checks do not certify Cloud restore.
3. In `frontend/app`, run
   `npm run test:run -- test/wakaclock-team-organization-creation.test.tsx`.
   Expect lost response/reload/account-switch stability, no send on local write
   failure, unknown local schema preservation, and no clearing from old-server
   success followed by a slug collision. Add real-browser cross-tab/storage checks.
4. Run existing trial/Owner/privacy/retention regressions and actual commit-response
   loss, interrupted independent append, concurrent Owner removal and deployment
   rollback tests against the same candidate. Compile is not fsync/SQL proof.

## Remaining development and rollout boundaries

- Complete the authoritative admission/restore-path inventory and minimal-proof
  lifecycle review. Trial acceptance does not prove every Team gate is ready.
- Explicit operator resolution is still needed for ambiguous creation when its
  original caller no longer has Owner authority. Do not bypass ownership or infer
  missing history from a SQL org row, arbitrary nonce or creator identity.
- Rollout/privacy initialization remains its existing separate controlled path;
  creation must not export a registry merely to appear healthy.
- Define supported backup-horizon/erasure policy for minimal birth evidence before
  production. Do not sweep it as ordinary 12-month analytics or claim Cloud restore.
- Remaining GitHub/client/package/non-Stripe gaps stay in the main development
  ledger. Stripe preview/change/downgrade work stays deferred by owner instruction.

Rollback: disable prospective onboarding, preserve accepted births, SQL evidence,
journal IDs and migration062. Keep a reader that understands new variants: older
binaries fail closed on unknown variants and cannot be used to relabel fresh orgs
legacy. Preserve pending browser metadata and reconcile original operations after
restoring a compatible receiver. No schema rollback, journal reset or queue deletion.
