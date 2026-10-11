# AtoAxis Team GitHub — implementation and staging runbook

Status: **implementation in progress; not certified**. Work stays on `codex/atoaxis-team`, continued from `579967b`. Do not push or merge `main` without specific authorization. The local test evidence was collected before the source commit; live certification must record the committed build SHA and does not follow automatically from publishing source.

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

1. **Live App/OAuth/install gate:** The owner reports they are not ready for passkey/2FA or Windows testing; continue local implementation. Actual App creation/authorization is pending. The owner completes authentication themselves; no password/code is requested in chat.
2. **Remaining implementation evidence:** versioned native payload/canonical session proof for Cursor/Copilot must be verified before enabling automatic attribution. Copilot daily-only metrics cannot produce per-session token/cost allocation. Live permission/fault/redelivery coverage and the remaining acceptance matrix need actual provider/GitHub observations. Current closing relationships remain observed snapshots; reference events retain their actual GitHub timestamp. The local sidecar/hooks alone do not certify provider capture.
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


## Closure implementation (10 October 2026, uncommitted candidate)

Migration `033_team_github_closure.sql` is additive. Deploy the receiver and migrate before the webhook/context worker, client or UI. `main` is unchanged.

- Context is accepted into a durable pending inbox before canonical usage is available. The verifier has row leases, bounded query time, bounded retries and a recoverable dead letter; it checks collector/project evidence and rechecks consent, membership, mapping and repository access before publishing suggestions. A duplicate received after verification preserves the existing disposition.
- Shared live native metadata capture uses the existing collector-scoped usage identity. `ATOAXIS_TEAM_CONTEXT_CONFIG` explicitly opts the CLI hook paths into capture; account, origin and collector must match. Context observation and its change cursor commit together in SQLite; unchanged context and stale observations do not generate additional records. Historical transcript scans never read current Git state.
- `team-session-context --config PRIVATE_CONFIG --provider codex|claude-code|cursor` is a native stdin adapter for staging hook wiring on both OSes. It discards prompt/source/edit/response fields locally. Cursor `afterTabFileEdit` retains inline provenance. Missing identity (including Copilot daily data) returns unresolved, never a fabricated session. The adapter still requires real versioned payload and canonical-session evidence before certification. `--status` reports local queue metadata without requesting a credential and always leaves capture completeness unconfirmed.
- Session/work selection, link history and receipt detail are paginated. Candidates include closed/merged PRs only during the observed PR lifecycle. An owner can explicitly select a PR when candidates are unresolved; revision-checked replacement withdraws the old link, confirms the new one and invalidates allocations in one transaction. Unmounted/account-switched UI cannot complete a stale multi-request confirmation.
- Weekly merged-PR cost uses canonical revised usage, unique confirmed allocation, consent/retention boundaries and event time at or before merge. Post-merge usage is excluded. Unknown prices remain unknown. Weekly and cumulative cost equations share the publication registry and contributor partition checks. Average cost and complete-PR denominator are unavailable while capture completeness is unconfirmed; completeness of received facts is insufficient evidence.
- Receipt totals cover the full authorized projection, with paginated details; the member endpoint includes only that member's shared usage. UI/API/CSV use the same projection and final generation checks. CSV includes metric status, coverage, freshness and calculation/pricing version.
- PR–Issue history distinguishes native reference-event source time from observed closing-relation snapshots. Pagination restarts when the relation source changes; no historical start time is invented. A removed related repository closes history reads immediately.
- Context cleanup records identity/hash dispositions in the independent privacy registry before deletion. Restore blocks context verification and requires reauthorization; relationship history joins the Team-only retention inventory. Personal canonical heartbeat/usage is preserved.

### New retention inventory

| Data | Read cutoff / cleanup | Restore / replay behavior |
|---|---|---|
| Session context and verification lease/retry | 12 calendar months; individual consent, developer membership, repository mapping/scope | Context ID/hash disposition survives cleanup; restored contexts blocked pending reauthorization |
| Link revision/history and allocations | Existing Team link/usage allocation cleanup and consent projection; history 12 months | Restore applies current revocation/deletion registry before reads; canonical personal cost facts unchanged |
| Relation history | Source timestamp when known, otherwise observation timestamp, within 12 months; both repository scopes enforced | Removed scopes block reads; restore scope reauthorization and Team cleanup apply |
| Local context observation cursor/queue | Local metadata scoped by origin/account/organization; durable acceptance before ACK | Retry preserves ID; no historical branch reconstruction or heartbeat creation |

Two delivery levels remain separate: local code/fixtures can pass before real GitHub staging certification. External prerequisites and the full client matrix remain pending. A clean committed candidate and identical manifest SHA across macOS/Windows are required before actual certification.

### Cross-week publication protection

