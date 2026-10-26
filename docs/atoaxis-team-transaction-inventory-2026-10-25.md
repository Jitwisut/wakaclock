# Transaction inventory and approved identity correction — 25 October 2026

Task branch: `codex/team-closure-wip`, uncommitted work after `19f703c0`.
This closes the approved login/billing lock correction and prepares the canonical
financial inventory reader for future writer integration. It does not close Team
G1–G6, establish financial-source coverage, or activate trial/Checkout/production.

## Approved identity scope

The [lock-order report](atoaxis-team-financial-locks-2026-10-24.md) records the
implementation and earlier failures. The protected `services/user.rs` diff is
limited to `sync_postgres_identity` delegating to `repository/user_identity_sync`.
The bytes before and after that method are unchanged from HEAD. No API-key,
heartbeat, duration, timeout or schema changes were made.

The new repository resolves the candidate personal-org ID before writes, then
locks immutable user identity and org billing before users/credentials/org rows.
If the actual org differs, all writes roll back before bounded retry. A conflict
uses DO NOTHING/plain SELECT so it cannot wait on the actual org while holding
the losing candidate's user row. Ownership mismatch fails without granting a seat.

## Transaction inventory reader

`repository/team_financial_inventory::in_transaction` runs the existing canonical
statement on the caller's transaction, including its uncommitted writes and
checkpoint. Diagnostic `preview` uses the same path in an explicitly read-only
transaction and rolls it back. Both use one decoder, schema classification,
historical identity union, exact timestamp normalization, limits, conflict checks
and independent-observation fence. Root semantics and diagnostic response stay
unchanged; no arbitrary-root authorization type or automatic seed was added.

The native regression proves:

- The same state produces the same root through either reader.
- A staged semantic write is visible inside the caller's transaction while an
  outside diagnostic still sees the committed predecessor.
- A staged matching SQL checkpoint still cannot grant independent authority.
- Rollback leaves neither the semantic write nor the checkpoint; commit produces
  exactly the root observed inside that transaction.
- Staged unknown columns/JSON are rejected by the common decoder, without exposing
  the marked private fixture text. The guard remains unseeded.

## Local evidence

Private receipt: `output/team-closure-2026-10-13/identity-transaction-local.json`.
It contains exact source hashes, run/log locations and cleanup/storage evidence.

| Check | Result |
|---|---|
| Server library | 503 passed, 56 opt-in tests ignored |
| Isolated native PostgreSQL | 14 commands passed |
| Strict workspace/all-target Clippy | Passed |
| Protected method boundary | Byte-identical outside the approved method |
| PostgreSQL fixture | Stopped and removed; metadata logs retained |
| Docker | Not started |

The PostgreSQL suite reruns eight-way first-sync, real owner/billing contention,
the losing-org lock graph, complete rollback, account/owner fences, lease expiry
and existing financial/admission/ingress regressions. It uses synthetic data and
no live provider credentials. Prior Copilot evidence is retained separately; this
run does not claim a new live Copilot, GitHub, Cloud or Windows certification.

## Remaining work

1. Atomic multi-head financial intent/recovery across account ingress, every
   affected org source and enrollment. A reader is not that coordinator.
2. Integrate all semantic SQL writers and provider dispatch/outcome boundaries;
   do not partially seed a customer-only root when inbox/jobs already belong to
   the canonical inventory. Source pending recovery must verify the exact committed
   next checkpoint/inventory, not replay owner terms/provider creates blindly.
3. Final read/admission/restore fencing, reviewed real-account baseline and
   independent versioned-store/retention evidence. Matching local SQL/journal
   cannot prove that an old matching pair was not restored.
4. Existing external gates remain pending: latest-main integration/clean
   candidate, four native client targets/provider sessions, real staging and
   second tester, 7 user-workday canary, Cloud, approved prices and pilots.

No new commit/push permission is inferred from approval to edit the protected
method. No `main` update or release is performed. Rollback preserves accepted
events, IDs, queues, independent ledgers and additive migrations; this slice adds
no migration. The shared target is reused with debug=1/incremental=false; no
disposable target or worktree was created.
