# F5 closeout report — 2026-09-07

This report records the F5 implementation and the live evidence available on
the current macOS machine. It is deliberately a closeout of the engineering
work and a release-gate audit, not a fabricated claim that every agent is
verified. The execution plan requires a real authenticated run, shipped-bundle
identity, broker/API/dashboard readback and human review before an adapter or
milestone can be marked complete.

## Terminal status

**F5: `in_progress` / environment-blocked.** The local implementation,
parsers, producer paths, dedup regression and survey records are complete for
the surfaces that can be inspected here. The phase cannot be promoted to
`complete` while the mandatory live gates below are unavailable:

- Claude Code is installed but its OAuth session is logged out.
- Gemini CLI is installed but has no authenticated account or captured real
  edit payload.
- Kilo has a local plugin and regression suite, but no authenticated live
  callback/provider run has been certified.
- Codex CLI has a fresh authenticated source/producer campaign and a separate
  delivered retry probe. The driver still cannot mark API delivery or
  canonical/dashboard stages without its explicit readback probes.
- The current worktree contains unrelated uncommitted changes, so no clean
  release commit digest can be attached to a certificate yet.

No catalog entry was promoted and no historical certificate was reused for a
different runtime tuple.

## F5-01 through F5-18 matrix

The status names below are terminal outcomes for this environment: `validated`
means the local deliverable and its relevant tests passed; `live-pending` means
the producer path has evidence but the release gates remain open;
`survey-blocked` means the runtime or authentication surface is unavailable;
`unsupported` means no supported integration surface was found; `parked` is an
explicit roadmap decision.

| ID | Runtime / deliverable | Status | Evidence and remaining gate |
| --- | --- | --- | --- |
| F5-01 | Claude Code CLI refresh | `survey-blocked` | Parser replay and hook wiring are locally validated for `2.1.246`; `claude auth status` is logged out. A fresh native hook → transcript → broker → API → dashboard run is still required. |
| F5-02 | Codex CLI current tuple | `live-pending` | Authenticated `codex-cli 0.153.4` campaign using the shipped release binary captured 8 producer events. Single-file, multi-file, create/delete/rename and failure/no-op passed; a separate delivered retry/dedup run passed with broker accepted=1 and replayed=1. Nested execution remains not run. Driver API/canonical/dashboard stages remain not run until explicit probes are configured. |
| F5-03 | Gemini CLI | `survey-blocked` | `gemini 0.58.0` is installed and advertises JSON/stream-JSON, session-file and hooks. No authenticated account, extension or real edit payload is available; no synthetic fixture was added. |
| F5-04 | Codex Desktop / IDE | `survey-blocked` | Desktop is installed, but the current evidence does not expose a separate runtime identity/readback tuple. CLI evidence is not borrowed. |
| F5-05 | Kilo CLI (`kilo`/`kilocode`) | `live-pending` | Kilo `7.5.13` plugin scaffolding and metadata normalization are locally tested. Exact duplicate callbacks now use a bounded 120-second identity window and a delayed-callback regression passes. Live provider/model callback evidence is still required. |
| F5-06 | Kilo VS Code | `survey-blocked` | No separate Kilo VS Code extension-host run or callback certificate is available. |
| F5-07 | Cursor Agent | `survey-blocked` | Cursor is not installed on the inspection machine; no real hook payload or session pairing was captured. |
| F5-08 | Cursor Tab | `survey-blocked` | Depends on the unavailable Cursor runtime; Tab acceptance/partial/reject behavior has not been inferred from Agent evidence. |
| F5-09 | Cline | `survey-blocked` | No Cline executable/extension or real storage/event surface is available. |
| F5-10 | Roo Code | `survey-blocked` | No Roo runtime or checkpoint/restore evidence is available. |
| F5-11 | Continue | `survey-blocked` | No Continue runtime was exercised; inline and agent modes remain separate. |
| F5-12 | OpenCode | `survey-blocked` | No OpenCode runtime/plugin payload was available for a real survey. |
| F5-13 | Goose | `survey-blocked` | No Goose runtime or session/tool evidence was available. |
| F5-14 | Copilot CLI | `survey-blocked` | Copilot CLI is not installed; IDE storage presence is not CLI evidence. |
| F5-15 | Copilot IDE / inline | `survey-blocked` | A Copilot Chat storage footprint exists, but no accepted/rejected/partial file-edit callback was captured. |
| F5-16 | Windsurf / Antigravity | `survey-blocked` | Neither runtime is installed or available for an official/current integration survey. |
| F5-17 | Kimi Code CLI / standalone Deep Code | `parked` | Kept parked by the roadmap until a real hook/API/transcript surface and test environment exist; provider identity alone is not client evidence. |
| F5-18 | Generic MCP/custom producer ingress | `validated` (local) | `wakaclock ai emit` and shell/MCP before/after ingress share the broker contract and privacy allowlist; Rust/CLI regression tests pass. A specific external MCP producer still needs one live file-tool example. |

