# AI coverage — implementation ledger (F0/F1/F2/F3/F4)

Updated 2026-09-06. This ledger records what is wired and tested in
features/ai-coverage-f0-baseline; it is not a claim of merge, live database
certification, or real-account adapter certification. Statuses use the ledger's
vocabulary: planned → in_progress → implemented → validated.

## F0 — baseline and decisions

| Task | Status | Evidence / remaining caveat |
| --- | --- | --- |
| F0-01 baseline | validated | [baseline](../docs/ai-coverage-baseline-2026-09-05.md) records branch point, versions, module wiring, and dirty-tree boundary. |
| F0-02 doctor placeholder | validated | The former doctor ai/ai doctor running-state mismatch is now a passing broker integration regression in backend/api/crates/wakaclock-cli/tests/broker_process.rs. |
| F0-02 unmatched AI edit | validated | A change with no positive AI or human proof remains unattributed; covered by extensions/vscode/test/aiAttribution.test.ts. |
| F0-02 delayed sidecar | validated | A pending observation is revised only after a valid tool ID or content-version proof arrives. |
| F0-02 mixed human + AI edit | validated | Proven AI lines are split from the unknown residual; the whole batch is never relabeled as one actor. |
| F0-03 unknown vs. Unattributed AI | validated | [decision ADR](decision-unknown-authorship-vs-unattributed-ai.md) and client/server/UI truth tables preserve the distinction. |
| F0-04 VS Code capability spike | validated | [capability spike](../docs/vscode-human-input-capability-spike-2026-09-05.md) records real extension limits for undo/redo, paste, formatter, and IME. |
| F0-05 canonical identity/revision protocol | validated | [protocol design](design-canonical-operation-and-revision-protocol.md) prohibits time/line-only aliases and defines full-value corrections. |
| F0-06 wire/schema inventory | validated | [compatibility inventory](wire-schema-compatibility-inventory-2026-09-05.md) records strict boundaries and additive migration rules. |
| F0-07 ground-truth manifest | validated | [ground-truth manifest](ai-coverage-ground-truth-manifest.md) separates runnable synthetic scenarios from real-account certification. |

F0 is closed. Its original failure artifacts remain useful regression history;
the production behaviors they described are now covered by F1 tests.

## F1 — attribution, deduplication, and late reconciliation

| Task | Status | Evidence / remaining caveat |
| --- | --- | --- |
| F1-01 pure attribution + conformance | validated | Shared decision fixtures pass Rust, VS Code, v1 ingestion, and history projection tests. |
| F1-02 per-change editor pending state | validated | VS Code retains bounded pending observations and separates AI, human, and unknown line ownership. |
| F1-03 sidecar version/sequence/resume | validated | Durable stream/sequence, partial-line and rotation recovery, bounded reads, and restart checkpoints pass extension/core tests. |
| F1-04 exact editor↔agent reconciliation | validated | Matching requires tool identity or post-edit SHA-256 content proof; same-time/same-lines is not enough. |
| F1-05 canonical IDs/aliases | validated | Codex/Claude/Gemini tool IDs propagate through broker and server; weak path/time/line fingerprint suppression is removed. |
| F1-06 revision storage/read semantics | validated | Bounded monotonic full-value corrections, orphan/gap rejection, retry idempotency, and durable local history are implemented. |
| F1-07 policy/legacy projection | validated | Invalid verified identity is downgraded; unknown is never promoted by source labels or legacy fields. |
| F1-08 API/ClickHouse canonical projection | validated | Reads use heartbeats_canonical; max revision is selected before aggregation and reprocess carries revision. Legacy no-ID rows remain independent. |
| F1-09 unmatched fallback/rollout | validated | Unmatched is unattributed; late proof can revise it; broker-owned gap flushes do not emit duplicate editor heartbeats. |
| F1-10 crash/offline/concurrency matrix | validated locally | Broker restart/lease recovery, offline queue, sidecar restart, duplicate, and concurrency suites pass. Full live ClickHouse replay remains a release gate. |

## F2 — runtime diagnostics and multi-device persistence

| Task | Status | Evidence / remaining caveat |
| --- | --- | --- |
| F2-01 nullable health DTO | validated | v2 measurements carry availability, measured_at, and nullable value; v1 mapping remains additive. |
| F2-02 real process/queue/parser probes | validated | Broker store, queue, service lock, parser files/cursors, lag, delivery, and safe errors are measured; probe failure is unavailable, not false/zero. |
| F2-03 command/self-test unification | validated | ai doctor, doctor ai, ai status, and extension diagnostics use the same v2 collector contract. |
| F2-04 consent separation | validated | Adapter tracking, observer, and diagnostics upload are separate; observer remains observe-only. |
| F2-05 device repository/order/TTL | validated | Opaque device + boot + sequence is stored per user/device with 30-day TTL and deterministic newest-first fallback ordering. |
| F2-06 persistence wiring/degradation | validated | PostgreSQL mode is durable; no-PostgreSQL mode reports storage: ephemeral. |
| F2-07 validation/privacy/rate limits | validated | Auth scopes, bounded IDs/counters, safe codes, metadata-only payloads, and user/device upload limits are enforced. |
| F2-08 observer noninterference/idle-stalled states | validated locally | Core noninterference tests and idle/stalled/unavailable representations pass; live production-vs-observe-only differential remains a release gate. |

