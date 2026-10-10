# Heartbeat → Capture AI → Client Release: implementation ledger

Updated: 2026-10-10, Asia/Bangkok. Branch: `codex/heartbeat-capture-release`.
Base: `90774c9`. Foundation commits: `98c81d7`, `4a9d194`; editor redrive and
Cline wiring: `3484e95`. The current internal macOS arm64 candidate was built
from clean commit `3484e950b1db1b06a442d1f03b224256364e248e` and passed package
integrity and native execution checks. The older `4a9d194` candidate does not
contain editor redrive or Cline setup changes.
Development remains **in progress**. No native/live certification or production
release is implied by unit, fixture, or artifact-verifier tests.

## Internal candidate evidence

Artifacts and metadata are under
`output/heartbeat-capture-client-release/3484e95/darwin-arm64/`:

- VSIX and standalone archive contain the identical native binary, AI resources
  and verified hashes. Both are internal, unsigned artifacts.
- `candidate-darwin-arm64.json`: source/compiled inventory, architecture,
  binary/bundle/VSIX/standalone hashes and verifier results.
- `native-smoke.json`: the extracted binary ran with an isolated fixture home;
  its build SHA matched the source. Cline file-hook setup, failed-tool marker
  acceptance and uninstall preserving the inbox passed in a Thai/spaced path.
  Marked tool parameters/results were absent from stored metadata. No real
  account/provider, background service or server readback was used.
- `support-matrix.json`: per-metric dispositions exported from that same binary's
  `adapter list --json`. All fourteen registry IDs are present. Live certification
  remains pending; the snapshot is not evidence of installed provider runtimes.

Only macOS arm64 native execution is evidenced here. Actual extension installation,
LaunchAgent lifecycle, Windows/x64 artifacts and live provider certification remain
separate gates. Docker Desktop/API/VM were not started for this work; the installed
macOS networking helper is not a running Docker engine.

## Implemented foundation

| Area | Current behavior |
|---|---|
| Editor acceptance | Private append-only checkpoints retain IDs, event timestamps, snapshots, segments and pending external observations. A checkpoint is acknowledged only after file sync. Corrupt/torn records preserve the verified prefix and block further acceptance. |
| CLI handoff | `heartbeat-batch` reads metadata from stdin and returns a result for each original ID after the durable SQLite transaction. Receipts survive server delivery and process restart. Bad siblings do not erase good records. Old CLI responses cannot release the journal. |
| Editor dead letter | **Retry Retained Editor Record** explicitly redrives one quarantined payload with its original ID/time. A durable duplicate ACK also completes handoff. Transient rejections return to retained pending delivery; lost responses and checkpoint write failures do not report success. Diagnostic error codes are validated before storage. |
| Recovery scope | Prior editor journals and capture inbox/cursors are adopted only with recorded same-account, same-origin ownership proof. Conflicting inbox revisions, contracts or cursors fail closed. |
| Runtime intent | `runtime pause/resume/status --component capture\|delivery\|backend-local\|all --json`; user intent survives restart. Capture excludes pause intervals; delivery refuses new POSTs while paused. Resume validates owned binaries/configuration before releasing pause. |
| Owned workers | Per-user LaunchAgent / Task Scheduler definitions, immutable hash directories, active/previous pointers, worker locks and startup build-hash observations. Install/upgrade/rollback/uninstall/resume are serialized. Queue and journal data survive removal. Windows registration receipts detect changes to the actual exported task definition. |
| Managed extension CLI | Custom paths remain owned by the user. Managed binaries are hash/protocol checked. Explicit rollback and failed-candidate fallback remain pinned after extension-host restart until **Upgrade Managed CLI** succeeds. |
| Upstream health | Journal failure, pending and dead letter remain visible even when the server queue is empty. Capture health is attached to delivery snapshots; server capability is additive. Missing evidence remains unconfirmed. Journal notifications are emitted on fault/recovery transitions. |
| Collector | Shared 15-second discovery/parse/normalize/handoff loop, source bounds and rotating priority. Accepted events, provider contract metadata and cursors commit together; malformed schema stops that source before the problematic record. |
| Activity contract | Strict provider-neutral v3, legacy v2 behavior preserved. Native/wrapper precedence requires operation identity. Markers do not manufacture usage, file edits or execution intervals. |
| Internal release tooling | Four native CI build targets, clean-source full SHA validation, compiled-extension hashes, binary-format/architecture checks, VSIX and identical standalone archive checks, metadata evidence and unsigned/internal labels. Workflow has no publishing step. |

