# Explicit Team pilot control — 1 November 2026

Uncommitted development on `codex/team-closure-wip`, delivered base `1646cbf6`.
Stripe remains deferred. Code and regression sources are connected; behavioral,
native, database and actual staging verification have not been run. No rollout,
trial, consent, service, Docker, migration or provider action was performed.

## Closed code gap

Fresh organization membership creates a disabled `team_rollouts` row. Previously
only fixture SQL enabled it. New `team-pilot` Prepare/Apply supplies explicit
operator configuration without hand-editing application tables, while preserving
the separate organization birth, privacy and no-card trial controls.

This is a privileged **local operator** interface using the explicitly configured
database and independent evidence. `expected_owner` is a reviewed scope reference,
not authentication or permission to impersonate a person. Administrative audit
uses `actor_user_id=NULL` and `actor_kind=local_operator`; it records reviewed
Owner ID, desired settings and plan hash. Namespace and enrollment/privacy tokens
stay in the private plan file and never go into generic audit metadata or output.
The command loads no dotenv and calls no provider or migration.

## Contract

- Prepare verifies current active Owner, nonpersonal live organization, existing
  rollout evidence, independent enrollment/birth proof and fresh matching privacy
  registry. It reads policy directly, without using the helper that inserts a
  default policy. It writes only a new immutable private review plan after its
  SQL transaction has rolled back.
- Plans expire after 15 minutes and bind organization, reviewed Owner, namespace,
  current enabled/generation/policy/publication state, enrollment observation and
  privacy head. All desired settings are explicit. Plans are hash validated,
  bounded, private and protected against overwrite, symlink and hardlink reuse by
  the existing private-file checks.
- Apply requires the exact hash and both explicit acknowledgements. It locks
  global privacy advisory → organization billing → current Owner/user/org →
  rollout → policy. This matches restore/export lock order. No file lock spans a
  SQL await. SQL/file evidence and expiry are rechecked after waiting.
- First Apply checks the exact predecessor and fresh privacy agreement before
  writes. Rollout/timezone changes, generation bump, publication invalidation and
  administrative audit commit together. An absent policy is inserted only if it
  is still absent; concurrent default initialization does not get overwritten.
- Timezone cannot change after policy lock **or any publication evidence**.
  Disabling an already published organization with its existing timezone is
  allowed. An unchanged configuration does not bump generation unnecessarily.
  Copilot still uses its separate complete UTC provider weeks.
- Original operation retry checks its immutable audit/hash before first-Apply
  expiry/predecessor rules. It reads current state, never reapplies the original
  `enabled=true` after a later disable. Missing/restored audit is not evidence
  that the nonce never applied; mismatched predecessor/privacy evidence blocks.
- The response separates its commit/receipt observation from a final recaptured
  current observation. Current rollout/policy and privacy agreement are checked
  together under locks. Failure leaves current fields null/unconfirmed, rather
  than pairing an old enabled snapshot with a newer generation's successful guard.
- The CLI does not export or initialize privacy evidence. A changed generation
  remains unconfirmed until the existing privacy worker publishes matching
  evidence. This is not a new rollout-operation ledger, Cloud restore proof or a
  guarantee about backups taken before that independent mirror completes.

No consent, paid rights, repository selection, trial, usage or heartbeat is
created by enabling a pilot. Existing trial acceptance, admission, consent,
repository/team scopes, suppression and retention remain required.

## Interface for the later verification phase

Use the existing isolated staging environment and reviewed independent ledgers.
The staging wrapper supports `pilot-prepare` and `pilot-apply`, passing explicit
argument vectors to the new binary using only staging configuration. It builds
the operator binary but does not start Docker/dependencies or migrate a database.
Plan paths through this wrapper must be inside its private staging directory.

Prepare arguments: `--organization`, `--expected-owner`, `--enabled true|false`,
`--timezone` and `--output`. Use `Asia/Bangkok` for the agreed pilot. Its safe
summary includes the approval hash and expiry, not private proof tokens.

Apply arguments: `--plan`, `--approve-plan`, `--acknowledge-pilot-only` and
`--acknowledge-no-consent-change`. Neither acknowledgement is inferred. A lost
response retries this same private plan; changing settings requires another
Prepare/review. The same arguments are available on the standalone `team-pilot`
binary (`prepare`/`apply`) with explicit operator configuration.

Fixed reason codes distinguish expired plans, changed predecessor, revoked
reviewed Owner, namespace/operation conflict, locked timezone and unknown commit.
Other failures remain safe dependency/evidence-unconfirmed. Preserve original
plans and audit; never clear a registry or recreate a baseline to bypass failure.

## Verification handoff — not executed

- Pure plan/private-file tests:
  `cargo test -p wakaclock-server --lib services::team_pilot::tests` in `backend/api`.
  Expect exact approval/expiry/hash/schema checks, private roundtrip, no overwrite
  or symlink/public-permission acceptance, and timezone history protection.
- Isolated PostgreSQL test:
  `cargo test -p wakaclock-server --lib repository::team_pilot::tests -- --ignored --test-threads=1`.
  Requires `POSTGRES_TEST_URL` for disposable `atoaxis_team_onboarding_test` only;
  the fixture asserts that database before migrations. It covers fresh birth,
  no mutation during Prepare, explicit Apply, privacy-pending then confirmed,
  lost ACK/readback, later disable, stale-response recapture, private audit
  metadata, missing audit, Owner removal and no trial/consent grant.
- Wrapper metadata/argv tests:
  `python3 -B scripts/test-team-staging-configuration.py`.
  Expect staging-local paths, Thai/spaces preserved as one argument and no Apply
  without both acknowledgements. Tests mock launchers and do not run services.
- Later native/fault cases: concurrent policy initialization/publication, Owner
  removal/consent changes during lock waits, expiry during waiting, audit failure,
  SQL response loss and restore before/after independent privacy publication.
  Real staging must use the same candidate/ledgers and must remain closed when
  freshness or restore evidence is missing.

Final source passed `cargo check --all-targets -p wakaclock-server` in the live
`backend/api` workspace (session20118, 19.40s), including the operator binary and
ignored regression source. Exact-file `rustfmt --check`, Python AST for the three
staging/config/test modules and `git diff --check` passed. Strict Clippy and
behavioral suites were not run during this development-first increment.

Shared active Rust target was reviewed above the 10GiB threshold and retained:
19,832,524KiB before, 19,832,884KiB after. No additional target/worktree or
disposable build directory was created. Protected router remains exactly the
five previously authorized added lines; protected identity sync is unchanged.

Compile/static receipts are stored separately with source hashes. Compilation
does not certify SQL locking, fsync, restore or actual no-card trial behavior.
Whole non-Stripe development closure still requires the final original-scope
inventory; this increment closes the identified rollout/configuration path.
