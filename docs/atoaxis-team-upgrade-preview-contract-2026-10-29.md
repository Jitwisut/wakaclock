# Upgrade preview metadata/body contract — 29 October 2026

Branch `codex/team-closure-wip`; delivered base `1646cbf6`, uncommitted increment.
This is the input/output contract for the next runtime component. It does not
claim a provider request, durable quote, Owner acceptance or paid capacity change.

## Implemented

- Versioned immutable preview request metadata binds quote ID, organization/
  account/live, original actor, customer/subscription/item, old/new price/package,
  currency/amount, catalog digest/revision, canonical binding/source revisions,
  current billing period, original whole-second proration instant and expiry.
  Expiry is bounded by ten minutes and the original period end; retry cannot
  silently renew it. Metadata hash includes the complete business selection.
- Preview body updates the existing item at quantity one using the chosen price
  and `always_invoice` at the frozen proration instant. The eventual update body
  uses exactly that instant/item/price/quantity with `pending_if_incomplete`.
  Preview and actual update use separate operation IDs/idempotency namespaces;
  the actual update's request hash includes its accepted metadata, body and key.
  These are request builders, not HTTP capabilities.
- Normalization checks the actual preview invoice identity, customer/subscription/
  live/currency, conflicting legacy/parent identities, bounded line count, duplicate
  line IDs and optional invoice-parent references. Only normalized metadata is
  retained in the object. Contact, description, prompt/raw text and arbitrary
  provider fields are excluded.
- Missing totals/amounts and partial/unknown line metadata remain observable.
  They cannot become accepted zero-cost terms. Conversion to proposed upgrade
  metadata requires complete matching prorations, the counted semantic ledger
  and subtotal invariant, unchanged original expiry, a later observation and a
  new nonzero operation distinct from the quote ID. A clock-contradictory response
  can be normalized as evidence but cannot yield accepted terms.

The relevant primary contracts are Stripe's [versioned preview API](https://docs.stripe.com/api/invoices/create_preview?api-version=2025-04-30.basil),
[versioned update API](https://docs.stripe.com/api/subscriptions/update?api-version=2025-04-30.basil),
and the official SDK's [preview parameter definitions](https://github.com/stripe/stripe-node/blob/v18.0.0/types/InvoicesResource.d.ts)
and [update parameter definitions](https://github.com/stripe/stripe-node/blob/v18.0.0/types/SubscriptionsResource.d.ts).
No third-party documentation is used as the runtime contract. Actual API/version/
payment-method evidence remains required; these definitions are not live receipts.

## Development checks and later verification

`cargo check --all-targets -p wakaclock-server` compiled the contract and three
new synthetic regression cases with no warnings. `git diff --check` passed.
Read-only Astra review found no further high-confidence normalization/body defect.
No behavioral suite, provider request, service, migration, Docker or Git mutation
was executed. This is not production or provider certification.

When testing is requested, run
`cargo test -p wakaclock-server --lib team_stripe_change_payment::preview` in
`backend/api`, then the shared change-payment and original invoice regressions.
Expected: same original instant and immutable key/hash across serialization;
quote/update IDs never alias; wrong identity/duplicate lines are rejected; unknown
and partial facts remain metadata without acceptability; expired/early evidence
cannot become a charge. Use actual versioned provider/stub payload fixtures for
pagination, tax/credit/zero-due, pending updates and payment methods before rollout.

## Mandatory next runtime code

1. Sealed current-Owner/canonical/catalog preparation and durable original preview
   request **before** HTTP. Public metadata or a body builder cannot mint proof.
2. Actual fixed-origin preview execution and fsynced allowlisted positive/negative
   receipt before return, including late response and response-loss recovery.
3. Typed quote/result SQL-file transaction writers, canonical inventory, nonce
   reservation, exact-next reconciliation and current-Owner status/acceptance.
4. Explicit acceptance of displayed totals, invoice correlation, original-operation
   worker/readback and atomic payment/capacity projection; API/UI and retention/
   restore coverage. Historical source proof is not supplied by this model.
5. End-period downgrade with explicit retained seats and a shared reservation
   across cancellation/change so concurrent mutations cannot cross authority.

These remain code gaps. No success stub, feature flag activation, provider ACK or
readiness claim is added to stand in for the missing pipeline. The original
Team goal remains active.