The detailed implementation record is [the F1/F2 closeout](../docs/ai-coverage-f1-f2-closeout-2026-09-06.md).

## F3 — registry-driven setup (validated locally; release gate remains)

F3 is implemented through the versioned `AdapterCatalogV1` contract. The CLI
and Extension now consume the same runtime/platform/resource metadata, setup
and uninstall outcomes carry schema/version/action fields, `--all` selects only
detected supported runtimes, and parser/doctor dispatch is registry-driven.
Bundles are verified with deterministic per-file SHA-256 manifests and an
atomic active/previous pointer. Extension setup consumes the CLI report first
and keeps only a compatibility fallback for older binaries. Native installer
dependency failures and unsupported Windows shell setup are explicit outcomes;
user config remains marker-owned and preserved.

The implementation and local test gates are recorded in
[the F3 closeout](../docs/ai-coverage-f3-closeout-2026-09-06.md). Live
launchd/systemd/Task Scheduler restart-after-editor-close and real adapter
certification remain release gates; they are not claimed from this macOS
workspace.

## F4 — certification infrastructure (validated locally; live promotion gate remains)

F4-01 through F4-06 are implemented locally. Certification artifacts now carry
an exact adapter/producer/tool/runtime/OS/architecture/capability tuple and
mandatory stage results. A temporary live harness produces a pending,
privacy-filtered candidate; it cannot edit the reviewed catalog. The server
loads the reviewed catalog from the core release resource and resolves exact
tuples with freshness and revocation checks. Legacy Claude/Codex records are
historical evidence only. CLI tuple fields, API sanitization and frontend
capability/runtime labels are covered by the same contract.

See [the F4 implementation record](../docs/ai-coverage-f4-closeout-2026-09-06.md).
An approved live tuple still needs an authenticated real-tool run, shipped
build digest, backend/dashboard readback and human review.

## F5 — Baseline agents (F5-01/F5-02/F5-03 in progress)

F5-01 Claude Code has a current local transcript-shape refresh for executable
`2.1.246`. The parser now ignores valid non-edit content shapes without false
malformed warnings and carries the assistant workspace root when a matching tool
result omits `cwd`. A real local transcript replay emitted 33 file-edit events
with zero malformed-record warnings. Native-hook/API/dashboard certification is
still a live gate. See the [F5-01 refresh](../docs/ai-coverage-f5-01-claude-refresh-2026-09-06.md).

F5-02 local implementation is in place. The Codex transcript parser now accepts
the current `session_meta` shape without dropping records when both session-id
keys are present, rewinds incomplete call/output pairs across bounded scans,
rejects explicit failed calls, suppresses duplicate completion evidence, carries
provider identity, and preserves create/modify/delete/rename metadata through the
broker envelope. The built-in manifest is intentionally `scaffold` while the
current `codex-cli 0.153.4` tuple is not yet live-certified; the prior
`0.151.0-alpha.7.1` run remains historical evidence. Desktop/IDE transcript
evidence is not used as a CLI certificate.

The parser, patch, and broker regression gates pass. The remaining F5-02 gate is
a fresh authenticated `codex exec` campaign with the shipped bundle, backend and
dashboard metadata readback, followed by a pending artifact and human review.
The adapter-specific campaign driver and generic harness hardening are now
implemented locally; they do not claim that the live gate passed. See the
[F5-02 closeout](../docs/ai-coverage-f5-02-codex-closeout-2026-09-06.md) and
[campaign driver record](../docs/ai-coverage-f5-02-campaign-driver-2026-09-06.md).

F5-03 Gemini CLI is survey-blocked on this machine. `gemini 0.58.0` is installed,
but no JSON/JSONL session payload is present under the local Gemini history/tmp
roots. No synthetic fixture was added; exact payload inventory and live
certification require an authenticated disposable run. See the
[F5-03 inventory](../docs/ai-coverage-f5-03-gemini-inventory-2026-09-06.md).

## Codex Desktop detection repair

wakaclock-core::ai::codex recognizes the live Codex Desktop transcript shape:
custom_tool_call named exec unwraps literal and variable-wrapped tools.apply_patch
calls, and a matching tool output is required before a file event is emitted. Sync
validates each transcript event, isolates parser failures per agent, scans newest
transcripts first, and keeps the broker retry queue at zero in the recorded replay.
The regression path is now covered as well: a stale release LaunchAgent no longer
aborts a whole sync on one out-of-root historical record, and Delete+Add of the
same file in one Codex patch gets distinct deterministic event IDs.

## Local gates

- cargo fmt --all -- --check — passed.
- cargo check --workspace — passed.
- Core diagnostics/revision/canonical tests — passed.
- CLI unit suite — 53 passed.
- Server diagnostics/rate-limit/correction tests — passed.
- VS Code test suite — 107 passed; TypeScript lint passed.
- Frontend typecheck and ESLint — passed; diagnostics panel test passed.
- git diff --check — passed.
- F4 Python schema/harness/catalog gates — passed.
- Core/backend F4 certification tests — passed.

The full frontend suite retains one unrelated pre-existing auth redirect failure
in frontend/app/test/auth-screen.test.tsx. Live ClickHouse/PostgreSQL
integration, historical materialized-view rebuild, and real-account adapter
certification remain F4/F8 work.
