# AI coverage F3 closeout — registry-driven setup

F3 is implemented and validated locally on `features/ai-coverage-f0-baseline`. The
CLI, VS Code extension, adapter catalog, bundle updater and service installer now
share explicit outcomes and artifact checks. A live restart test on each OS is
still a release gate because this workspace only provides a macOS development
host.

## What changed

- `AdapterCatalogV1` is the versioned registry contract. It resolves provider,
  aliases, supported platforms, runtime implementation and required resource paths
  from the core registry. Duplicate aliases and unsafe resource paths are rejected.
- `wakaclock adapter list --json` returns the catalog object. The parser factory
  and native doctor iterate catalog runtime entries, so scaffold/manual adapters
  cannot become installable by being added to a client list.
- `wakaclock ai setup --all` selects only detected, platform-supported runtimes.
  Version probes honor each manifest's `version_arg`. Setup JSON includes
  `schema_version`, `overall`, `outcome_code`, `suggested_action`, and distinct
  configured/skipped/unsupported/failed results. Partial failures exit non-zero
  after emitting the complete report.
- Bundles carry `bundle-manifest.json` with a deterministic SHA-256 for every
  file. CLI and Extension verify the manifest before reuse and after an atomic
  copy, and maintain `active-bundle.json` with the previous pointer for recovery.
  Missing resources, symlinks, and tampering are rejected.
- Extension setup consumes the typed CLI report first, while retaining a bounded
  compatibility path for older CLIs. Detection reads executable names, provider
  and verification from the registry rather than a fixed five-agent list.
- Kilo and Kimi installer failures now return non-zero instead of being reported
  as successful no-ops. Native setup checks `bash`/`jq` dependencies and reports
  unsupported Windows shell setup explicitly.
- Terminal release archives include `resources/ai-agents` and its manifest; the
  installer extracts those resources beside the binary. Release CI verifies the
  VSIX resource manifest and archive checksums.
- Service installation reports the post-start running probe instead of assuming
  that launchd, systemd or Task Scheduler accepted the request.

## Validation

- `cargo fmt --all -- --check` and `cargo check --workspace` passed.
- `cargo test -p wakaclock-cli --bin wakaclock`: 52 passed.
- `cargo test -p wakaclock-core`: 211 unit tests, one conformance test, and
  documentation tests passed.
- VS Code test suite: 107 passed; TypeScript lint passed.
- AI-agent shell tests passed for Codex, the common emitter, Kilo, Kimi, and
  the Claude heartbeat adapter.
- Bundle tamper, active-pointer, catalog metadata, partial outcome and setup
  resource tests pass.
- `git diff --check` passes.

## Remaining release gate

F3-06 is locally validated for deterministic macOS/Linux/Windows service
manifests and post-start probing. It is not promoted to live-validated until the
release matrix runs launchd, systemd user service and Windows Task Scheduler
restart-after-editor-close tests with real packaged archives. F4/F5 still own
real-account adapter certification and attribution evidence.