The existing duration, timeout, overlap precedence, heartbeat revision, lease,
retry schedule and recovery-probe policy are retained. Provider additions change
observed inputs, not the duration formula. No WakaTime time is imported to close
a difference.

## Adapter implementation disposition

The authoritative machine-readable list is `wakaclock adapter list --json` /
the adapter catalog's `activity_capabilities`. All live certification fields
remain pending. A missing installation/login is not proof of unsupported metrics.

| Adapter | New activity path / development still required |
|---|---|
| Codex | Existing native/transcript activity, measured-tool evidence and durable cursor retained. Explicit IDE/Desktop discovery and surface evidence remain to be completed. |
| Claude Code | Native hook and transcript markers; native/transcript operation IDs converge with ordered revisions and the canonical usage session identity. Permission waits are not measured tool time. |
| Gemini CLI | Native Before/AfterTool and Agent markers. The documented hook does not promise a unique tool operation ID, so observations are not paired into measured intervals. |
| Cursor | Native agent markers; a generation ID is not treated as an individual tool ID. Tab/inline acceptance pipeline remains development work. |
| Copilot | Local VS Code agent hook markers with real optional session identity. Missing identity stays unavailable. CLI/inline evidence and daily API metrics remain separate development work; no daily values are assigned to sessions. |
| Kilo Code | Explicit `activitySurface` plugin option enables all tool start/end/failure markers, including read/search. Matching local durable ACK required. Shared legacy file producer retained. Durable producer-side retention before CLI availability remains work. |
| Kimi Code CLI | Existing edit/snapshot hooks retained; generic native task/tool/message activity wiring remains work. |
| Generic MCP | Strict v3 ingress and shared durable pipeline available only for explicit producer events. No claim to observe every MCP interaction or infer usage/cost. |
| Cline | Metadata-only native markers and owned executable file-hook setup on macOS. Preflight checks all managed event files, rejects foreign/symlink files/directories, and retains generations across interruption. Neutral `cancel:false` never means a durable ACK; capture failure emits only a safe diagnostic and never blocks the host. No measured interval or file attribution is inferred. Actual provider version and Windows hook contract remain pending. |
| OpenCode | Metadata-only tool marker normalizer exists; native plugin installation and v1/v2 contract negotiation remain work. |
| Roo Code | Verify the extension API and implement metadata-only bridge with proven task/project identity. |
| Windsurf | Resolve version-specific Cascade hook contract and product/documentation redirects before wiring. |
| Antigravity | Verify native/plugin/export contract and wire only proven fields. |
| Deep Code | Product identity is awaiting the owner's answer. No mapping to DeepSeek or another product is assumed. |

