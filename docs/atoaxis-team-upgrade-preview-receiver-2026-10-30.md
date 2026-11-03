# Original upgrade preview request receiver — 30 October 2026

Branch `codex/team-closure-wip`, delivered base `1646cbf6`; uncommitted increment.
This closes preparation and durable ingress for the readonly preview request.
Actual provider execution, monetary acceptance and capacity change are still code
work. The full Team development goal remains active.

## Current code

- Additive migration061 registers original request/audit tables; no migration was
  executed in this development run. Immutable business metadata is classified
  separately from lease/retry/error fields in the canonical financial inventory.
- Sealed preparation checks current Owner/rollout, canonical account/binding/item/
  source revisions, current package/currency, approved catalog digest/revision and
  the selected future period end. It captures original DB-clock metadata and
  source/enrollment pins, with a bounded deadline, without any HTTP or writes.
- Enqueue rechecks authority/pins/subscription/catalog, then writes the original
  request and audit through typed `UpgradePreviewRequest` SQL/file coordination.
  ACK means durable request acceptance only after commit and independent Confirm;
  provider preview is explicitly unconfirmed and no access/capacity is granted.
- The namespace reserves the quote nonce with distinct `PreviewUpgrade` request
  kind. Unknown/retained IDs cannot recreate missing SQL. An exact duplicate
  validates original immutable metadata, audit and retained accepted request.
- Same-ID service retry reads saved acceptance before preparing again. Saved
  ingress reads need current Owner/source proof, not a provider credential or
  mutation flag; response pins are recaptured. Historical exact-next recovery can
  confirm already-committed SQL, never recreate SQL or replay HTTP from a journal.
- Static inspection found that the closed record-kind allowlist omitted the
  cancellation kinds already emitted by the repository. Explicit cancellation
  and preview kinds now match that inventory; unknown kinds stay rejected.

No new upgrade API route, producer/worker, provider request, flag activation,
service, Docker, migration execution, deployment or Git mutation occurred. The
protected router still contains only five owner-approved trial/portal/cancellation
additions. Heartbeat/duration and delivered identity-sync files are unchanged.

## Compile-only checks and deferred verification

`cargo check --all-targets -p wakaclock-server` passed without warnings after the
factory/readback additions (session12871). Diff checks passed. Tests were not run.
Regressions compiled include original nonce reservation/exact frame replay,
cross-scope rejection, enrollment unchanged, explicit inventory kinds and rejection
of unknown tags. No SQL/fsync/provider behavior is certified by compilation.

When testing is requested, run the `upgrade_preview_request_group` and
`typed_cancellation_and_upgrade_tags` filters in server lib tests, then preview/
payment and financial transaction/inventory regressions. Add/run the isolated
PostgreSQL fixture with an independently seeded paid binding/enrollment/catalog:
new request, same ID/terms, changed terms, Owner loss, catalog/source change,
expiry, permission denial, pending Prepare, SQL write failure and lost Confirm.
Expected: original immutable time/body/hash survives retries; no ACK before durable
commit; known missing SQL remains unconfirmed; no implicit baseline, HTTP or grant.
Run migration twice and verify an empty new table leaves old fact roots unchanged.

## Remaining development

Actual provider price/preview execution, allowlisted positive/negative receipt
retention, typed result projection and quote/status response; explicit amount
acceptance, immutable change operation, original-invoice correlation, worker/payment/
capacity projection and API/UI. Retained-seat downgrade, shared mutation reservation,
broader financial recovery/retention/restore freshness and remaining onboarding/
package/configuration tooling stay open. These are code gaps, separate from the
deferred behavioral and external tests.
