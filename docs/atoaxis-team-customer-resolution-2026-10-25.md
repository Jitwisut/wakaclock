# Customer outcome resolution — 25 October 2026

Continues [customer dispatch/retention](atoaxis-team-customer-dispatch-2026-10-25.md)
on `codex/team-closure-wip`, based on `19f703c0`, with tested uncommitted source.
This increment implements **source-backed customer-create outcome projection**;
it does not complete customer recovery authorization, Checkout or commercial
production readiness. Historical receipts remain historical, not overwritten.

## Implemented

- A private selection object derives exact unapplied outcome IDs and fingerprints
  from independently retained evidence, its original accepted request and Dispatch.
  Callers cannot supply arbitrary exclusions or a participant list. Rejected,
  conflicting or differently attributed evidence blocks resolution.
- Its predecessor inventory removes only those selected, previously unapplied
  observations from the observation view. It does not hide SQL facts or skip a
  damaged predecessor. The ordinary after-view includes newly associated inbox
  and job metadata. All non-retired account scopes are observed and their billing
  locks taken in order; unknown SQL scopes or more than 100 participants fail
  explicitly. Competing provider ownership remains a conflict.
- A typed `CustomerResolution` group binds request, customer, outcome digests,
  expected revision, observation time and projection disposition. Canonical SQL,
  source checkpoints and only the named outcomes advance through the existing
  full Prepare → SQL commit → Confirm boundary. No SQL transaction spans HTTP.
- A current original Owner with the exact unexpired lease can project `verified`.
  A late response with an expired lease or revoked Owner records its customer as
  `recovery_required`/`owner_changed`; it grants no usable customer. A newer active
  lease, changed actor/revision or advanced canonical row is never overwritten.
  If a verified lease expires after Prepare, SQL rolls back and the retained
  verified proposal remains pending; it is not silently changed to evidence-only.
- Lost Confirm is repaired only by exact committed-next SQL/source evidence.
  Current Owner/canonical state is checked separately before returning usable.
  Confirmation after Owner revocation preserves history without reauthorizing
  the old actor. SQL rollback is not automatically replayed as a new write.
- The full account observation token is checked again at commit. Evidence arriving
  after selection survives, remains unapplied and prevents a stale SQL commit.
  Outcome retention still precedes this resolver, including when resolution fails.
- Missing runtime authority cannot select legacy SQL when the same account/live
  tuple has an ingress or source checkpoint. Customer, quote and Stripe semantic
  entry points enforce this; Checkout's shared serialization does too. Guarded
  source-backed Checkout is explicitly blocked until its typed writer is integrated.
  These checks do not turn one account's checkpoints into a global/live-mode fence.

No schema, heartbeat, API-key, duration/timeout or production configuration changed.
The protected `services/user.rs` diff remains confined to the approved
`sync_postgres_identity` delegation; all bytes outside it match HEAD.

## Executed local verification

| Check | Result |
|---|---|
| Server library | 526 passed; 65 opt-in tests ignored in this command |
| Isolated native PostgreSQL financial/identity commands | 23 passed |
| Isolated native Copilot/privacy/report/restore commands | 5 passed |
| Strict workspace/all-target Clippy | Passed without suppressions |
| Rustfmt, diff check, built financial operator CLI | Passed |
| Protected method boundary | Outside approved method byte-identical to HEAD |

The new PostgreSQL resolution test covers live usable projection and quote proof,
newly associated accepted inbox/jobs, lost confirmation followed by Owner
revocation, deferred SQL commit failure, lease expiry after Prepare, already
expired lease, a newer active claim, damaged predecessor, competing ownership,
and late evidence after Prepare. It checks SQL, retained IDs, pending groups and
all affected canonical roots. Existing actual local HTTP tests now check late
Owner-revoked projection and conflicting identities without granting authority.

A separate checkpoint regression exercises customer request/claim/recovery,
quote read/save/get, Stripe accept/schedule/claim and Checkout read entry points
without required authority, including source-only restored checkpoints. Pure
protocol tests reject forged scope/request/hash/ID sets and prove that later IDs
are not cleared. Existing identity/login-billing races and financial regressions
remain in the native runner.

Astra performed a read-only code review and reported no additional
high-confidence defect; it did not execute tests. An early pure fixture used a
stale observation token after narrowing its participant list; that fixture was
corrected. The initial sandboxed full-library run could not bind local HTTP
listeners; the final run with isolated localhost permission passed. Earlier logs
remain available. The runner's obsolete projection-pending labels were corrected
and its final exact-source run retained separately.

Machine-readable evidence, exact source hashes, executable hashes and logs:
`output/team-closure-2026-10-13/customer-resolution-local.json`. These results
are local synthetic evidence, not a clean release candidate, live Stripe test,
Cloud restore certification or authorization to initialize a real baseline.
Private PostgreSQL fixtures are stopped and removed after each run. No Docker,
worktree or new Rust target was created. The shared active target remains about
17.8 GiB, reviewed above its 10 GiB threshold and retained with debug=1 and
incremental=false for ongoing work; no active or unrelated cache was removed.

## Still open, in priority order

1. Source-backed Owner recovery authorization and lookup/readback, preserving
   original request identity while tracking later authorization revisions. A late
   evidence-only result is intentionally not promoted without that flow.
2. Typed Checkout/binding writers and their final authority/read/admission fences;
   comprehensive all-writer coverage remains pending. The explicit source gate
   prevents unsupported legacy mutation but is not a completed Checkout feature.
3. Generic predecessor/multiple-head recovery, financial retention and independent
   restore freshness, plus remaining fault cases across writers.
4. Original G1–G6 gates: latest-main integration/clean candidate/eight packages,
   real GitHub/Copilot staging and second tester, Windows/provider sessions,
   seven actual user workdays, Cloud/prices/live Stripe and three 14-day pilots.

The goal remains active. Public Checkout, trial activation and production readiness
remain false. No commit, push, main update, signing, publication or real source
baseline was performed in this increment. Rollback retains all ledger events,
accepted IDs, SQL checkpoints and additive migrations; older readers must fail
closed on unknown typed writers rather than deleting history.
