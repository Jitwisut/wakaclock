# Organization confirmation and authoritative birth proof — 31 October 2026

Status: backend/UI paths connected; compile/typecheck/scoped static checks pass.
Behavioral verification remains deferred by owner instruction. This is an
uncommitted increment on `codex/team-closure-wip`, base `1646cbf6`, following the
[30 October creation handoff](atoaxis-team-organization-onboarding-2026-10-30.md).
Stripe remains deferred. No production readiness, migration application, provider
certification, commit/push or deployment is claimed.

## Authoritative admission

`TransactionProof::capture` now requires the caller's PostgreSQL transaction.
Usage admission, Copilot scheduling and Copilot day replacement acquire billing
first, capture the independent enrollment, then lock and verify the exact birth
and retained confirmation receipts in that same transaction. Receipt minting and
the final independent validation happen before commit releases these locks. A
matching enrollment row alone cannot authorize a fresh organization whose SQL
birth/confirmation evidence disappeared after restore.

Hints remain a different type. Health and scan claims verify birth metadata
without adding organization row locks after a claimed job. They cannot be passed
to receipt minting; actual admission repeats the authoritative check. Existing
legacy organizations retain their original explicit baseline interpretation.
No personal canonical usage, heartbeat, duration or timeout rule was changed.

## Current-Owner recovery

The existing authenticated POST `/organizations` accepts two additional tagged
actions; no protected handler/router lines were added:

- `inspect_birth { organization_id }`: current active Owner only; verifies the
  already committed nonpersonal organization, immutable birth receipt/audit and
  independent roster. Returns optional `creation_recovery` metadata with scope,
  creation ID, digest, observation and the caller's saved confirmation ID.
- `confirm_birth { organization_id, creation_id, expected_birth_digest,
  expected_observation, confirmation_id }`: explicit current-Owner confirmation of
  that inspection. It is default-off with onboarding. It never creates/replays an
  organization, membership, missing birth record or trial.

Recovery payloads and ordinary creation payloads are separate serde variants with
unknown-field rejection. A malformed/unknown recovery action cannot fall through
into an ordinary create, and an actor cannot be supplied in the body. Existing
documented `{name, slug?, creation_request_id?}` creation remains supported.

Confirmation ordering:

1. Billing lock, active Owner and exact SQL/file birth observation.
2. Save one immutable confirmation request plus administrative requested-audit;
   commit SQL before reporting any journal confirmation. Unique organization/
   actor/creation selection retains the original confirmation ID and timestamp.
3. Reacquire billing and current Owner in a new transaction. Recheck birth, exact
   saved request and current independent observation.
4. Append/fsync `ConfirmOrganizationBirthReviewed` under a short file lock, retain
   its original actor/creation/digest/time metadata, and validate again before
   response. The append never resets an enrolled head or reopens closure.

If Owner authority disappears between steps2–3, the request remains requested;
its historical actor is not a later authorization. A new current Owner can inspect
and explicitly submit their own request. Quarantined/deleted or pending enrollment
scopes remain closed. An already accepted confirmation whose SQL receipt vanished
is unconfirmed, not recreated. All new admission/read proof checks include the
retained confirmation metadata as well as original birth evidence.

Migration063 is additive and registered, **not executed here**. Minimal confirmation
requests have no cascading FK and stay separate from ordinary twelve-month audit
cleanup while backup protection is needed. Their final backup-horizon/erasure policy
remains a production configuration/review requirement, not a claim of Cloud restore.

## UI and session boundaries

Each organization card has an explicit Owner verification panel: inspect → review
→ confirm → read back. Nothing is sent on mount. A lost response hides actionable
stale data and offers a fresh check; server readback finds the same saved request,
including after a reload. Confirmed creation is distinct from trial/sharing.

The dedicated transport shares the existing client/auth interceptor and checks
the expected in-memory session before dispatch and before accepting a response.
It requires the matching confirmed request receipt. It never sets an independent
Authorization header or persists tokens in recovery metadata.

Cache keys contain user/org plus a numeric session observation, never a token or
token hash. The session bridge increments that observation only when its existing
token value changes. A not-yet-synchronized session is unconfirmed; a new session
does not reuse the old Owner inspection. Parent keys and late-callback guards
separate account/org switches. Existing token setter/unauthorized behavior remains.

## Evidence and deferred verification

- Rust all-target compilation: session70212, exit0, 17.13s, including new pure and
  ignored SQL regression source. An earlier test-module namespace compile error
  was fixed before this result; no behavioral test was run.
- Frontend `npm run typecheck`: session83421, exit0.
- Scoped ESLint without warnings: the final formatter/lint command passed for
  Teams page, recovery panel, dedicated transport, query keys and session bridge.
  No warnings were suppressed. Tests are excluded by repository lint config.
- `git diff --check` passed. Source hashes and command evidence are in
  `output/team-closure-2026-10-13/organization-recovery-development-2026-10-31.json`.
- Shared Rust target: 19,832,208KiB before, 19,832,524KiB after; reviewed above the
  storage threshold and retained for this active checkout. No new target/worktree.
- No behavioral/native/PG tests, migrations, services, Docker, real provider calls,
  credentials, feature activation, commit, push or deployment were performed.

Later verification commands (not run):

1. `cargo test -p wakaclock-server --lib organization_birth_tests` in `backend/api`:
   original birth survives reviewed confirmation, exact replay stays idempotent,
   changed actor/digest conflicts, closure stays closed, malformed tags cannot
   become creates. Old serialized variants remain compatible.
2. Disposable PostgreSQL `atoaxis_team_onboarding_test` only, configured through
   `POSTGRES_TEST_URL`; run ignored tests serially:
   `cargo test -p wakaclock-server --lib repository::team_organization_recovery::tests -- --ignored --test-threads=1`.
   Test fixtures assert the database name before applying migrations. Expect
   committed creation with lost file confirmation, transferred Owner, member/
   old-Owner denial, requested-before-confirmed state, original-ID retry, no SQL
   reconstruction and restore-loss denial. Existing birth SQL tests also cover
   authoritative/hint/read proof checks before and after SQL birth loss.
3. `npm run test:run -- test/wakaclock-team-organization-creation.test.tsx test/wakaclock-team-organization-recovery.test.tsx`
   in `frontend/app`: explicit confirmation, original request on response loss,
   failed Owner recheck hides old actions, account/session switch, credential-free
   query keys, typed recovery payload and exact readback receipt.
4. Run real fsync/SQL commit-response loss, concurrent Owner removal across both
   transactions, worker/restore/lifecycle and browser-storage/session regressions
   against the same candidate. Compile/static results do not certify these.

## Remaining Goal work and rollback

The initial fresh-organization/current-Owner recovery and authoritative admission
gaps described in the previous handoff are now connected in code. Keep the broader
non-Stripe completion audit, privacy/retention/restore inventory and other original
client/GitHub/configuration requirements in the main Goal ledger. Unprovable
missing/conflicting history remains fail-closed; it is not permission to invent
historical facts. Stripe change/payment work stays deferred.

Disable prospective onboarding/confirmation to roll back activation. Preserve
accepted birth/confirmation metadata, original IDs, SQL requests, journal records
and additive migrations062–063. Inspect remains read-only under current Owner/
deployment proof. Keep a receiver that understands new journal variants: an old
binary must fail closed, not silently relabel scopes as legacy. Do not reset a
journal, delete pending work, recreate missing SQL or roll back schema.
