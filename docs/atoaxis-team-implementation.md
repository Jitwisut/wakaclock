# AtoAxis Team: implementation and release evidence

Approved: 2026-10-08. Branch: `codex/atoaxis-team`. Status: **implementation in progress, not production-ready**.
No push/merge into `main` is authorized. No production deployment has been performed.

## Scope that remains binding

Software teams of 10–100 developers; GitHub/Issues; Codex, Claude Code, Cursor IDE and
Copilot VS Code including inline, on certified macOS/Windows configurations. Cloud with
separate staging. Metadata only; no source, diff, prompts, responses or CI logs in storage/logs.
Aggregate and individual consent default off. Aggregate minimum is five actual contributors
per metric/window, with complementary suppression. Consent never imports earlier personal
history. Owners/admins cannot override consent. Monthly 10/25/50/100 packages, free viewers,
14-day no-card trial, seven-day payment grace. Owner sets actual prices before checkout opens.
Analytics/admin audit retention is twelve calendar months; payment documents need a separate policy.
No duration, timeout, heartbeat ID, timestamp or capture formula changes in this branch.

## Implemented locally

### Privacy and consent foundation

`030_team_privacy.sql` adds opt-in organization rollout, consent versions/effective timestamps,
consent history and a projection generation. PostgreSQL triggers cover the existing sharing
endpoint too, preventing an old client from bypassing versioning. A no-op update or restart
does not reset effective timestamps. Previous opt-ins without an effective timestamp begin
at migration time, never earlier. Removal/rejoin or a developer/viewer seat transition clears
consent; sharing must be selected again. Team/repository scope and roster changes invalidate
projections. Repository/team references enforce the same organization in PostgreSQL.

Authorization resolves current active user, organization membership and the requested team.
Organization-wide reads require owner/admin; team reads require membership of that team or
owner/admin. Scope resolution excludes viewer seats and inactive/deleted users. Consent is
checked at read time. Generation and authorization are checked again after building an insight
or receipt, returning conflict if sharing changes during the request. No cached report artifact
or signed export URL can retain access after withdrawal.

The old `/analytics` and `/ai` organization routes lacked effective-time consent and suppression.
They retain their envelopes but return `unavailable_privacy_projection`; their analytics
capability is closed. They must not be reopened until the duration projection meets the same
privacy policy. Existing personal duration endpoints are unaffected.

### Canonical cost and receipts

Insights read ClickHouse usage with `FINAL` before time/project filtering and deduplicate by
account + usage fact ID, choosing the latest revision. Only an explicitly attributed project
allowed by the organization contributes. Pricing/provider/model absence remains unavailable;
known zero remains zero. Amounts are estimated micro-USD, not subscription charges.

Suppression considers observed day, priced/unpriced, provider/model and identifiable/withheld
cohorts. It also suppresses small intersections/complements rather than merely checking each
subtotal separately. The parent is withheld alongside the breakdown. CSV calls the exact same
projection and leaves unavailable values blank; it never replaces unavailable with zero.
Capture/delivery coverage is currently unconfirmed, so a visible team estimate is partial.
This conservative projection is not yet certified against arbitrary repeated filter/differencing
attacks; tenant/privacy release gates remain unpassed.

An authenticated session owner can propose a work link when current canonical facts establish
the allowed project. Only that owner can confirm/reject/withdraw it. Owner confirmation is
labelled as such; this does **not** claim a repository/branch suggestion or verified GitHub identity.
Decisions are audited. Confirmation uses a dashboard session token, not a read-only OAuth grant.

A work receipt selects only active developer members with individual opt-in and facts after
that opt-in, including subsecond consent boundaries. It reads current canonical usage rather
than copying costs into PR rows. A session with more than one confirmed work target across
organizations remains unallocated. Unknown costs remain nullable. Link changes invalidate
affected organization projections. No cost is copied onto every PR. Public team merged-PR cost
remains unavailable until allocation/reconciliation/report coverage are complete. Receipt
cost is explicitly partial because unshared details cannot establish a complete PR total.

### GitHub metadata receiver

