# AtoAxis Team GitHub — implementation and staging runbook

Status: **implementation in progress; not certified**. Work stays on `codex/atoaxis-team`, based on `8bdd0df`. Do not push or merge `main` without specific authorization. The local test evidence was collected before the source commit; live certification must record the committed build SHA and does not follow automatically from publishing source.

## Implemented

- Additive migration `032_team_github.sql`: verified numeric identity, session-bound one-use PKCE state, one-organization installation binding, repository scopes, member-specific project mappings, session context, durable sync jobs/checkpoints, review/check facts and delivery recovery.
- OAuth tokens use the existing authenticated credential vault. App private key, client secret and webhook secret can be imported into an encrypted App-specific envelope. Staging configuration accepts identifiers and the envelope path only. The local AES vault is a local testing mechanism; Cloud KMS certification is separate.
- Before authorization/install navigation and worker startup, GitHub App identity, exact approved read-only permissions, webhook URL, JSON content type and TLS validation are verified through GitHub. Callback URL evidence is checked locally; a live OAuth round trip is still required. A changed Quick Tunnel hostname requires updating both URLs.
- Initial metadata backfill: changed work from 90 days plus all open Issues/PRs. Durable page checkpoints and installation/job leases survive restart. Incremental reconciliation uses a five-minute overlap; the scheduler runs every five minutes with a daily backfill sweep.
- Repository refresh uses numeric repository ID and conditional ETag requests, preserving rename/transfer identity. Raw GitHub responses stay in memory. No source, diff, body, review text or CI log is persisted.
- PR reconciliation reads current state, review submissions, ready/draft/reopen timeline, current closing Issue relationships, checks and statuses. CI is selected for the current head SHA. Missing evidence is unavailable. Elapsed review/merge metrics retain calculation versions and nullable values.
- Signed webhook metadata is durable before ACK. Removal/suspend/revocation blocks scope at acceptance. Unsupported events receive a durable disposition. Old CI observations cannot replace newer results; equal-second contradictory PR state is unconfirmed and schedules canonical reconciliation.
- Failed-delivery discovery reads summaries only. A retry intent commits before POST; accepted local delivery/disposition, rather than a successful redelivery request, is the ACK. Pending requests can drain between five-minute discovery passes, bounded by 20 requests/10 seconds per tick.
- Per-member project mappings prevent matching by project label across users. Suggestions require repository/branch/commit/head-repository evidence and are owner-confirmed; previously confirmed/rejected candidates are excluded.
- Receipt allocation records identities, not copied cost. Allocation and link changes serialize by user; a usage identity is allocated once across organizations. Canonical revision/pricing is read at receipt time. Ambiguous links remain unallocated and unknown prices remain unavailable.
- Session-context core/sidecar reads only local Git metadata, strips remote credentials, rejects historical inference from today's branch, hashes canonical session identity, and enqueues before HTTP. Queue leases/retry/dead letter are separate from personal heartbeats.
- UI: OAuth callback, verified account, installation/repository selection, team scope, personal project mapping, paginated work/CI/review timing, owner confirm/reject, receipts, resync/disconnect and health transitions. Account change stops an in-flight confirmation; failed connection reload hides cached work/receipts.
- Team retention includes context, facts, jobs, OAuth attempts and recovery summaries. Restore reconciliation disables scopes/rollouts/sharing, revokes restored credentials, consumes restored OAuth states and pauses jobs pending reauthorization. Personal canonical usage/heartbeat is preserved.

## Reproducible isolated runtime

`deployment/team-github/compose.yaml` uses project `atoaxis-team-github-staging`, separate volumes and loopback PostgreSQL `55442` / ClickHouse `58133`. API is `8410`, UI `3410`, allowlisted reverse proxy `3411`. The personal runtime and its configuration are not used.

```sh
python3 scripts/team-github-staging.py infra-up
python3 scripts/team-github-staging.py start --origin https://CURRENT.trycloudflare.com
python3 scripts/team-github-staging.py status
python3 scripts/team-github-staging.py stop
python3 scripts/team-github-staging.py infra-stop
```

Start waits for receiver readiness before starting workers. UI builds run from a clean copy without personal `.env`. Stop only signals recorded process groups whose cwd proves they belong to this staging directory; volumes, inboxes and queues remain. Unregistered occupied ports are refused. The Quick Tunnel runs separately with `python3 scripts/team-github-staging.py tunnel`; its hostname must be inspected after each restart.

Prepare the manifest with `manifest --origin https://CURRENT.trycloudflare.com`. The App is intended for `Jitwisut`, with read-only Metadata, Pull requests, Issues, Checks and Commit statuses, and selected private test repositories. Do not add Contents/write permissions to the analytics App. A separate fixture writer owns test mutations.

The operator's private App configuration in ignored `output/team-github-staging/github-app.json` contains only:

- `ATOAXIS_GITHUB_APP_ID`, `ATOAXIS_GITHUB_CLIENT_ID`, `ATOAXIS_GITHUB_APP_SLUG`
- `ATOAXIS_GITHUB_PUBLIC_URL`, `ATOAXIS_GITHUB_CREDENTIALS_PATH`