Contract references: [Claude hooks](https://code.claude.com/docs/en/hooks),
[Gemini hooks](https://geminicli.com/docs/hooks/reference/),
[Cursor hooks](https://prod.cursor.com/docs/hooks),
[VS Code local agent hooks](https://code.visualstudio.com/docs/agents/reference/hooks-reference),
[Kilo plugins](https://kilo.ai/docs/automate/extending/plugins).
The Cline macOS file-hook contract comes from the provider's
[hook documentation](https://github.com/cline/cline/blob/main/.clinerules/hooks/README.md).
References establish documented contracts, not live certification of this build.

## Development still to complete

1. Finish the per-adapter paths above, including Cursor/Copilot inline and explicit
   provenance for Codex IDE/Desktop. Keep unsupported, unresolved and evidence
   pending distinct; do not reduce the approved scope without the owner's decision.
2. Finish journal repair tooling (editor dead-letter inspection/redrive is implemented).
   Guard-owner ambiguity, checksum failure and unknown baseline need explicit
   recovery dispositions; never trim a pending journal to make it look healthy.
3. Finish producer health and capture-surface health projection in CLI/VS Code/UI.
   A native hook that never reaches durable acceptance must report capture failure.
   Review sidecar cursor ownership across accounts and multiple windows.
4. Finish migration/rollback compatibility for previously installed workers that
   cannot publish build-hash readiness; no successful upgrade claim from OS exit
   code alone. Validate service ownership on each supported OS.
5. Freeze a clean source commit and build an internal VSIX plus standalone bundle
   for each target. CI configuration and synthetic verifier fixtures are not
   delivered native executables. Complete release notes/support diagnostics from
   the registry and certify only the architectures actually exercised.

## Tests and external evidence — separate from development

Local evidence already obtained in this working revision:

- Core library: **384 passed**, including ownership/ID/cursor/contract and duration
  invariants. Strict Clippy core + CLI all-targets passed with warnings denied.
- VS Code: **194 passed**; type check passed. Includes journal crash,
  sync/compaction failure, replay, response
  loss, original timestamps, scope isolation, external shutdown handoff, sidecar
  checkpoint errors and persistent managed rollback.
- Native CLI editor-handoff subprocess fixtures: **4 passed** using isolated homes
  and an unavailable loopback origin; no real transcript/account or Docker.
- CLI regression: **82 unit + 6 broker + 4 editor handoff + 44 offline
  lifecycle passed**, including 1,191 queued records across three days, idle
  recovery, response loss, auth/rate-limit handling and preserved scoped IDs.
- Kilo plugin: **13 passed**, including read/search/failure metadata boundaries.
- Python local-runtime: **7 passed**, including no Docker calls during Pause and
  refusal to resume an unproven supervisor. Artifact/coverage tooling: **51 passed**.
- Server activity timeline: **41 passed**, **1 ignored** because it requires an
  isolated ClickHouse instance. The ignored test is not a passed restore/lifecycle
  gate. Earlier Team trust unit checks passed; isolated DB drills remain pending.

Required remaining acceptance evidence:

- T1: Full journal/process-kill, torn-write, disk-full, permission, compaction,
  concurrent-window/account-switch, mixed-ACK and parser fault matrix; independent
  storage/outbound/log privacy checks. The 1,191-record regression passed locally;
  repeat it against the final candidate and retain the actual exit result.
- T2: Native install/upgrade/interruption/rollback/uninstall, login, sleep/wake,
  crash, persistent Pause, Windows executable lock and Thai/spaced paths. Actual
  x64/arm64 machines must exercise the architecture being certified.
- T3: At least ten real sessions per declared adapter/surface/OS, independent
  expected ledger, provider version/architecture and canonical/UI readback. Fixture
  events and cross-compilation do not satisfy this gate.
- T4: Seven completed working days with real user activity, build/capture changes
  recorded, separate monitor activity, matched timezone/cutoff/timeout/category.
  Report WakaTime-only and AtoAxis-only intervals. The 1% target is restricted to
  identical-input tests.
- T5: Final compatibility/downgrade, native smoke, performance, signing and
  notarization. Marketplace/stable publication remains separately authorized.

## Runtime and recovery runbook

Use commands from the intended verified CLI binary. Examples below are
instructions, not actions this implementation session ran against the user's data.

```sh
wakaclock runtime status --json
wakaclock runtime pause --component all --json
wakaclock runtime resume --component capture --json
wakaclock runtime resume --component delivery --json
wakaclock runtime upgrade --component capture
wakaclock runtime rollback --component delivery
```

Pause retains already accepted records. Resume does not replay the time spent
paused. Capture and delivery are separate: capture can continue durably while
delivery is paused; accepted capture inbox can hand off while capture is paused.
No age/size-based backlog deletion is permitted.

For an editor journal failure, park capture and preserve the entire journal,
lock/guard metadata and SQLite backup including WAL before repair. A corrupt
tail is not an ACK. A permanent item rejection stays in recoverable dead letter;
it does not prevent valid siblings from being accepted. After correcting the
receiver/validation problem, use **Retry Retained Editor Record** to retry one
item. No historical snapshot is regenerated from current files. Success means
local durable CLI acceptance; inspect server delivery separately. Corrupt journal
repair remains manual; never trim or delete the original evidence.

For worker upgrade, use **Manage Background Runtime** explicitly. Active and
previous executables are immutable hash directories. A custom `wakaclock.cliPath`
is never overwritten. **Rollback Managed CLI** pins the selected executable;
**Upgrade Managed CLI** explicitly releases the pin after verification. Worker
binary selection is separate; inspect runtime status before worker upgrade.

Native activity hook setup is explicit (`ai activity-setup --adapter … --yes` or
the VS Code command) and preserves unrelated user hooks. Setup records ownership
and interrupted generations before modifying configuration. Copilot requires
the applicable VS Code local-hook setting and workspace trust; it does not
enable unsupported inline/token metrics.

`backend-local` Resume only applies to the configured local origin and an existing
sealed supervisor; Cloud clients never invoke it. Legacy supervisors missing the
new executable proof require an explicit verified upgrade. Registration does not
claim database/API readiness. Keep backend-local paused before closing Docker;
do not resume it while intentionally keeping Docker off. This implementation
session did not install or start the user's services, initialize databases, replay
private events, publish a release, or push/merge `main`.

Rollback by disabling a new capture feature/collector or selecting the prior
verified binary. Preserve journal/queue IDs, accepted inbox, timestamps and
additive migrations. Disable recovery probe only with evidence it caused a
regression. Never roll back by deleting backlog or reverting schema.
