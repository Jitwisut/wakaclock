# Project Intelligence acceptance ledger

## Baseline

- Base: `71a364292c0d8a582bf7090828f09361fbcf7a9a`, verified against GitHub `main`.
- Task branch and isolated checkout: `codex/project-intelligence-evolution`, `.worktrees/project-intelligence-evolution`.
- Pilot validation host: macOS arm64, Git 2.54.0, Node.js 24.16.0, extension base 0.2.1.
- Dependencies installed from the extension lockfile with `npm ci --offline`. No Rust build target was created.

## M1A — Code Evolution Viewer

| Check | Status | Evidence |
| --- | --- | --- |
| Local reader returns immutable revisions and bounded read-only previews | Passed | Git fixture tests |
| Root, merge parents, pagination, linked worktree and exact rename | Passed | Git fixture tests |
| Symlink blob, submodule, LFS, binary, oversized content and missing objects | Passed | Git fixture tests |
| Extension lint, compilation and existing test suite | Passed | `npm run lint`, `npm run compile`, `npm test` (280 tests) |
| Disabled, untrusted, or remote viewer does not start Git | Passed | Mock extension host tests |
| Command available during offline activation | Passed | Extracted development VSIX, VS Code 1.146.0, isolated profile, no credentials or CLI, Internet blocked |
| Virtual document does not create edit events | Pending | Existing file-only guard confirmed in source. Verify in installed VSIX |
| Native Diff opens from the file list | Passed | Real VS Code command → revision selection → tree selection → diff, both blob contents asserted |
| Inline/side-by-side toggle | Pending | Visual verification |
| Preview p95 on reference fixtures | Pending | Measure in the installed VSIX with 100, 1,000 and 10,000 files |
| Pilot or Marketplace release | Pending | No release built or published |

### Local contract

The comparison pins full commit IDs and stores file metadata as blob IDs, tree modes, and display paths. The viewer reads text by blob ID in memory and uses the `atoaxis-revision` URI scheme. Git process output is bounded, external diff and text conversion are disabled, and transports are blocked.

The feature is off by default. Activation uses a single registration in `extensions/vscode/src/extension.ts`, before the existing credential and runtime work. The current tracker uses `isFileDocument` to restrict document capture to `file` URIs.

### Fix verification

- The owner approved the described activation integration with “แก้ไขเลย”.
- Expired preview URIs raise FileNotFound with instructions to reopen the preview. Empty Git blobs still return valid empty content.
- Escaping distinguishes literal backslashes from control-character escapes. Each blob reference retains the original path bytes as base64.
- Tests cover the full command flow in a mock host, expired documents, empty blobs, workspace changes during a comparison, and ambiguous display names.
- A real VS Code host loaded the extracted development VSIX with an isolated profile. macOS sandbox denied Internet connections and allowed Unix IPC. The test verified activation, revision selection, opening a native diff through the file list, exact before/after content, expired document rejection, and the installed file-only eligibility guard.
- This development package omits the native CLI and received the repository's existing LICENSE warning. It is a local viewer verification artifact. Marketplace packaging/signing and full tracking/journal integration remain pending.
- Private smoke evidence and the VSIX are retained in the repository owner's output/project-intelligence-m1a directory. Temporary packaging sources and VS Code profile caches were removed after the host exited.

### Remaining installed verification

Use an isolated macOS VS Code profile with the task VSIX, no AtoAxis credentials, auto-updates disabled, and networking disabled. Open a trusted fixture repository. Enable the feature from the command, choose HEAD and its parent, verify the changed file list and open the diff. Toggle between inline and side-by-side. Repeat with a merge parent, binary file and incomplete shallow history. Inspect recorded fixture activity for the absence of edit events attributed to revision documents. Verify the installed artifact includes the compiled viewer modules.

## Subsequent milestones

M1B Code Map, M2 Replay and Pulse, M3 Memory and Story, M4 sharing, M5 Insights and M6 Impact have not started.
