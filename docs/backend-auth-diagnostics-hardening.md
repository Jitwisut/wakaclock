# Backend auth and diagnostics hardening

Implemented on `codex/backend-auth-diagnostics-hardening`, based on `dcb40808`.
Review date: 2026-11-15 (Asia/Bangkok). Changes are source-only; production has not
been updated, and no production credentials or data were used in validation.

| Order | Fix | Implementation | Verification | Production |
| --- | --- | --- | --- | --- |
| 1 | Credential-store outages must not log users out | Done | Backend lookup/login and frontend 503 regressions pass | Not deployed |
| 2 | Logout must revoke the server session | Done | PostgreSQL and ClickHouse durable readback, repeat revoke, unrelated session and UI account-switch tests pass | Not deployed |
| 3 | Bound OAuth device-code issuance | Done | IP/client limiter, concurrent database allocation and expiry cleanup tests pass | Not deployed |
| 4 | Old boot diagnostics must not replace newer observations | Done | Memory and PostgreSQL out-of-order, duplicate/conflict, restart and concurrent delivery tests pass | Not deployed |

## Contracts

- Authentication helpers return `Result<Option<_>, AuthFailure>`: missing/invalid
  credentials remain 401; store errors return 503 without raw error/token details.
  Scope denial remains 403. Call sites propagate errors through their existing
  response envelopes, including heartbeat ingestion and presence SSE. Password
  mismatch is a typed rejection; store/task failures during login become 503.
- `POST /api/v1/auth/logout` accepts the caller's signed session (not an API key or
  OAuth grant). It revokes only that session hash. Repeat revocation is safe and
  does not revoke the caller's other sessions. The existing auth IP budget also
  limits logout. The browser clears its session after ACK or a definitive 401;
  failures retain the session and show an error. A delayed response cannot clear
  a newer account/session. A server outage therefore requires retrying logout.
- PostgreSQL uses the existing `sessions.revoked_at`. ClickHouse-only mode uses
  additive `wakaclock.session_revocations`, with synchronous inserts, hashed
  tokens and expiry TTL. Session validation has zero clock leeway and explicitly
  rejects `exp <= now`, so TTL expiry cannot resurrect a revoked token.
- OAuth device issuance has independent process-local limits: 20/minute/IP
  (burst 10), 60/minute/client (burst 30), and bounded limiter-key storage.
  Trusted-proxy resolution uses the existing configuration. A database row lock
  limits outstanding, unconsumed codes to 50 per client across API replicas.
  Cleanup removes up to 1,000 expired/consumed codes per allocation attempt,
  including codes belonging to inactive clients. Cleanup is lazy; it does not
  run during periods without issuance. Other OAuth token/approval endpoints are
  not claimed to have new request-rate protection from this increment.
- Diagnostics uses sequence order within a boot and requires a strictly newer
  measurement timestamp for a previously unseen boot. A retired boot can never
  reclaim the current slot, even with a higher sequence/timestamp. Equal sequence
  replays do not extend freshness/TTL. PostgreSQL locks the device row and stores
  retired IDs; memory fallback uses the same transition rule. History is bounded
  at 1,024 retired boots per retained device; reaching it fails closed.
- Clock rollback or equal timestamps across boots are ambiguous and are rejected.
  This is observation ordering, not trusted proof of process start time. Historical
  retired IDs from before this rollout cannot be reconstructed. Memory fallback
  remains ephemeral and its expired observations are evicted after 30 days.

## Validation

- `cargo test --locked --offline -p wakaclock-server --lib`: 655 passed, 0 failed, 92 ignored in the standard server suite.
  Database integration tests are opt-in and run separately below.
- `middleware::auth::security_tests` (ignored, explicitly enabled): isolated
  PostgreSQL + ClickHouse; revocation/readback and failed-schema 503 checks.
- `repository::oauth_device::tests::device_capacity_is_atomic_and_expired_records_are_cleaned`:
  eight concurrent requests against a limit of three produce exactly three rows;
  expiry cleanup restores capacity.
- `services::ai_diagnostics::tests::postgres_rejects_retired_boots_after_restart_and_concurrent_delivery`:
  migration applied twice, durable boot history, conflicting duplicates, concurrent
  same-report delivery and account isolation.
- Frontend `session-store.test.tsx` + `wakaclock-http-clients.test.ts`: both layout
  configurations, 58 assertions/tests; includes 503 session preservation.
- Server library/binary `cargo check` and Clippy with warnings denied; frontend
  TypeScript and ESLint for changed product files; changed-module formatting and
  `git diff --check`.

Tests use disposable Docker PostgreSQL/ClickHouse instances on dedicated loopback
ports, without production volumes. The first sandboxed run could not bind/connect
local test servers; permitted reruns used the same isolated fixtures. An initial
ClickHouse INSERT syntax failure was fixed and the regression passed afterwards.

Heartbeat payloads, IDs, canonical keys, activity segments, duration calculations
and analytics formulas are unchanged. Heartbeat handler edits only propagate auth
failures (including their existing headers). No production time-total comparison
or installed-runtime validation is claimed.

## Deployment and rollback

Run additive PostgreSQL migration `065_auth_diagnostics_hardening.sql` through the
normal migration runner; the startup ClickHouse migration creates the revocation
table. Upgrade all API replicas before relying on these protections, then deploy
the frontend and verify logout + temporary-store-outage behavior in staging.
Do not mix old diagnostic writers with the new boot-history rules.

Keep the new tables/columns during rollback. Rolling back to an older backend can
ignore ClickHouse session revocations and diagnostics boot history. A security
rollback therefore requires invalidating old sessions (for example coordinated
JWT signing-key rotation) or retaining the revocation enforcement patch. Do not
claim a frontend-only rollback cancels server-side revocations.

## Artifact lifecycle

The pre-existing shared Rust target was reused (about 23 GiB before and after,
rounded); no new worktree or Rust target was created. It already exceeds the
10 GiB review threshold, so its largest directories were inspected; shared
dependencies/binaries and pre-existing incremental data were preserved. Default
repository compiler profiles were retained. Disposable database containers, the
frontend test report and this task's temporary dependency symlink were removed.
Validation logs are retained outside the source change in the owner's ignored
`output/backend-hardening-20261115` directory.
