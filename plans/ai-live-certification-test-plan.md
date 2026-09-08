# Live AI certification test plan

Date: 2026-09-09. Start with Codex CLI; repeat separately for each runtime tuple.

## Objective and completion rule

Prove source_capture → producer_event → broker_accept → api_delivery →
canonical_reconcile → dashboard_readback using a real authenticated edit.
Passing fixtures or receiving HTTP 200 alone does not certify an adapter.
All required scenarios and stages need evidence. Unavailable stages remain
not_run with explicit blockers. A pending artifact is not an approved certificate.

## Execution order

1. Run Python certification regressions and catalog validation. Exercise the
   harness without --execute to check artifact generation and fail-closed behavior.
2. Prepare a disposable backend or dedicated test user/API key. Confirm isolation
   applies to native hooks as well as explicit sync; inspect routing before the
   first edit. Do not use --allow-shared-account. Supply secrets through environment
   or a secret store, never documentation or command arguments.
3. Check Codex version and authenticated login. Pass the actual version to both
   the harness --tool-version and driver --expected-version. Use the driver's
   --codex-home option for the existing authenticated directory; do not overwrite
   the desktop session's CODEX_HOME. Record the actual model/runtime tuple.
4. Build using `cargo build -p wakaclock-cli --release` from backend/api. Record
   full commit SHA and SHA256 of target/release/wakaclock. A dirty tree permits
   development rehearsal but cannot establish a clean release certificate.
5. Implement and regression-test a campaign readback probe before full delivery
   certification. Keep opaque event IDs in temporary private runtime state; retain
   only allowlisted aggregate metadata in the certificate. Bind API rows to those
   IDs, verify one canonical winner per event and correct revisions/attribution.
   Determine whether existing API filters expose sufficient evidence; add a test
   probe or narrowly scoped read-only query if not. Do not invent endpoint support.
6. Capture a dashboard baseline for the isolated user; run --execute for source
   capture, then --execute --deliver for the complete campaign. Even a run without
   --deliver can invoke native hooks, so isolation is required for both runs.
7. Compare API, canonical and dashboard results for the same campaign. Verify
   exact provider/client/model where reported; do not manufacture a missing model.
   If the tuple is uncertified, verify the expected unverified/fail-closed state;
   do not require AI verified before approval or bypass the gate to make a test pass.
8. Restart the isolated broker with queued work, replay the same events, and
   verify no loss, duplicate canonical contribution or added duration.
9. Validate the pending artifact with validate_certification.py. Review evidence,
   clean build identity and privacy, then obtain review before catalog promotion.
   Validate the catalog after any authorized update. Rerun the certified display
   check after promotion rather than assuming the pre-promotion label.

## Scenario acceptance matrix

| Scenario | Required evidence |
| --- | --- |
| Single file | Actual edit captured and matched to the delivered event |
| Multiple files | Every actual affected file accounted for; no missing/extra event |
| Create/delete/rename | File operations match producer semantics and canonical counts |
| No-op | No edit event or attributed line increase |
| Failed mutation | Deliberately unsuccessful operation produces no successful edit credit; separate from no-op |
| Retry/dedup | Replay reports no new events; canonical and dashboard contribution unchanged |
| Broker restart | Pending delivery survives restart without loss or double counting |
| Nested execution | Real parent/child execution identity established; current driver is not sufficient |
| Human control | Manual edit is not credited to the concurrent AI session |
| Concurrent AI | Independent sessions do not steal each other's file attribution |

The existing failure-no-op prompt only asks for no changes; it does not prove
failed mutation handling. Existing positive event-count checks also need actual
file-operation assertions before they can prove every requested scenario.

## Current execution results

- Python certification suite: 30 tests passed on 2026-09-09.
- Catalog validator: passed on 2026-09-09.
- Codex executable and release CLI binary exist; freshness/authentication not yet established.
- Neither WAKACLOCK_CAMPAIGN_API_KEY nor WAKACLOCK_CAMPAIGN_SERVER_URL is set
  in the current process. Live execution awaits a confirmed isolated destination.
- Existing driver still lacks event-bound API/canonical/dashboard probes and a
  genuine nested execution probe.
- Worktree contains existing uncommitted work; release identity remains pending.

## Reproducible local commands

```bash
python3 -m unittest discover -s scripts/ai-coverage/tests -p 'test_*.py'
python3 scripts/ai-coverage/validate_catalog.py certifications/ai-adapters/catalog-v1.json
python3 scripts/ai-coverage/run_live_certification.py \
  --repo . --adapter-id codex --client-id codex --provider-id openai \
  --runtime cli --os darwin --arch arm64 \
  --scenario-id single-file --scenario-id multi-file \
  --scenario-id create-delete-rename --scenario-id failure-no-op \
  --scenario-id retry-dedup --scenario-id nested-execution \
  --driver 'python3 scripts/ai-coverage/run_codex_cli_campaign.py' \
  --output /tmp/wakaclock-live-certification-dry-run-2026-09-09.json
python3 scripts/ai-coverage/validate_certification.py \
  /tmp/wakaclock-live-certification-dry-run-2026-09-09.json
```

This dry run intentionally leaves live stages not_run. For an authenticated run,
add the exact tuple/build arguments and --execute to the driver only after step 2;
add --deliver for delivery testing. Complete step 5 before claiming the full chain.
