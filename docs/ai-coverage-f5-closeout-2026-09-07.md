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
- Codex CLI has a fresh authenticated source → broker → API → canonical →
  dashboard campaign. All six mandatory stages passed for 8 event IDs and the
  delivered retry probe replayed one event with zero new events. The pending
  artifact still has an explicit nested-execution blocker, and human review,
  clean-release identity and catalog promotion remain separate gates.
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
| F5-02 | Codex CLI current tuple | `live-pending` | Authenticated `codex-cli 0.153.4` campaign using the shipped release binary captured, accepted, delivered and reconciled 8 events. API, canonical and dashboard readback all passed; single-file, multi-file, create/delete/rename, failure/no-op and retry/dedup passed. Nested execution remains not run; the pending artifact still needs human review and clean-release/catalog decisions. |
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

The live campaign was run with `codex-cli 0.153.4` in a disposable repository
and a newly created disposable Wakaclock account. Only aggregate counters were
retained:

```text
codex-cli: 0.153.4
scenarios: single-file=passed, multi-file=passed,
           create-delete-rename=passed, failure-no-op=passed,
           retry-dedup=passed, nested-execution=not_run
stages: source_capture=passed, producer_event=passed,
        broker_accept=passed, api_delivery=passed,
        canonical_reconcile=passed, dashboard_readback=passed
metrics: captured=8, producer_events=8, broker_accepted=8,
         delivered=8, canonical=8, duplicates=0, replayed=1
blockers: nested_execution_probe_not_configured
```

The event-bound readback verified 8 unique API rows, 8 canonical winners and
the dashboard AI delta against the canonical line counts. The artifact is
`/tmp/wakaclock-codex-final-certification-20260909.json`; its validator passed,
but it remains `status=scaffold`, `review_status=pending` and
`promotable=false`. The retry check is a second CLI process invocation that
re-opened the local broker store; it is not a managed-service restart.

The campaign driver performs the second sync for retry proof and requires
`already delivered >= parsed` with `new=0`. It never treats a local broker
acknowledgement as API delivery, and it never promotes a local parser pass to
canonical or dashboard visibility without the event-bound readback.

## Local implementation gates

The following F5-focused checks passed or were re-run on 2026-09-09:

- `python3 -m unittest discover -s scripts/ai-coverage/tests -p 'test_*.py'` — 32/32.
- `python3 -m py_compile scripts/ai-coverage/run_codex_cli_campaign.py` — passed.
- `python3 scripts/ai-coverage/validate_certification.py /tmp/wakaclock-codex-final-certification-20260909.json` — passed.
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
2. Add a privacy-safe nested-execution probe if Codex exposes a stable
   parent/child identity; until then keep that scenario `not_run`.
3. Repeat the retry/dedup check after a managed broker service restart when
   that service is available, rather than treating a process reopen as the same
   gate.
4. Record a clean shipped commit SHA and release-binary SHA-256 in a reviewed
   artifact, then obtain human approval before changing any catalog entry.
5. Keep unavailable runtimes as explicit `survey-blocked` or `parked` rows; do
   not claim “all AI” from process presence, executable names or historical
   certificates.
