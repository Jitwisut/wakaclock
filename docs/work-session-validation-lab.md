# Work Session Receipt local validation

This lab is experimental. Synthetic integration checks and controlled native campaigns
do not count toward the seven calendar days or ten daily-work sessions per agent.
No public endpoint or certification promotion is added by these tools.

## Isolation and build

Run from the repository root:

```sh
python3 scripts/work-sessions/local_lab.py init
python3 scripts/work-sessions/local_lab.py up
python3 scripts/work-sessions/local_lab.py build
python3 scripts/work-sessions/local_lab.py runtime
python3 scripts/work-sessions/local_lab.py api
# Another terminal:
python3 scripts/work-sessions/local_lab.py bootstrap
python3 scripts/work-sessions/local_lab.py ui
# Two more terminals (same manifest):
python3 scripts/work-sessions/local_lab.py worker
python3 scripts/work-sessions/local_lab.py relay
python3 scripts/work-sessions/local_lab.py readiness
```

The UI is `http://127.0.0.1:13000`; API is `http://127.0.0.1:18080`.
PostgreSQL uses port 55439 and ClickHouse uses 58129. RabbitMQ is 55679,
local S3 storage is 59000, deletion health is 18082 and relay health is 18083.
All bindings are loopback-only. Compose project
`atoaxis-receipt-validation` owns separate persistent volumes. `stop` retains them.
The flag is enabled only in this lab. The production frontend has a separate
`build/receipt-validation` output and a loopback API CSP allowance.

`.local/receipt-validation/` is ignored and contains private credentials, separate
campaign/daily accounts and profiles, collector queues, transcripts, fixtures and
metadata evidence. Do not publish that directory or agent output. JSON credentials
are mode 0600 beneath a mode 0700 root. Account passwords are generated locally;
use the daily account for daily work, not the campaign account.

Build manifest binds the Git commit, tracked/modified/non-ignored new source,
collector/server/deletion-worker/job-worker binaries, frontend tree and build ID. Deleted tracked files affect
the source hash. Generated `next-env.d.ts` is explicitly excluded. A source change
during compilation fails manifest creation; rerun after concurrent editing finishes.
Restart all four lab services after rebuilding. Owned supervisors record artifact,
manifest, PID and process-start identity; campaign preflight rejects stale processes,
modified source/artifacts, failed health checks and disabled receipts. `stop` terminates
owned process groups (including Next children) and stops Compose without removing volumes.
A previous running process does not acquire
the new binary automatically. Keep runtime.json alongside the build manifest.

## Native login and controlled campaign

```sh
python3 scripts/work-sessions/local_lab.py login --tool codex
python3 scripts/work-sessions/local_lab.py login --tool claude-code
python3 scripts/work-sessions/local_lab.py auth-status --tool codex
python3 scripts/work-sessions/local_lab.py auth-status --tool claude-code
python3 scripts/ai-coverage/run_codex_cli_campaign.py --execute \
  --receipt-output .local/receipt-validation/evidence/codex-campaign.json
python3 scripts/ai-coverage/run_claude_cli_campaign.py --execute \
  --output .local/receipt-validation/evidence/claude-campaign.json
```

Without `--execute` no model is called. Each selected scenario invokes the native
agent once with a timeout and no automatic model retry. Claude has a $1 per-scenario
budget cap. Use `receipt_campaign.py --agent codex --scenario single-file --execute
--output <path>` for an initial smoke case; this alone cannot open the observation
window. Codex receipt mode uses the lab profiles regardless of legacy certification
driver profile options. Existing certification artifacts retain their semantics.

Before each call the campaign records independent intended fixture changes. It then
checks actual fixture contents, imports the exact session transcript through the
collector, reads delivered SQLite usage, queries owner/scoped ClickHouse facts,
reads the receipt and all evidence pages, and replays delivery without another model
call. Reports contain opaque references, counts, coverage, revisions and mismatch
codes. Prompts, code, absolute paths and authentication values are excluded.

This validates transcript capture, queue and ingest. It does not by itself establish
VS Code attendance capture, human authorship, missing execution intervals, or hook
coverage. Record those limits in runtime evidence. All campaign results stay
`review_status=pending`, `promotable=false` until independently reviewed.

## Repeatable checks

