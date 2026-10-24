# Team Copilot commercial admission — 19 October 2026

Source: uncommitted work on `codex/team-closure-wip`, base `b4d68ec7`.
The local `main` branch is already an ancestor of this merge commit; this is not
proof of synchronization with current remote main. No commit/push in this slice.

## Implemented

- Migration 054 adds immutable provider-day admission receipts and a durable
  scheduler cursor. No enrollment, trial activation or legacy receipt backfill.
- New facts require current commercial coverage **and the entire closed UTC day**.
  Partial-day counters are not prorated. Existing receipt identities permit
  authoritative provider corrections after expiry, including empty corrections
  followed by later reappearance. New features/users cannot inherit that proof.
- Receipt identity includes organization, user, installation, provider account,
  GitHub numeric identity, UTC day and feature. Metrics remain separate/mutable;
  no tokens, costs, sessions or personal heartbeat records are invented.
- Staging is not commercial admission. Finished replacement, receipt minting,
  manifest and job checkpoint commit together. Lock order is billing → entitlement
  → rollout → job/config/privacy. Current coverage and the original lease deadline
  are rechecked using a fresh clock before commit, including lock waits.
- Schedule and claim allow newly covered days or exact prior receipt days. A
  persisted rotating configuration cursor prevents permanent starvation after
  the first 100 organizations. At most 100 new jobs per schedule pass.
- Self-day and weekly/CSV projection read the same admitted-fact view, followed by
  existing consent, membership, installation, retention and suppression checks.
  Read fences include enrollment, receipt identity and absorbing dispositions.
  Self-day also checks current provider account and GitHub identity equality.
- Cleanup phase 15 retires invalid/expired admission receipts in batches of 100,
  writing a privacy disposition before deletion. A provider's empty correction
  does not remove the receipt. Temporary `suspended`/`auth_required` installation
  state withholds reads but preserves receipts; removed/changed identity or privacy
  withdrawal may retire them. Existing privacy restore exports dispositions.
- Partial commercial filtering is visible as `commercial_admission_limited`, not
  successful complete ingestion or permanent provider validation failure.

## Validation and limits

| Evidence | Result |
| --- | --- |
| Focused Copilot policy/report tests | 12 passed, 3 native tests ignored |
| Server library excluding five sandbox-blocked HTTP tests | 470 passed, 48 ignored, 5 explicitly excluded |
| Initial full server attempt before final refinements | 468 passed, 5 failed on local socket `Operation not permitted`, 47 ignored |
| Workspace/all-target strict Clippy | passed |
| Native PostgreSQL suite | blocked: initdb shared-memory `shmget` denied by sandbox; SQL/runtime assertions not executed |
| Git diff whitespace / Python fixture syntax | passed |
| GPT-6 Astra read-only review | scheduler starvation and temporary-status deletion found and corrected; review is not runtime evidence |

The native fixture now includes receipt mint-at-completion, enrollment without
backfill, post-expiry corrections/new-feature exclusion, response-loss lease
rejection, empty report recovery, exact identity, suspension preservation,
cleanup, and 101-organization scheduler rotation. Existing weekly/privacy restore
regressions are included in its runner. These assertions **remain pending** until
`scripts/team-copilot-admission-local-check.py` executes successfully.

The approval system could not authorize the earlier redundant `git switch` because
its usage limit was reached. The checkout was already the requested branch. No
approval bypass was attempted. Local PostgreSQL shared memory and HTTP sockets
remain unavailable in the current sandbox; successful earlier native evidence
must not be represented as testing migration 054 or this source.

Evidence: `output/team-closure-2026-10-13/copilot-admission-development.json` and
its referenced immutable logs/hashes. No Docker or provider connection was opened.
The failed owned PostgreSQL fixture was removed; its initialization log remains.
Reused Rust target: 16,793,488 → 16,794,540 KiB, no new target or worktree. Retained
shared target above the 10 GiB review threshold for this active checkout; no
unrelated cache or running binary was deleted.

## Still unfinished / next

1. Run migration 054 and all native admission/weekly/restore regressions in an
   environment that permits the isolated PostgreSQL fixture. Add/execute explicit
   concurrent expiry/consent/lease races for Copilot, not just code inspection.
2. Test admission-backed weekly/report/CSV through real service and HTTP paths,
   including withdrawal during export and restored receipt/disposition conflicts.
3. Finish independent financial enrollment/trial/payment restore proof. The existing
   privacy ledger is not proof that a restored missing entitlement is unenrolled.
   Public commercial activation stays closed until this gate is implemented.
4. Continue trial/billing UI and package-change lifecycle, then staging/provider/
   Windows/Cloud/pilot gates from the full Team Goal. This change is not completion
   of G5 or Team, and does not certify live Copilot or enable production Checkout.

## Update — 20 October 2026

The environment now permits the isolated native PostgreSQL fixture. Fixed the
101-organization test setup to explicitly enable its rollout rows. The weekly
regression also exposed a real response-fence mismatch: admission state was in
only the initial fence. It now lives in the shared state builder used for initial,
final and returned response fences.

Native PostgreSQL now passes **five tests**: Copilot completed/partial ingestion,
expiry corrections and identity/privacy, scheduler rotation, weekly report/source
fences, privacy cleanup/restore, plus the new independent enrollment verifier.
The first test also waits on a real table lock beyond commercial expiry and lease
expiry; facts, receipts and the job checkpoint all roll back, then the exact job
can retry. No Docker was used. Fixture process and data were stopped/removed.

See `copilot-admission-local.json` for exact source hashes and dated logs. Native
proof replaces the previous sandbox blocker for this tested source; it does not
retroactively change the original failed/blocked observations. Full read/export
withdrawal races on admission-backed published reports, real provider sessions,
financial transaction integration and Cloud restore remain separate requirements.