`POST /api/v2/team/webhooks/github` is gated by `ATOAXIS_TEAM_ENABLED` (default false) and
`ATOAXIS_GITHUB_WEBHOOK_SECRET`. It verifies `X-Hub-Signature-256` over original bytes using
constant-time HMAC verification, parses in memory, and persists an allowlisted typed metadata
record to PostgreSQL before returning 202. Raw payload/body/title/source/diff/credentials are
not persisted or logged. Delivery ID + payload hash make a lost response/retry idempotent;
conflicting identities are not overwritten.

`cargo run --bin team-webhook-worker` drains metadata every 15 seconds, at most 100 records
per tick. Each event and its ACK share one PostgreSQL transaction. `FOR UPDATE SKIP LOCKED`
prevents competing workers; crash releases the row lock and rolls back incomplete processing.
No network call occurs under the lock. Malformed stored schema is isolated in recoverable dead
letter. Database failure keeps accepted events and retries on a subsequent tick. This is an
inbox worker, not a provider reconciliation or GitHub installation/OAuth worker.

Current metadata surfaces: PR/Issue status and timestamps, first submitted review, installation
deletion/suspension. Work updates protect newer state from an older event; earliest ready/review
timestamps survive out-of-order arrival. Installation deletion/suspension disables repository
reads. GitHub reconciliation, CI/check-run mapping, issue-to-PR relations, verified user identity
and automated repository/branch proposals are **not implemented yet**; no full-sync claim is made.

### UI and commercial safety

Teams displays consent preview/effective time, team scope selector, nullable cost/coverage/source,
work metadata, opt-in receipts and consent-filtered CSV. Account/organization/team/date/timezone
are included in query keys. Sensitive read responses use `private, no-store`; query errors and
refetch hide the previous report. Withdrawal removes the local insight query before mutation.
Downloaded files cannot be recalled.

Launch readiness is owner-only at `/organizations/:id/launch-readiness`. It exposes evidence
gates but keeps `production_ready=false` and `checkout_available=false`. Policy code covers
package sizes, 14-day trial, first-failure-based seven-day grace and explicit retained-seat
selection. Stripe HMAC/timestamp verification is unit tested. These policy/helpers do **not**
constitute Stripe Checkout/Billing integration, transactional seat enforcement or subscription
entitlements. No Stripe API call, payment or price has been created.

## API introduced

All authenticated routes remain under `/api/v2`:

| Route | Boundary |
| --- | --- |
| `GET /organizations/:id/me/consent` | Current member's own preview/version |
| Existing `PUT /organizations/:id/me/sharing` | Session-only; transactional history trigger |
| `GET /organizations/:id/insights` | Current scope + effective consent + suppression |
| `GET /organizations/:id/exports/team.csv` | Same projection as insights |
| `GET /organizations/:id/work-items` | Allowed repository/team metadata |
| `GET /organizations/:id/work-items/:repo/:item/receipt` | Individual opt-in and confirmed links |
| `GET/POST /organizations/:id/me/session-links` | Own links; POST session-only |
| `PUT /organizations/:id/me/session-links/:link` | Own confirm/reject/withdraw, session-only |
| `GET /organizations/:id/launch-readiness` | Owner security role; does not open checkout |
| `POST /team/webhooks/github` | GitHub signature, durable allowlisted inbox |

Insights accept `start`, `end`, IANA `timezone`, optional `team_id`, at most 90 days within
the twelve-calendar-month read horizon. No caller-provided account identity is used.

## Remaining work and release gates

The owner confirmed staging, GitHub App and Stripe have not been created. Production deployment
target and the staging provider are still awaiting clarification. Do not invent a host or create
a paid resource. The following stages are **not complete**:

1. Finish seven actually observed working days of heartbeat canary, login/sleep/wake tests,
   production/staging inventory and backup/restore drill. Latest inspected canary evidence is
   dated 2026-10-08T04:31:46+07:00, zero completed active working days, and `canary_complete=false`; this is not a current healthy-runtime claim.
2. Finish retention/deletion workers, restore deletion markers, report invalidation concurrency,
   repeated-query inference defenses and cross-tenant security review. Read cutoff alone is not deletion.