```sh
python3 -m unittest discover -s scripts/work-sessions/tests -v
python3 -m unittest discover -s scripts/ai-coverage/tests -p 'test*.py'
python3 scripts/work-sessions/run_database_checks.py
python3 scripts/work-sessions/check_account_deletion.py
python3 scripts/work-sessions/check_flag_rollback.py
python3 scripts/work-sessions/check_repair.py
python3 scripts/work-sessions/run_browser_checks.py
node scripts/work-sessions/check_native_browser.cjs codex-campaign-final.json
```

The browser test uses production UI and actual local API/DBs without route mocks.
It checks usage-only/null/zero, duplicate delivery, owner isolation, outcome withdrawal,
export, and 26 evidence records across two pages on desktop/mobile. The Python wrapper
requires the current process/build binding and rejects skipped or zero-test runs.
The native browser checker additionally requires a current-build native campaign.
Browser traces/video are disabled so authorization headers are not saved.
The flag test starts its own temporary server on ports 18081/19091, verifies continued
telemetry while receipts and outcome writes return 503, then restarts with receipts
enabled and checks persistence. It does not stop the main lab or developer server.

Also run the ignored Rust test
`receipt_live_databases_isolate_sessions_replay_revisions_and_outcomes` with explicit
`CLICKHOUSE_TEST_URL`, `CLICKHOUSE_TEST_USER`, `CLICKHOUSE_TEST_PASSWORD`,
`POSTGRES_TEST_URL` from the lab config and `--ignored --test-threads=1`.
The database runner supplies isolated credentials without printing them. It checks
Thai midnight, UTC and both DST transitions, nullable identity, scoped receipt
replay/revision/overlap and 10,000/10,001 fact and operation limits. Its deletion
assertion covers PostgreSQL cascade. The separate deletion checker creates a disposable
account, usage and outcome history, seeds a local S3 export, requests deletion through
the API, waits for the real worker, verifies all stores and rejects delayed API replay.
It does not establish delayed Kafka replay coverage.

Run frontend typecheck, lint, coverage and production build and retain failures.
Do not lower thresholds or convert failures to passed checks. Keep evidence for
offline/retry, repair rollback, account deletion pipeline, receipt bounds, runtime
attribution, and time scenarios explicit; one smoke test does not cover all of P5.

## Daily evidence and readiness

The observation window requires both complete five-scenario campaigns for the same
manifest and a reviewed checks JSON with `build_manifest_sha256` plus `checks` entries
`capture_identity`, `retry_revision`, `time_union`, `owner_scope`, `account_deletion`,
`production_browser`, `flag_rollback`, `receipt_limits`, `release_checks`, each with
`status=passed`, `reviewed=true`, an evidence reference and matching SHA-256.
Checks schema 3 requires a `validation_gate` document whose mandatory scenarios are
backed by `validation_run` children. Every child is recursively checked for status,
schema, build and content hash; empty documents, historical schemas, missing scenarios,
and coverage below 100% cannot pass even when marked reviewed. Native campaign artifacts
retain schema 2 and additionally emit a `-evidence.json` wrapper after all five scenarios
pass. The wrapper embeds the original campaign for validation, preserving certification semantics.

Assemble a gate with `evidence_contract.py --gate <name> --run <run-report> [--run ...]`,
then use `checks.py --check <name> --status passed --evidence <gate-report> --reviewed`
after reviewing it. `REQUIRED` in `evidence_contract.py` defines the mandatory scenarios.
A build/schema transition archives the previous checklist and resets all gates.
Mark a check only after inspecting its actual evidence; this file is a
review checklist, not automatically established certification.

```sh
python3 scripts/work-sessions/local_lab.py login --identity daily --tool codex
python3 scripts/work-sessions/local_lab.py login --identity daily --tool claude-code
python3 scripts/work-sessions/observation.py check-ready \
  --codex <codex-report> --claude <claude-report> --checks <reviewed-checks>
# Complete begin --rehearsal → agent → sync → finish for both agents first.
python3 scripts/work-sessions/observation.py start-window \
  --codex <codex-report> --claude <claude-report> --checks <reviewed-checks>
python3 scripts/work-sessions/observation.py begin --agent codex --scenario feature --expected-result file_changes
python3 scripts/work-sessions/local_lab.py agent --identity daily --tool codex
python3 scripts/work-sessions/local_lab.py collector --identity daily sync --agent codex --from-start --json
python3 scripts/work-sessions/observation.py finish \
  --observation <printed-id> --receipt <opaque-receipt-id> --reviewed
python3 scripts/work-sessions/observation.py report
```

