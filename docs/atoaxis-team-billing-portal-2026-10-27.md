# Billing-details portal development — 27 October 2026

Branch `codex/team-closure-wip`; delivered base `1646cbf6`. Uncommitted source.
Development first; broad behavioral verification is deliberately deferred.

## Code delivered

- An explicit session/current-Owner request for a known verified Stripe Customer.
  The server determines account, mode, Customer, configuration and return URL;
  the request accepts only a nonnil request UUID and explicit confirmation.
- Default-off `ATOAXIS_TEAM_STRIPE_PORTAL_ENABLED`, current organization rollout,
  validated commercial enrollment authority and fully initialized financial-source
  evidence. Missing/ambiguous evidence blocks the request; no implicit baseline,
  customer creation, subscription binding or paid-analytics grant is performed.
- A separately owner-approved private policy pins a dedicated configuration ID,
  provider configuration `updated` version, account/mode, HTTPS return origin and
  exact customer-update/invoice/payment-method capabilities. Subscription update,
  cancellation and public login links must be disabled. Unknown enabled features
  or observed drift fail closed. Configurations must be versioned operationally;
  the app cannot atomically lock provider configuration against external edits.
- The sealed repository proof validates current Owner, Customer operation/revision,
  optional subscriber binding, enrollment and financial-source roots. Account then
  organization lock order is preserved; SQL transactions end before HTTP. Each
  HTTP boundary repeats the proof and current account operational lease/deadline.
  Provider configuration is verified before and after creating the destination.
- Account cooldown uses the existing operational scope, not a subscription
  reconciliation job or financial source transaction. Local permission/policy/
  freshness errors release the scope without creating provider-wide auth/backoff.
  Network/provider failures follow the existing classification and Retry-After.
- The idempotency key binds the UUID to actor/org/account/mode, original Customer
  operation/revision, binding, policy and server-selected return URL. This is a
  synchronous ephemeral link request, not durable financial acceptance: no 202,
  background replay, new financial spool/source fact or stored URL is introduced.
  An unknown response can be explicitly retried with the same local intent for
  sixty seconds; no automatic provider request is made by the UI.
- The final response releases the owned scope, then rechecks current Owner,
  Customer/binding, authority/source/enrollment and configuration policy. A lease
  completion failure or changed observation returns no URL. The authenticated
  response is private/no-store; raw provider bodies/URLs are not diagnostics.
- The UI only shows a destination from an explicit successful request, validates
  the returned contract/Stripe host and uses no-referrer/noopener. Account/org/
  Customer changes or suspended parent Owner checks unmount it. Child 401/403
  invalidates the shared billing Owner boundary. The local display window is
  thirty seconds; expired/backwards-clock observations hide the destination.

## Expiry, authority and scope limits

Stripe does not supply `expires_at` on the portal-session contract. The response
therefore has `provider_expires_at=null`; `display_until` is only the application's
display deadline. Hiding a link or later revoking an AtoAxis Owner does not revoke
an already issued/copied Stripe destination. No such guarantee is claimed.

Opening or successfully creating a session proves neither payment nor current
analytics entitlement. Billing effects still require signed ingress/reconciliation.
Upgrade/proration acceptance and end-of-period downgrade/cancel with selected
retained seats remain separate development; they are not silently delegated to
an unrestricted portal or removed from the agreed scope.

## Route approval and development checks

The owner approved exactly two Trial route lines in `handlers/v2.rs`, followed by
a separate one-line `POST /organizations/:organization_id/billing/portal` approval
under `.context/heartbeat-safety.md`. All three lines are now registered without
changing existing routes. Authenticated API/UI code is connected behind disabled
configuration; real end-to-end behavior is not certified. No commit/push permission
for protected router changes is inferred.

`cargo check --all-targets -p wakaclock-server` passed after the portal code and
test additions. The initial unused-handler warning was resolved by the separately
approved route registration; a post-wiring compile check is recorded in the private
development evidence. `npm run typecheck -- --incremental false` passed, including new test
code. Formatting and static diff checks passed. Pure contract/UI regressions are
written but **not executed**. An Astra read-only review found no high-confidence
blocking code defect; it is not a behavioral or provider certificate.

Deferred checks include Owner/source/policy changes during HTTP, lease expiry,
response loss/idempotency, account cooldown separation, database failures,
actual pinned-version Stripe configuration/session shapes, UI scope switches,
backwards-clock/expiry and permission-denial propagation. Isolated repository/
HTTP fault fixtures still need to be added and executed during verification.

No Docker, provider call, policy/configuration creation, public activation,
schema migration, credential export, deployment or Git mutation occurred. The
shared target remains active (~17.8 GiB); no additional target or worktree was
created and no active/owner cache was deleted. Rollback disables the portal flag
and removes its UI exposure while preserving all accepted financial evidence.

Official contracts used: [create session](https://docs.stripe.com/api/customer_portal/sessions/create),
[session object](https://docs.stripe.com/api/customer_portal/sessions/object),
[retrieve configuration](https://docs.stripe.com/api/customer_portal/configurations/retrieve).