`team-github-vault APP_ID NEW_ENVELOPE_PATH` imports a private JSON bundle from stdin under the configured vault key. Fields are `private_key`, `client_secret`, `webhook_secret`; it writes only ciphertext with restrictive permissions and refuses overwriting an existing envelope. Never enter secrets in shell arguments, repository files, chat, diagnostics or browser responses. Key rotation imports a new envelope, verifies it, then updates the path. Preserve the previous valid envelope until verification completes.

`preflight --origin https://CURRENT.trycloudflare.com` requires a fresh `app-url-evidence.json` with `checked_at`, `callback_url`, `webhook_url` matching inspected settings. This evidence is not a substitute for server-side live App verification or the actual OAuth flow.

The public proxy blocks health, metrics, repair, launch-readiness and personal diagnostics endpoints; databases bind to loopback. Session authentication and webhook signatures remain required. Current checks show those blocked routes return 404. Recheck after proxy changes.

Private fixture repository: `Jitwisut/atoaxis-team-github-fixture`; Issue #1 and PR #2 use `fixture-base` / `fixture/open-pr`. The fixture writer refuses other repositories and public repositories. This is test data, not a code PR for AtoAxis.

## Local evidence

See ignored `output/team-github-staging/latest.json` and `output/team-github-restore/latest.json` for observed timestamps/build scope. Latest verified checks:

- Server library: 409 passed, 35 environment-dependent tests ignored.
- Core library: 367 passed; offline delivery: 12 passed, including the existing backlog regression.
- Explicit isolated PostgreSQL tests: GitHub installation/OAuth/lease/context/revocation/CI/pagination, consent/allocation/webhook durability, and weekly privacy/retention/restore guard.
- Frontend: 35 tests passed for callback/account switch, panel confirmation race/cached data closure, Team insights/Trust, organization teams and invitations; typecheck and selected source-file lint passed. Test files follow the repository lint exclusion and are checked by typecheck/Vitest.
- PostgreSQL logical + ClickHouse native restore from a backup predating withdrawal: latest independent privacy ledger blocks old consent, restored GitHub/context facts are cleaned, sharing stays disabled, personal canonical usage is preserved. This certifies only the local fixture drill.

## Remaining work and gates

No claim of “GitHub integration passed local staging certification” is permitted yet.

1. **Live App/OAuth/install gate:** App creation is blocked by GitHub Confirm access; the Mac is currently locked. The owner must unlock it and complete passkey/2FA themselves. Creating/installing security-sensitive access in the browser also requires confirmation at the actual grant step. No password/code is requested in chat.
2. **Code still to finish:** native session-context adapters/hook wiring for all four tools; complete relationship history/reference projection and receipt link history/edit/withdraw flow; merged-PR cost aggregate definition/coverage and fully shared paginated report/export projection; additional provider fault/refresh race/redelivery and privacy/retention tests. Current closing relationships are observed snapshots, not recovered historical relationships. The sidecar alone does not certify automatic provider capture.
3. **GitHub live ledger:** complete 90-day/open backfill, rename/transfer/fork/reused-branch/draft/reopen/force-push/dismissal/CI rerun/uninstall/reconnect tests, actual missing-delivery recovery, 100-event recovery latency and staging fault tests remain unverified. Unit fixtures do not substitute for GitHub behavior.
4. **Second user:** owner reports no second GitHub tester is available. Actual other-user review and cross-user permission tests remain pending; do not fabricate another account or count the owner's review as independent review.
5. **Client matrix:** 80 actual user sessions (10/tool/OS), independent inline ledgers, real versions/architecture and the same clean build SHA. Windows runs on the owner's PC and is pending returned metadata. Unsupported provider fields stay unavailable; any reduction of agreed functionality requires owner review.
6. **Security/evidence:** live token refresh/expiry/concurrency, fault/recovery and marked outbound/storage/log scans, full new-table retention inventory verification and actual staged restore with App credentials require additional evidence. Cloud restore, Stripe, Team production and heartbeat canary retain their own separate gates.

Use `tests/team-github/certification-manifest.json`, `scripts/team-github-certification.py` and `deployment/team-github/windows/collect-build-evidence.ps1`. Intake rejects duplicate sessions, mixed builds, monitor activity, missing timezone or unfinished/future sessions. Even a complete intake matrix remains pending independent review.

## Recovery / rollback

- Network/5xx: retain accepted inbox/context and retry. Rate limit: honor `Retry-After`/reset. Auth/permission: keep jobs paused until verified reconnect/resync. Private-repository 404 is access unconfirmed, not proof of deletion.
- If URL changes: stop connection attempts, update inspected App URLs/configuration, rebuild UI for the new public origin, restart the receiver/worker and run preflight/live verification.
- After restore: apply the latest independent deletion/revocation ledger before opening Team reads; missing/stale ledger fails closed. Explicitly reauthorize GitHub and reconcile; restored credentials are not reused.
- Rollback disables the organization feature and stops creation of new jobs/producers. Keep accepted inbox/context, queue IDs, consent/deletion ledger and additive migrations. Never reset by deleting a backlog or changing duration/timeout to match WakaTime.
