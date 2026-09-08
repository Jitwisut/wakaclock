# F7-01 topology contract — local implementation record

วันที่: 2026-09-08  
Branch: `features/ai-coverage-f6-analytics`  
สถานะ: **implementation validated locally; live topology certification remains a release gate**

F7 extends attribution to places where the file is actually changed: SSH remote
extension hosts, WSL, dev containers and cloud jobs. A desktop tracker watching the
local checkout cannot prove those edits. Before adding collectors, the project needs
an identity contract that prevents two machines, two clones with the same basename or
two worktrees from being folded into one timeline.

## Implemented

`backend/api/crates/wakaclock-core/src/ai/topology.rs` now provides:

- `ExecutionSurface` for local, SSH remote, WSL, dev-container, remote-extension and
  cloud-job runtimes.
- `EditorSurface` for VS Code, JetBrains, Neovim, Zed, generic LSP, browser and no
  editor. Editor names are descriptive metadata and never prove AI authorship.
- `TopologyContext` with schema version and opaque device/workspace/worktree/session
  IDs. Optional runtime-instance and repository IDs are also opaque.
- `TopologyIdentityInput`, which derives stable IDs from a persisted installation seed
  and explicit workspace/worktree keys. Hostnames, user homes, repository basenames and
  raw remote URLs are not serialized as identity.
- `WorkspaceMappingRegistry`, which resolves a path only against an explicitly
  registered absolute local or remote mount root. Conflicting or overlapping mappings
  fail closed; there is no basename or insertion-order fallback.

The module is exported by `wakaclock-core::ai` but is not attached to `BrokerEventV1`
yet. That is deliberate: `BrokerEventV1` uses strict unknown-field rejection and F8
must first perform the server-first compatibility rehearsal before a new remote
producer can emit a wire field safely.

The CLI exposes the local setup snapshot with
`wakaclock ai topology --json [--root /absolute/workspace]`. It creates or reuses a
per-installation seed under the local Wakaclock state directory, derives IDs without
printing the path used as key material, and detects the execution/editor surface from
explicit `WAKACLOCK_*` environment values before falling back to SSH/WSL/container
signals.

`wakaclock ai emit` also accepts an optional `topology` object using this contract.
The CLI validates it, keeps the broker event id stable across session reconnects, and
uses the topology-aware handoff ledger before the strict broker v1 envelope is sent.
Old brokers continue to work because the context remains local until the F8
compatibility rehearsal adds an additive wire field.

`backend/api/crates/wakaclock-core/src/ai/topology_handoff.rs` now adds the local
handoff contract used by the collector runtime:

- `CollectorRegistration` binds a collector to an explicit topology and requires an
  `AuthenticatedBridge` for SSH, WSL, dev-container and remote-extension surfaces.
  Cloud jobs use a separate `CloudJobCallback` transport. No socket, token or public
  local endpoint is created by this contract.
- `HandoffLedger` accepts metadata in receipt order, deduplicates shared local and
  remote observations only by the same event id or an explicit operation-id plus
  per-file mutation-id proof, and keeps accepted receipts while a collector is
  disconnected or draining.
- A bounded JSON snapshot is saved beside the existing durable queue before broker
  submission and restored after a process/container restart. A collector cannot be
  retired while unacknowledged receipts remain.
- `CloudJobEvidence` requires a cloud topology, opaque callback-key reference, job id,
  tool event id and mutation id.
  It has no commit/PR author field, so VCS authorship cannot be used as a file
  attribution shortcut.

## Verification

- Stable IDs survive a reconnect when the persisted device seed and explicit keys are
  unchanged.
- Different device seeds and worktree keys never share workspace/worktree identity,
  even when the repository identity is the same.
- Local roots and remote repository URLs do not appear in serialized topology context.
- Cloud jobs without a runtime-instance key are rejected.
- Duplicate registrations are idempotent; conflicting and overlapping roots are
  rejected; an unrelated path returns no mapping.
- `cargo test -p wakaclock-core ai::topology` passes, including explicit remote mount
  mapping tests.
- `cargo test -p wakaclock-core handoff` passes for
  authenticated transport boundaries, cross-collector dedup, clock-skew-safe receipt
  ordering, sequence rollback, retention, disconnect/reconnect/teardown snapshot
  recovery and the cloud evidence boundary.
- The built CLI topology command emits only the versioned opaque context for a local
  workspace.
- `cargo check --workspace`, the full core suite (252 tests plus conformance), and
  `git diff --check` pass.

## Release gates outside the local code closeout

1. Run the authenticated SSH/remote-extension bridge fixture and issue its separate
   topology certificate.
2. Run WSL/dev-container teardown/restart on the target environments and issue their
   lifecycle certificates.
3. Connect the cloud job adapter to a real authenticated tool-result callback and
   certify only tuples with file-level evidence. Commit/PR bot authorship remains
   imported VCS metadata only.
4. Keep browser paste as `unknown` without a separate explicit provenance integration.