Record intended work before starting the agent or viewing analytics. Unknown timings
and the expected result use fixed categories, without free-text notes. `begin --rehearsal`
permits a dry rehearsal before `start-window`; rehearsal never counts as daily work.
Resume uses the same receipt and cannot increase the unique session count. Unknown timings
and token ground truth remain null. Review the receipt manually and pass repeatable
`--mismatch lower_snake_case_code` entries when something differs. Daily account data
is separate from campaign data. A receipt is counted once only, must match the build
and agent, have timely independent ground truth, and be explicitly reviewed. Seven
elapsed days and ten unique sessions per agent are mandatory. Readiness remains a
request for pilot review, never automatic promotion. Build changes require reviewing
which evidence must be collected again; the existing window is not silently reset.

`check-ready` is read-only: it reports gate, process, daily authentication/profile and
rehearsal blockers without creating a window. Begin pins an opaque account reference;
finish rejects changed accounts/builds, a wrong receipt/agent, a repeated finish, or a
session whose first observation predates begin. API ownership checks still apply.

## Isolated editor and runtime scenarios

```sh
python3 scripts/work-sessions/local_lab.py prepare-editor --identity campaign --vsix <built-vsix>
python3 scripts/work-sessions/local_lab.py editor-status --identity campaign
python3 scripts/work-sessions/local_lab.py editor --identity campaign
python3 scripts/work-sessions/runtime_scenarios.py prepare --scenario ai_only --capture-mode live_hook
python3 scripts/work-sessions/runtime_scenarios.py record --run <id> --event capture --source agent_hook --agent codex --native-session <private-native-id>
python3 scripts/work-sessions/runtime_scenarios.py verify --run <id>
```

The VSIX must contain the collector bytes matching the manifest, not just a matching
version string. Only the lab profile, extension directory and destination are configured.
Open the printed fixture workspace in that profile. Prepare creates `fixture.txt` with
`seed` and prints the fixed expected final fixture for the selected scenario. Perform the
intentional action before readback; record capture while the queue still contains it,
then allow delivery and verify. Missing queue evidence remains blocked; transcript import
does not replace live editor/hook capture. Native references stay in private runtime state.

Record human_active/human_idle, agent_start/agent_stop, sleep/wake, offline/online and
restart/resume at their observed boundaries. No free-text notes are accepted. These
markers are independent reference intervals, not generated agent execution time.
Idle checks require a closed inactive gap longer than the existing 15-second editor
lease. Sleep checks require actual captured editor segments and reject activity extending
through the recorded sleep gap. Missing or open intervals remain unavailable. This tool
never puts the computer to sleep or disconnects networking. Arrange physical scenarios
with the operator. The offline scenario also requires a captured retry_count above zero.

Reports distinguish fixed-fixture results, queue/canonical identity, native usage/Receipt
readback, capture mode and independent interval references. Shared reports contain no
raw queue payloads, native IDs, transcripts or filesystem paths. Runtime and rehearsal
runs do not count toward the daily observation sample.

### Release evidence from executed checks

After `local_lab.py build` completes on stable source, it now writes
`production-build-evidence.json` bound to the new manifest. Run the remaining
checks with `python3 scripts/work-sessions/run_release_checks.py`; repeat only
an affected check with `--check typecheck` (or another listed check). Each
attempt writes a separate metadata report and private logs in the ignored lab.
A zero-test run does not pass. Coverage requires all four actual counts to be
complete, including when the displayed percentage rounds to 100. Assemble the
release gate from the build report and successful check reports using
`evidence_contract.py --gate release_checks --run ...`; failed reports cannot
be promoted by review.

The database runner also executes the owner/filter/expiry-bound cursor test;
this remains a deterministic security test, separate from actual database
integration checks. Native browser reports are agent-specific
(`codex-native-browser.json` or `claude-code-native-browser.json`) and read all
operation pages instead of assuming a single revision-zero operation.

For `human_after_ai`, record `agent_stop` before `human_active` and snapshot
capture after the human edit. Missing follow-up capture stays blocked.
Human-only and formatter scenarios reject AI attribution, while unknown
activity stays unknown and does not become asserted human code authorship.
