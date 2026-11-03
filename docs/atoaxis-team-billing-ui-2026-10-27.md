# Billing UI access and recovery closure increment — 27 October 2026

Branch `codex/team-closure-wip`, delivered base `1646cbf6`; this increment is
uncommitted. It closes a billing UI error path, not Team commercial readiness.

## Code delivered

- The nested Checkout panel now depends on the parent's successful current Owner
  check. Pending/refetch/error/mutation states hide its previous invoice, recovery
  controls and ephemeral hosted URL. Child polling is disabled while the parent
  prerequisite is unavailable; local open-state survives normal parent polling.
  Each child endpoint still requires its own server authorization.
- A 401/403 from Checkout status/recovery, package price, test confirmation or
  hosted destination invalidates the sibling billing views. A normal background
  success cannot clear that denial. Only an explicit parent reload that succeeds
  without a newer denial can restore them. A local epoch prevents an older
  successful reload from clearing a later in-flight child denial.
- Customer recovery confirmation is tied to a monotonic successful Owner-check
  observation, operation and revision. The nested confirmation also binds that
  parent observation. This local UI counter is not a server authority or a stored
  billing fact. Customer identity used by a quote remains the stable original
  operation/revision, so polling does not silently create replacement price IDs.
- Account/organization React keys and query keys retain their original scope.
  Sensitive descendants unmount during suspension, removing old hosted links and
  confirmation selections. A recovered view requires a new link request; it does
  not resurrect a previously displayed URL or approve a charge automatically.
- Closed, metadata-only recovery guidance explains provider connection/backoff,
  authorization, original creation window, ambiguous/missing objects, changed
  seats/terms and unsupported contracts. Unknown error-code text is not echoed.
  Customer identity, invoice evidence and paid access remain separate statements.

No server route, financial authority, price/catalog configuration, entitlement,
public activation or capture/time-counting behavior changes in this increment.
No Docker, dev server, live provider request, deployment or Git mutation occurred.

## Development checks and deferred verification

`npm run typecheck -- --incremental false` passed after the final observation/race
changes, including the added test code. Formatting and `git diff --check` passed.
No `.next` build or new compilation cache/target was created by this check.

Added test code covers parent loading suspension of an already open Checkout/URL,
nested permission failure hiding siblings, background success not clearing a
denial, explicit reload rearming confirmation, price/destination/confirmation
failure propagation, an older reload racing a newer denial, closed guidance and
preservation of the original error. **Behavioral tests have not been executed**
under the owner's development-first instruction. Existing account-switch,
Checkout, quote, hosted-link, invoice and confirmation regressions plus browser
acceptance remain required later. Typecheck is not privacy/runtime certification.

Compile-only source hashes are in the private
`output/team-closure-2026-10-13/billing-ui-development-2026-10-27*.json` receipt.

## Remaining development is not merely missing evidence

Follow-up in the same day's [trial increment](atoaxis-team-self-service-trial-2026-10-27.md)
supersedes item 1 below: the selected-organization trial API/UI is now connected
in code, with behavioral verification and fresh nonpersonal-org enrollment policy
still open. The list below records the state at this UI slice, not an instruction
to recreate that trial implementation.

The subsequent [portal increment](atoaxis-team-billing-portal-2026-10-27.md)
implements item 2's service/repository/provider/UI code. Its one-line protected
route registration was separately approved and added; actual provider/race
verification remains deferred. The inventory below records the earlier checkpoint.

Inspection of the current live `BillingService`, Stripe client and Team billing
handlers still shows these code gaps:

1. Public no-card trial activation/status/recovery API and UI. The internal
   one-time 14-day trial primitive and independent enrollment protection exist;
   they are not yet a self-service product flow.
2. Portal session flow with current Owner/customer checks, approved configuration
   and a fresh, ephemeral allowlisted destination. No portal endpoint/transport
   is connected yet.
3. Upgrade/proration preview, explicit acceptance of the displayed total and
   durable provider mutation/reconciliation. Existing new-purchase price quotes
   are not a subscription-change/proration implementation.
4. End-of-period downgrade/cancellation, explicitly retained developer seats,
   transactional application and revision/history/UI. The pure downgrade seat
   validator is not that runtime.
5. Financial writer/read/admission inventory, retention and independent latest
   restore evidence; remaining onboarding and candidate/package tooling.

Approved production target, actual prices/configuration and external tests stay
pending independently. Implementations can continue behind disabled capabilities;
these prerequisites do not convert a missing code path into a passed gate.