## Codex campaign evidence

The live campaign was run with the existing authenticated Codex account in a
disposable repository. Only aggregate counters were retained:

```text
codex-cli: 0.153.4
scenarios: single-file=passed, multi-file=passed,
           create-delete-rename=passed, failure-no-op=passed,
           retry-dedup=not_run, nested-execution=not_run
stages: source_capture=passed, producer_event=passed,
        broker_accept=not_run, api_delivery=not_run,
        canonical_reconcile=not_run, dashboard_readback=not_run
metrics: captured=8, producer_events=8, broker_accepted=0,
         delivered=0, duplicates=0, replayed=0
blockers: delivery_not_requested, canonical_readback_not_configured,
          dashboard_readback_not_configured
```

The separate delivered retry probe returned the following bounded result:

```text
scenario: retry-dedup=passed
stages: source_capture=passed, producer_event=passed, broker_accept=passed,
        api_delivery=not_run, canonical_reconcile=not_run,
        dashboard_readback=not_run
metrics: captured=1, producer_events=1, broker_accepted=1,
         duplicates=0, replayed=1
```

As a local readback audit, `GET /api/v1/heartbeats` returned 200 and showed 8
unique Codex transcript rows in the campaign window, all with verified actor
projection. `GET /api/v1/dashboard/analytics` returned 200 with schema 3. The
driver still leaves those stages `not_run` because there is no event-bound,
privacy-safe readback probe wired into the certification command; the dashboard
response also covers the full day rather than only the campaign rows.

The campaign driver performs the second sync for retry proof and requires
`already delivered >= parsed` with `new=0`. It never treats a local broker
acknowledgement as API delivery, and it never promotes a local parser pass to
canonical or dashboard visibility.

## Local implementation gates

The following F5-focused checks passed on 2026-09-07:

- `python3 -m unittest discover -s scripts/ai-coverage/tests -p 'test_*.py'` — 16/16.
- `python3 -m py_compile scripts/ai-coverage/run_codex_cli_campaign.py` — passed.
- `npm test --prefix extensions/ai-agents/kilo-code` — 12/12.
- `npm run test:installer --prefix extensions/ai-agents/kilo-code` — passed.
- `python3 scripts/ai-coverage/validate_catalog.py certifications/ai-adapters/catalog-v1.json` — passed.
- `cargo build --release -p wakaclock` — passed for the local shipped bundle;
  the worktree was dirty, so the build is not a clean release certificate.

These checks prove the code paths and metadata boundaries. They do not replace
the live source → broker → API → canonical → dashboard chain.

## Closure actions

To move F5 from `in_progress` to `complete`, run the following in an isolated
environment and attach a pending artifact before human review:

1. Authenticate Claude, Gemini and Kilo where their current runtime surfaces
   are available; capture only bounded tool/session/path/result metadata.
2. Run Codex again with `--deliver`, a configured API key and the explicit
   canonical/dashboard readback probes. Include the retry/dedup probe and repeat
   after a broker restart.
3. Record the clean shipped commit SHA and release-binary SHA-256 in the pending
   artifact; validate it with `validate_certification.py`.
4. Inspect backend canonical rows and dashboard data using the same event IDs,
   then obtain human approval before changing any reviewed catalog entry.
5. Keep unavailable runtimes as explicit `survey-blocked` or `parked` rows; do
   not claim “all AI” from process presence, executable names or historical
   certificates.
