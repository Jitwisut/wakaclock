# Non-Stripe staging configuration — 1 November 2026

Development increment on `codex/team-closure-wip`, delivered base `1646cbf6`;
uncommitted. Python syntax/static checks only. No service, Docker, database,
migration, provider request or trial was started. Stripe remains deferred.

## Gap closed

The isolated staging launcher intentionally removes inherited `ATOAXIS_*`
settings. Previously it had only GitHub App configuration, so it could not opt
into the new organization/no-card trial/admission paths without editing its
source. It now reads optional staging-local metadata from
`output/team-github-staging/team-features.json`.

Schema1 accepts only `schema_version`, `features` and optional `enrollment_guard`.
Every feature is a JSON boolean and defaults to false:

| Feature key | Existing product setting |
|---|---|
| organization_onboarding | ATOAXIS_TEAM_ORGANIZATION_ONBOARDING_ENABLED |
| self_service_trial | ATOAXIS_TEAM_SELF_SERVICE_TRIAL_ENABLED |
| usage_admission_worker | ATOAXIS_TEAM_USAGE_ADMISSION_WORKER_ENABLED |
| workflow_reports | ATOAXIS_TEAM_WORKFLOW_ENABLED |
| copilot_daily | ATOAXIS_COPILOT_DAILY_ENABLED |
| copilot_weekly | ATOAXIS_COPILOT_WEEKLY_ENABLED |

Weekly Copilot requires daily. Onboarding, trial, usage admission and daily
Copilot require an explicitly configured, already existing independent enrollment
journal. `enrollment_guard` has exactly `path` and `namespace`: an absolute
symlink-free regular single-link file inside this staging directory and a
canonical nonnil UUID. Unix journal and immediate-parent permissions must be
private, matching the existing runtime requirement; the tool never chmods them.
Paths cannot alias the privacy ledger, staging credentials/configuration or
process state. Unknown keys, duplicate keys, string flags and unknown schemas
fail closed. No Stripe option or credential field is accepted.

The file supplies the existing financial-guard path/namespace/required settings
because these protect enrollment independently of Stripe. The loader does not
interpret a journal as valid merely because it exists: runtime Rust checks its
namespace/checksum/history. No journal or baseline is initialized automatically.
An existing or restored database is never grounds to initialize a replacement
ledger. Keep independent evidence separate from database backups.

## Operator interface

`python3 scripts/team-github-staging.py preflight-team` reads only that metadata
and filesystem attributes. It does not generate `environment.json`, create a
directory, build, launch a subprocess or contact anything. Output includes flags,
`present_unverified`/`not_configured`, `ledger_contents_verified=false` and
`runtime_checked=false`; it omits paths, namespace and credentials. This is a
configuration check, never a restore/readiness/consent certification.

At the later verification phase, the operator must explicitly prepare a reviewed
staging-only independent guard with the existing `team-financial-guard` tool,
then supply this metadata. Existing organizations require reviewed original
evidence; do not classify them legacy merely to get a green preflight. The
privacy ledger has its own existing explicit initialization/restore procedure.
Restart receiver before its workers/UI after configuration changes.

`stop` and `status` no longer generate credentials or depend on a valid feature
or App file. `infra-stop` also bypasses broken configuration, uses placeholders
only for Compose's required-variable parsing and issues `compose stop`, never
`down -v`. It retains the isolated volumes and does not authenticate with the
placeholder values. Runtime process ownership checks remain in force.

## Evidence and deferred tests

AST syntax passed for `team_staging_configuration.py`, `team-github-staging.py`
and `test-team-staging-configuration.py`; `git diff --check` passed. Regression
source was written but not executed. No new build cache was created.

When the owner starts verification, run
`python3 -B scripts/test-team-staging-configuration.py`. Expect absent config to
stay default-off without filesystem mutation; guarded features to require a
private isolated journal; malformed/unknown/duplicate metadata and symlinks to
fail; and stop/status/infra-stop to remain available without credentials.
Mocks/temporary metadata do not certify actual native lifecycle or restore.
Then verify configured receiver/worker feature agreement in isolated staging
and actual retention/restore without exposing credentials.

## Remaining development found by source audit

Follow-up: the operator setter described below is now connected in
[pilot control](atoaxis-team-pilot-control-2026-11-01.md), with explicit review,
generation/privacy fences and staged wrapper commands. Its behavioral/SQL/restore
verification has not run; the description below preserves the original finding.

The existing organization membership trigger creates a disabled `team_rollouts`
row, and `team_trial::require_rollout` requires that row enabled. There is no
production operator setter in the current source; test fixtures update it
directly. A controlled explicit organization rollout/timezone/review path is
still required to finish onboarding without hand-editing SQL. This file does not
enable organization rollout, start trial, grant sharing or remove that code gap.

Birth/confirmation lifecycle review found minimal proof in migrations062/063
separate from generic `audit_logs` cleanup. Read/mint/trial boundaries verify that
proof and reject missing restored evidence. This is a source review only;
12-month retention and actual backup/restore behavior remain untested for the
current increment. Supported backup-horizon erasure policy remains a launch gate.
