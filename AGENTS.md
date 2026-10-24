# Repository instructions

Read [CLAUDE.md](CLAUDE.md) before working in this repository. It is the shared
project index, including context routing, protected code and Git rules.

## Build storage — owner preference recorded 2026-10-14

The owner does not want build caches and abandoned worktrees to grow unchecked.
Read [.context/storage.md](.context/storage.md) before building, testing,
creating a worktree, changing compiler flags or cleaning generated files.

- Reuse a suitable checkout and build directory; do not create a new worktree or
  target directory for every command or test run.
- Keep the repository's space-saving development/test profiles. Do not silently
  enable incremental compilation or full debug symbols.
- Measure the affected build directories before and after substantial builds.
  Review at 10 GiB per Rust target, 30 GiB for `.worktrees`, or 50 GiB for the
  repository. These are review thresholds, not an automatic filesystem quota.
- Finish tasks by cleaning up their disposable caches, including targets outside
  the repository. Preserve evidence, executable binaries still needed, source,
  uncommitted work, dependencies and other tasks' active build directories.
- Never delete a cache while a compiler or dev server uses it. Coordinate build
  locks and detach a verified stale cache before removal if builds may restart.
- Never remove a whole worktree without preserving its work and checking ownership.

The full policy and the 441 GiB incident are recorded in the storage context.
