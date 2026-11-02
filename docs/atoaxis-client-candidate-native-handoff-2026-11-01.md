# Internal candidate tooling — 1 November 2026

Status: connected tooling, static checks passed; behavioral/native verification
not run. Uncommitted source on `codex/team-closure-wip`, delivered base
`1646cbf6549565b008e9dadebe6ff76ebe221258`. This is not a clean release candidate
or a claim that all non-Stripe Team development is complete.

Stripe remains deferred by the owner because no account is available. Preserve
its work, IDs and migrations; do not enable Checkout or payment flags.

## Development delivered

- The manual internal-candidate workflow has an opt-in native lifecycle step,
  architecture-specific Node/Python setup and a separate eight-artifact matrix
  report. Ordinary packaging leaves native verification pending.
- Native smoke extracts the actual verified VSIX binary/resources. It refuses
  local/self-hosted runs, existing application/provider profiles, existing service
  registrations and ambiguous ownership before changing the runner.
- An isolated synthetic account uses only a loopback server returning 503. The
  fixture checks that its one queued record and handoff receipt survive service
  install, pause/resume, version switching and uninstall. It does not establish
  server acceptance, canonical readback, real account health or duration accuracy.
- Upgrade/rollback requires a pinned prior candidate from this repository with
  a different commit and binary hash. Missing baseline remains pending.
- VSIX smoke installs the candidate into separate VS Code profile/extension
  directories, activates the installed extension through a small separate test
  harness, verifies commands/bundled CLI and checks custom CLI override retention.
  No provider hooks are enabled. Missing native VS Code remains pending.
- Cleanup attempts pause and uninstall independently for each service created by
  the harness. Unconfirmed cleanup preserves working files. Queue/receipt data is
  retained; no existing runtime or service is taken over.
- Matrix verification rechecks artifact bytes, source/hash/target, runner
  architecture and required smoke evidence. Eight built files alone never mean
  native smoke passed. Signing/provider certification/production remain separate.

## Checks actually performed

- Python AST syntax: six tooling modules and two regression source files.
- JavaScript syntax: `node --check` on `native_vscode_smoke.cjs`.
- YAML parse and four-target/architecture/opt-in structure using the repository's
  installed `yaml` library. PyYAML was unavailable; nothing was installed.
- `git diff --check`; protected router remains exactly five previously approved
  added lines, and protected identity synchronization files remain unchanged.

No regression test was executed. No native smoke, build, workflow dispatch,
service manager mutation, Docker, provider call or migration was run. No new
build cache was created by these syntax checks.

## Test handoff — execute only when verification is resumed

1. Run regression sources with Python unittest discovery for
   `test_native_candidate_smoke.py` and `test_candidate_matrix.py` under
   `scripts/ai-coverage/tests`. These use synthetic fixtures/mocks; they do not
   certify actual native service or VS Code behavior.
2. Commit a reviewed clean candidate after owner authorization, then dispatch
   `internal-client-candidate.yml` on that branch. With `run_native_smoke=false`,
   expect verified packaging and explicit pending native evidence.
3. On disposable GitHub-hosted runners, provide `run_native_smoke=true`, paired
   `baseline_run_id`/`baseline_commit`, and `vscode_executables` as a JSON map from
   each target to an existing native VS Code executable. The baseline must be
   retained and from this same repository. Without either prerequisite the
   affected checks stay pending, even if other checks pass.
4. Inspect all four per-target runner/smoke receipts and the uploaded matrix
   report. Expect two artifacts per target, matching binaries/resources and
   distinct actual upgrade/rollback evidence. Missing, mismatched or failed
   evidence must prevent `internal_test_ready=true`.
5. Verify clean and interrupted lifecycle behavior on actual macOS/Windows
   architectures. Provider sessions, canonical/UI readback, signing and canary
   are separate acceptance gates and are not satisfied by this fixture.

Remaining: execute the above after authorization, obtain native VS Code and a
distinct baseline for each target, fix defects found, then produce a clean
candidate/evidence set. Broader non-Stripe privacy/retention/restore/configuration
closure still needs its source inventory review; do not label it complete from
this packaging increment.