3. Build GitHub App installation/OAuth/identity, read-only API reconciliation/rate-limit recovery,
   selected-repository onboarding, CI and Issue links, automatic evidenced proposals, durable
   allocation materialization with correction handling and merged-PR cost coverage.
4. Inspect actual provider payloads and certify at least 10 real sessions per tool per OS,
   plus an independent inline ledger. Copilot daily facts must stay separate from session facts;
   never invent session/PR token or cost attribution. Current tests are synthetic metadata tests,
   not provider certification. No new Cursor/Copilot capture adapter has been enabled.
5. Finish measurement health projection, improvement actions, descriptive before/after comparison,
   transition notifications, weekly in-app reports and full onboarding. Shared duration summaries
   must regain availability only with the new privacy projection.
6. Implement actual Stripe Checkout/portal/subscription reconciliation, signature-verified durable
   inbox, price/live checks, seat serialization, confirmed prorate, owner-selected period-end
   downgrade and grace cutoff. Owner must provide approved prices. Personal capture stays intact.
7. Run production-like staging performance (90 days/100 people p95 ≤2s), webhook freshness ≤5min,
   security/privacy/restore/client/billing drills and three target teams for 14 real days. Keep sales
   and public production-ready status closed until evidence passes every gate.

`team_release.rs` lists fourteen required external gates. A missing/failed/unreferenced gate
cannot be treated as passed. Product code readiness and external evidence are separate: filling
the evidence table cannot open checkout while commercial implementation remains incomplete.

## Verification

2026-10-08 local results (update after further changes):

- `cargo check -p wakaclock-server --all-targets` and `cargo check --workspace`: passed,
  including receipt routes and worker. Final backend unit tests after the policy corrections
  also passed: 401 passed, 32 intentionally ignored.
- `cargo test -p wakaclock-server --lib`: 401 passed, 32 dependency-backed tests ignored.
- PostgreSQL tmpfs integration: migration applied repeatedly, consent no-op/restart, removal/rejoin,
  durable webhook replay/conflicting ID and worker ACK passed, plus tenant/team isolation, generation
  invalidation, viewer seat transitions and organization cascade deletion. Owner-only link decisions, idempotent proposals, multi-PR allocation ambiguity and receipt
  withdrawal also passed in that fixture. It uses no live ClickHouse or account data. The
  temporary tmpfs PostgreSQL container was stopped after final verification.
- Frontend typecheck + changed-source ESLint: passed.
- Frontend Team/organization suites: 26 tests passed.
- Offline delivery compatibility suite: 12 tests passed. The 1,191-row recovery-probe scope,
  unknown-reason and Retry-After regression passed. Full drain timing was not rerun in this task.
- Strict all-target Clippy is not green: pre-existing `ai/activity.rs` argument-count lint and
  `dashboard_analytics.rs` items-after-tests lint. No lint suppression has been added to hide them.
- No source file implementing heartbeat duration/capture has changed; no WakaTime parity or new
  provider certification claim is inferred from these unit tests.

## Rollout and rollback

Receiver/backend/migrations first, then inbox worker, then client and UI. Leave
`ATOAXIS_TEAM_ENABLED=false` and `team_rollouts.enabled=false` until a controlled staging cohort
is explicitly configured. New schema is additive. A rollback disables Team flag/read projections
but keeps consent history, work evidence, stable IDs, accepted inbox and migrations. The worker
may drain already accepted records while read/producer flags are off. Never reset heartbeat queues
or replace an existing database with an empty one. Never enable checkout from a success-page redirect.

Reference contracts: [GitHub signatures](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries),
[GitHub delivery guidance](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks),
[Stripe events](https://docs.stripe.com/billing/subscriptions/webhooks),
[Copilot metrics](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics),
[Cursor hooks](https://prod.cursor.com/docs/hooks).

## Phase 2 continuation

See [atoaxis-team-phase2.md](atoaxis-team-phase2.md) for weekly publication privacy,
independent restore guard, Team-only retention, Trust and day-scoped canary revisions.
Local synthetic verification is separate from seven actual working days and Cloud gates.
Production/checkout remain closed.
