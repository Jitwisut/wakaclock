# Cancellation saved-status and original-operation retry — development increment

Source: `codex/team-closure-wip`, delivered HEAD `1646cbf6`, uncommitted increment.
Milestone remains **กำลังพัฒนา**. The agreed endpoint is **พัฒนาครบ — รอทดสอบ**
once all original scoped runtime code is connected; this component does not close
Team or cancellation. No new route is added here. The protected router still has
only the separately approved two Trial lines and one Portal line; their approval
does not include commit/push.

## Code delivered

- `BillingService::team_cancellation_status` checks current Owner, then reads the
  saved original operation without requiring Stripe credentials or the mutation
  feature flag. Pinned financial authority, rollout and independent SQL/source
  evidence remain mandatory. A provider outage cannot manufacture a new request.
- `accept_team_cancellation` loads saved acceptance first, checks the original
  selected binding/source revision and billing boundary, and returns that same
  operation. A new acceptance still needs the existing sealed provider-read
  factory; an empty status probe is not permission or proof of nonacceptance.
- The repository repeats account → billing → Owner → row validation. It verifies
  the immutable contract, original authorization/audit, accepted source request,
  full canonical inventory, enrollment and rollout generation. An opaque response
  carries private pins and recaptures these before exposing the allowlisted DTO.
  No private source tokens, raw frozen payload, credentials or provider response
  are returned. Another current Owner may read history; this grants no dispatch
  authority to that person or the original requester.
- Missing SQL plus retained operation evidence is reconciliation-required.
  Pending/lost confirmation or source drift stays unconfirmed. Status does not
  implicitly confirm history, recreate a row, seed a baseline or call Stripe.
- The new cancellation acceptance nonce is reserved against every financial kind
  and account in the pinned namespace. The helper includes accepted and pending
  requests, dispatches, outcomes/conflicts, lookup/failure/observation history and
  retained group writers. The decisive check runs under the journal lock during
  a **new** CancellationRequest Prepare. Exact original-group replay returns
  before this collision check. Historical writers are not retroactively changed.
- The inner financial transaction fence now permits the same three atomic
  evidence events as the outer fence: Checkout observation, Checkout failure and
  cancellation observation. Late evidence can be fsynced while a group is pending;
  this does not grant Dispatch, standalone Commit, SQL projection or Owner rights.
  Conflicts remain retained/frozen. Existing confirmation policy is unchanged;
  this change is not a general late-evidence reconciliation policy.

Acceptance is reported only as `observed`; `provider_disposition` is null.
`dispatch_available=false` and `dispatch_worker_not_connected` explicitly identify
the missing lifecycle/worker. A noninitial row yields `lifecycle_projection_unconfirmed`.
Queue presence, elapsed billing boundary and `canceled_at` are not proof of provider
schedule, effective cancellation, payment or an entitlement change.

## Test handoff — not executed in this increment

Run only when the owner starts the testing phase, from the existing workspace.
Reuse the shared target and space-saving profiles. Do not run against personal or
production data. No secret belongs in commands recorded in the repository.

| Check | How to run | Expected behavior / prerequisites |
|---|---|---|
| Retained nonce | `cd backend/api && cargo test -p wakaclock-server cancellation_nonce_is_reserved_by_pending_groups_and_retained_other_account_evidence` | Original group replay succeeds; new group, another account/family or orphan with same operation fails closed; rejection changes no state. Synthetic model evidence only |
| Late atomic evidence | `cd backend/api && cargo test -p wakaclock-server financial_group_retains_late_atomic_evidence_without_unfencing_dispatch_or_confirmation` | Real private-file test journal retains cancellation/Checkout/failure while a participant or unrelated org has pending work; reopen and exact retry preserve evidence. Conflict is retained/frozen; Dispatch/standalone Commit still fail. No SQL/provider certification |
| Acceptance/status SQL | `python3 scripts/team-stripe-local-check.py --target-dir backend/api/target` | Uses its existing isolated PostgreSQL runtime and serial native fixture; inspect prerequisites before running. Extended `financial_cancellation_acceptance_exact_next_idempotency_owner_and_rollback_fences` covers saved DTO, service retry, selection mismatch, Viewer denial, Owner revoked before response, missing SQL/auth/audit and lost confirmation. Uses Synthetic preparation, not a production HTTP proof |
| Further race/fault checks | Add/run sealed-factory HTTP-stub + isolated SQL cases | Provider unavailable or mutation flag off on existing reads; final account/Owner/enrollment/rollout change; concurrent same nonce across accounts after rollback; missing-row orphan; late evidence and exact historical reconciliation; source/config/lease expiry, disk-write failure and marked private fields. No extra route or production flag needed |

The compile receipt in `output/team-closure-2026-10-13/cancellation-status-development-2026-10-27.json`
records the actual source hashes and check result. No behavioral test, migration,
Docker/database process, provider request, feature activation, commit or push was
performed by this increment. Existing unrelated owner processes are not stopped.
The shared build cache is retained for ongoing development; no disposable target
or worktree was created.

## Next development within the existing scope

Typed lifecycle, sealed dispatch with a durable exchange ID before HTTP, bounded
worker, recovery authorization and result projection, then session-only API/UI.
Financial retention/independent restore freshness, upgrade/proration and retained-seat
downgrade remain real code gaps. External certification and configuration stay in
the separate test/prerequisite ledger; they are not substitutes for missing code.
