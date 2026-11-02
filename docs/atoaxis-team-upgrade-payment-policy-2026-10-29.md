# Upgrade invoice composition — 29 October 2026

Branch `codex/team-closure-wip`, delivered base `1646cbf6`; uncommitted development.
This increment implements monetary metadata policy. It does not implement or
certify the full subscription-change flow.

## Code added

- `team_stripe_change_payment` models the accepted original change, exact minor-
  unit totals and a counted semantic multiset of proration lines. It distinguishes
  the old credit and target-price debit, item/currency/quantity and the original
  proration instant/period end. Missing amounts remain nullable; wrong/partial/
  additional lines, changed totals and unsupported base coverage stay unconfirmed.
- Private, non-deserializable `BaseCoverage` is constructed by recomputing initial
  package coverage over the scoped original snapshot/invoice/package. Composition
  checks organization/account/live/customer/subscription/item/from-price/currency/period and the original
  package seats/live/calculation/freshness. A bare settled Assessment from another
  subscription cannot establish base coverage. A successfully validated change
  can produce scoped metadata for a following change, still without paid access.
- The final invoice must be pinned to the original operation by the later durable
  receiver. Its actual subscription/customer/live, update billing reason, complete
  ledger, agreed totals and settlement must match. Merely seeing an active target
  subscription or receiving a successful POST does not settle this assessment.
- `invoice_for_operation` parses an explicitly pinned historical invoice without
  following today's latest invoice. The existing `invoice()` wrapper keeps its
  original current-latest constraint and full-package assessor behavior. Parser
  output allowlists metadata; customer contact/description/prompt/response/raw
  payloads are absent.
- Whole-second provider `paid_at` is compared to acceptance at common second
  precision, while original timestamps are preserved. Invoice/operation identity
  is required independently; time proximity never supplies correlation. Coverage
  ends at the original billing boundary. Every result has `access_granted=false`.

Stripe's [invoice preview contract](https://docs.stripe.com/api/invoices/create_preview?api-version=2025-04-30.basil)
requires retaining the proration instant when applying the update. The
[subscription update contract](https://docs.stripe.com/api/subscriptions/update?api-version=2025-04-30.basil)
and [pending-update behavior](https://docs.stripe.com/billing/subscriptions/pending-updates)
require separate payment and target-state evidence. These documents inform the
next provider flow; reading them is not live provider certification.

## Checks and deferred tests

All-target server compile includes seven new pure regression cases: exact accepted
proration versus full initial coverage; mismatched invoice/amount/ledger/partial/
stale/future evidence; original coverage boundary/freshness; historical pin/privacy;
cross-subscription and cross-financial-scope base substitution; and provider second precision. The post-
cancellation-route compile passed with no warnings. Tests were **not executed**.
No provider request, migration, service, Docker, deployment, flag activation or
Git mutation was performed. The shared target is retained for this active task.

When testing is authorized, run
`cargo test -p wakaclock-server --lib team_stripe_change_payment` in `backend/api`,
then the original invoice/payment regressions. Expected: only exact scoped base
coverage plus the pinned settled accepted proration produces `settled`, with
no access grant; unknown stays unknown and initial-package behavior stays strict.
Add/run actual versioned provider/stub fixtures and independent expected invoice
ledgers for credits, tax, zero due, sequential changes and mixed invoices before
claiming runtime coverage.

## Still missing development

The pure policy does not validate actual HTTP provenance or a SQL/file source
checkpoint. Those remain mandatory at the runtime boundary. The following are
still real code gaps, not deferred verification:

1. Actual provider preview with durable original quote/request and explicit Owner
   acceptance of displayed totals; same proration instant in original mutation.
2. Typed source-backed quote/request/lifecycle/result writers, inventory and
   exact-next recovery; original-operation invoice correlation/receiver.
3. Opaque current authority/provider worker, invoice/payment readback and atomic
   source/entitlement/capacity projection. The policy must not be used as a grant.
4. Saved-status/recovery API/UI and sequential-change base reconstruction using
   retained verified facts, with current provider evidence and source fences.
5. Provider-backed end-period downgrade, immutable explicitly retained members,
   shared subscription reservation and effective capacity/admission changes.

New-purchase Checkout, cancellation and original package assessment retain their
own contracts. They are not substitutes for subscription change. The full Team
goal remains active with the original scope unchanged.
