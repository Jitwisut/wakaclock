# Team no-card trial development increment — 27 October 2026

Branch `codex/team-closure-wip`, delivered base `1646cbf6`; source is uncommitted
and is not a release candidate. The owner specifically approved only two trial
route-registration lines in protected `handlers/v2.rs`; no other line in that
file, `user.rs` or `user_identity_sync.rs` was changed. That approval does not
authorize committing/pushing the protected router.

## Connected code paths

- Authenticated session-only GET/POST
  `/api/v2/organizations/:organization_id/billing/trial` and POST
  `…/trial/recover`, via existing BillingService and new trial contract/repository.
  Body identity, activation time and arbitrary entitlement state are rejected.
- Separate `ATOAXIS_TEAM_SELF_SERVICE_TRIAL_ENABLED`, default off; a valid
  `CommercialDeployment`, per-organization enabled rollout and current Owner
  are required. Mutation wrappers repeat rollout/configuration checks inside
  the billing transaction. No real flag/configuration was enabled by this work.
- Original internal start/reconcile interfaces and fourteen-day State calculation
  remain intact. Public start checks current developer count and existing purchase
  scope under the billing lock. Repeat activation of the exact initial trial
  retains its original dates; a changed package/provider state cannot restart it.
- Read-only status distinguishes not started, active, expired, subscription-managed,
  exact SQL committed with independent confirmation pending, and unconfirmed
  financial history. Missing SQL/ambiguous pending state never becomes a new
  trial opportunity. Only exact initial SQL/history/audit plus the retained
  transition expose an Owner recovery action.
- Recovery uses the original `reconcile_trial` path and original transition, checks
  current Owner/rollout again, and returns a freshly authorized projection. It
  does not create SQL to compensate for a missing commit or extend the window.
- Trial status performs privacy health outside its billing transaction to avoid
  recursively acquiring billing locks, then rechecks Owner/rollout/SQL/file fences
  before returning. Private tokens, namespace and SQL digest are not serialized.

## Capacity and personal identity boundaries

Common developer admission now considers both accepted Checkout terms and verified
canonical enrollment capacity. An expired trial does not make seats unlimited.
Missing SQL with independently enrolled history fails closed for a new seat.

Astra's read-only review found that applying a global roster check to every
admission would break first personal organization creation and existing logins.
The code now distinguishes two seat-count-only cases:

1. An already active, counted developer membership adds no seat. The caller still
   owns role authorization. Reactivation/viewer-to-developer goes through capacity.
2. Only the first owner/developer of a personal organization positively created in
   the current SQL transaction may bypass an unknown roster entry. It requires
   matching `personal_owner_id`, no membership/Team/financial footprint, original
   `created_at=transaction_timestamp()` and current row-version transaction ID.
   Independent roster/source/group history, including historical participants,
   and SQL heads/tombstones are checked across accounts. Configuration/read errors
   do not mean history is absent; the absence fence is rechecked before return.

`xmin` alone also changes on UPDATE; it is not an insertion proof. The additional
creation-time/ownership/empty-scope conditions and current live code's preservation
of `organizations.created_at` are essential. PostgreSQL documents row-version
`xmin` and the explicit xid8-to-xid cast used for the current transaction.
[System columns](https://www.postgresql.org/docs/16/ddl-system-columns.html),
[transaction identifiers](https://www.postgresql.org/docs/16/transaction-id.html).

These cases never register a financial baseline, start a trial or mint analytics
admission. Normal SQL writers retain the billing lock, but `admit()` does not own
COMMIT; its final file check is not claimed atomic with a later file-only emergency
mutation. New **nonpersonal** organizations outside the roster still require an
explicit enrollment/creation policy. This remains a development gap for fully
self-service organization onboarding; it is not silently treated as legacy.

## Privacy and UI

Trial activation preserves the generation bump. A committed trial can therefore
temporarily have an out-of-date independent privacy registry. The endpoint does
not export/overwrite that registry or refresh its checked time. Trial commit and
analytics proof health are displayed separately; observed agreement is not an
analytics permission or independent proof that both stores are the latest restore.
Consent, source recovery and fact-admission gates remain mandatory.

The trial panel is independent of Stripe customer setup and prices. It uses the
same account/organization-scoped Owner denial boundary as the other billing panels.
An explicit reviewed package/transition is required; unknown response results lead
to readback, not an automatic replacement activation. Cached data/actions disappear
on permission errors, pending reads and account/organization changes. Background
success cannot clear a newer denial; an explicit fresh Owner reload is required.

## Development checks and verification still separate

- Final `cargo check --all-targets -p wakaclock-server`: passed after the two route
  lines, with the earlier unregistered-handler warnings resolved. A first compile
  of new tests found incorrect sibling-module paths; these were corrected.
- `npm run typecheck -- --incremental false`: passed, including the new UI tests.
- Formatting of changed nonprotected files, Python runner syntax and
  `git diff --check`: passed. Protected router diff is exactly two added lines.
- Shared Rust target reused: 18,612,176 → 18,612,480 KiB; reviewed active cache,
  no duplicate target/worktree or additional Node build cache.

**Behavioral tests were not executed**, under the owner's development-first
instruction. Added test code covers flag/request/projection contracts, Owner and
rollout, no-card confirmation, incompatible/expired/unconfirmed states, lost ACK
and original transition recovery, unknown/personal creation vs UPDATE, missing
enrollment SQL, expired capacity, same-seat login and UI account/permission changes.
Native PostgreSQL/HTTP, actual route and UI/browser behavior, concurrent capacity
and rollout changes, final response races, privacy-registry catch-up, and the
existing financial/identity/privacy suites remain required later. Review and
compile success are not substitutes for those results.

Compile-only hashes/checks are in the private
`output/team-closure-2026-10-13/self-service-trial-development-2026-10-27*.json`.
No migrations, real trial, Stripe request, Docker/dev server, credential creation,
deployment, commit or push occurred. No heartbeat/queue/duration/capture change.

Remaining development: portal sessions; upgrade/proration acceptance and durable
provider mutation; scheduled downgrade/cancellation and explicit retained seats;
financial retention/general recovery/latest-restore policy; fresh nonpersonal-org
enrollment; remaining onboarding and candidate tooling. All original external
certification, Cloud/pricing and customer-pilot gates remain separate and pending.