Migration `034_team_publication_membership.sql` stores hashes of fact identities with each published view, and includes that membership in the independent privacy-ledger mark. Cross-week views may reuse only an identical equation or disjoint fact sets. Partial overlaps are withheld even if both reports contain five contributors; old publication rows without membership proof are treated conservatively. Invalidated/expired publications remain barriers because downloaded numbers cannot be recalled. This intentionally withholds some cumulative reports until a more precise joint partition proof exists.

### Native capture staging wiring

Keep the context configuration outside version control, with the existing account/origin, organization, member-owned project, selected repository, canonical collector and local queue path. Set `ATOAXIS_TEAM_CONTEXT_CONFIG` for the existing CLI hook process to opt in. The existing Codex/Claude live CLI paths observe context before producer acknowledgement; the sidecar drains the same queue independently every 15 seconds.

For a native hook whose actual payload/version has been inspected, invoke the built sidecar with stdin inherited from the provider:

```sh
team-session-context --config /private/path/context.json --provider cursor
team-session-context --config /private/path/context.json --status
team-session-context --config /private/path/context.json
```

On Windows use the same executable/arguments with a quoted private configuration path and set the environment variable in the provider process. Do not persist stdin to an intermediate file or append it to diagnostics. Do not replace the provider's existing hook configuration without inspecting its versioned schema and preserving existing hooks. Provider certification remains pending until the native hook identity matches a canonical session from that provider. Cursor's metadata adapter alone does not supply a missing canonical usage producer; Copilot daily metrics remain daily and cannot verify a session. Missing proof returns unresolved or recoverable verification pending, and cannot become PR cost.

The fixture restore script now runs source and restore instances sequentially, with at most two drill containers running at once. It closes all its synthetic tmpfs instances afterwards; persistent application volumes are untouched.

### Latest local validation — 10 October 2026

The uncommitted candidate on `codex/atoaxis-team` passes 417 server tests (35 environment tests remain ignored), 370 core tests, the independent attribution fixture, all 12 offline-delivery tests including the 1,191-record backlog, and the duration golden with zero error on unchanged input. Three explicit isolated PostgreSQL tests and the sequential PostgreSQL/ClickHouse restore drill pass. Frontend: 27 relevant tests, typecheck and selected source lint pass. Certification intake: four tests pass. Evidence: `output/team-github-closure/latest.json` and `output/team-github-restore/latest.json`.

Strict Clippy is still blocked by pre-existing argument-count, cloned-reference, placeholder-name and test-module-placement lints outside this change. An additional all-target check with those four explicit baseline allowances passes; it does not certify the strict gate. GitHub live certification, native provider/OS evidence and a clean candidate remain pending. This is a local implementation/test result, not full staging certification.

### Context/health update — 12 October 2026

The implementation on `codex/heartbeat-capture-release` is documented in [Context/Health closure](context-health-closure-2026-10-12.md); its delivery commit is the one containing that report. Strict all-target Clippy now passes without allowances; this supersedes the older lint status above, not the external certification gates.

- Shared Python/TypeScript producers freeze Git coordinates and optional verified routing binding **before** the CLI identity handshake. Their metadata-only context side stream uses the existing durable producer spool/inbox and idle collector. Replay never reads today's Git. Missing historical routing proof remains unresolved even if configuration is added later.
- Deploy additive migration `035_team_session_repository_bindings.sql` and the receiver before clients. Owner endpoints `/api/v2/organizations/:id/me/github/session-repository-bindings` provide revision-checked, idempotent confirmation/withdrawal and paginated history. Individual consent, verified repository/team scope, retention and generation checks apply. Confirmation is `user_confirmed` from server effective time, not native context or automatic PR/cost attribution.
- Team retention includes `team_session_repository_bindings` and its history. Request dispositions are recorded in the independent privacy ledger **before** parent deletion; more than one cleanup batch cannot bypass child dispositions. Restore blocks recovered bindings and requires current scope/consent revalidation. Canonical personal facts remain untouched.
- Local `activity_source_health`, broker context observations/checkpoints, producer spool and context ingress receipts store scoped metadata. Parser health/cursor/inbox commit together; persistent parser failures cannot be hidden by another source succeeding. Ingress receipts commit before queue removal; durable ingress is distinct from unconfirmed canonical readback.
- Optional capture pipeline stages are capability-negotiated. Missing details remain unconfirmed; stale, backlog, auth and dead letter use the same assessment in VS Code and dashboard. Team retains the existing consent/suppression projection rather than exposing small-group diagnostics.

Two isolated native PostgreSQL integration tests pass, including 205 retention-history dispositions and the restored-binding read barrier. The disposable database is stopped. No actual GitHub/provider/Windows deployment or Cloud restore is certified by these fixtures.
