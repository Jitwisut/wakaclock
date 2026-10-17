# Build storage and worktree lifecycle

Owner preference recorded **2026-10-14**: keep development storage bounded;
do not allow disposable build caches or abandoned worktrees to accumulate.
This policy applies before builds/tests, worktree creation, changes to compiler
flags and cache cleanup. It also applies to target directories outside this repo.

## Verified incident — 2026-10-14

The repository occupied approximately **441 GiB**:

| Location | Observed size / contents |
| --- | --- |
| `backend/api/target` | 236.8 GiB; backend files outside `target` were about 12 MiB |
| `target/debug/incremental` | About 114 GiB and 2,863 cache entries |
| `target/debug/deps` | About 113 GiB in that traversal; 1,111,584 files, including 1,096,410 `.o` files |
| `.worktrees` | 192.3 GiB; 33 linked checkouts plus a standalone Rust target directory |
| `frontend/app` | 4.9 GiB, mostly dependencies, `.next` and generated build output |
| `apps/desktop` | 3.7 GiB, mostly Rust build output |

Rust artifact variants and incremental state had accumulated, and many linked
checkouts retained their own build/dependency trees. There was no recorded
storage budget or end-of-task cache lifecycle. Individual variant hashes do not
establish which particular command or agent created every artifact.

Some artifacts were hard links. Do not sum logical file sizes to estimate space
that removal will reclaim; use `du` for the tree and `df` for actual free space.

Cleaning 143 Rust/Next.js generated directories reduced the repository to about
**34.6 GiB**, and actual available disk space increased by about **385.1 GiB**.
Source, worktrees, dependencies, `.env`, runtime binaries and evidence were kept.
An overlapping build recreated files during initial deletion: future cleanup
must coordinate with builds, rather than rely on a single process snapshot.

## Prevent growth

1. **Reuse checkouts.** Inspect existing worktrees before creating another.
   Create one only when the task needs isolation. Record ownership and its target
   directories. Do not start another checkout merely to repeat the same check.
2. **Reuse targets within a task.** Prefer the workspace's existing target.
   If concurrent work requires an isolated target, use one stable target for that
   task and remove its disposable artifacts when finished. A `/tmp` target still
   consumes disk; moving it outside the repo is not cleanup. Do not force
   unrelated concurrent tasks to share a target just to save space.
3. **Use smaller development/test artifacts.** Both Rust workspace roots set
   `profile.dev.debug = 1` and `profile.dev.incremental = false`; `test` inherits
   `dev`. Keep these defaults for routine work. Incremental rebuilds may be
   slower and debugger type/local-variable inspection is reduced. If a debugging
   task needs full symbols or incremental compilation, record that temporary
   override and clean its extra artifacts afterwards. Check Cargo environment
   and config overrides; do not silently bypass the defaults.
4. **Run relevant checks.** Start with the affected crate/tests and run the
   repository's required validation. Do not repeat successful broad builds
   without changed code, a failure or an unresolved concern. Required tests must
   still run; storage policy is not permission to skip validation.
5. **Measure after substantial builds.** Review any Rust target above **10 GiB**,
   `.worktrees` above **30 GiB**, or the repository above **50 GiB**. These are
   review thresholds, not hard quotas. Inspect the largest generated directories,
   clean the task's stale/disposable caches, and report any necessary retained
   artifacts that keep usage above a threshold. Never silently continue towards
   hundreds of GiB. Do not run a full repository scan for every small command.
6. **Finish the lifecycle.** Remove disposable targets and `.next` output created
   for one-off validation after consumers stop; retain a useful bounded cache for
   an active checkout. Archive/remove only worktrees owned by the task after
   preserving their work. Use the managed worktree archive tool for app-managed
   worktrees. Do not remove other chats' worktrees or delete by age alone.

## Cleanup boundaries

- Identify the exact generated paths, confirm they are ignored by Git and contain
  no tracked files, and inspect compiler/dev-server use. Do not treat every ignored
  directory as disposable: databases, journals and incident evidence can be ignored.
- Respect Cargo's locks for the affected target/profile. Skip a busy cache. If
  builds may restart, atomically detach verified stale cache directories to an
  ignored staging location on the same filesystem while coordinated, release the
  locks, then delete the detached files. Leave newly created live output alone.
- Rust intermediates in this incident were `deps`, `incremental`, `build`,
  `.fingerprint` and `examples` under the selected profile. Cargo's internal layout
  can change; verify it for the installed toolchain before targeting directories.
- Plain `cargo clean` deletes the whole target, including final artifacts. Do not
  use it when CLI/server binaries, certification output or another task still needs
  that target. Separate evidence from caches before using full-target cleanup.
- Keep source, Git history, uncommitted/untracked work, configuration/secrets,
  installed dependencies, database volumes, producer journals and required evidence.
  Do not run blanket `git clean -fdx` or `rm -rf .worktrees`.
- After cleanup, verify the intended directories are gone, staging is removed,
  required binaries/evidence remain and Git status has no cleanup-induced changes.
  Report the size/free-space change. Do not rebuild everything just to test cleanup.

## Reference

Cargo's [profiles](https://doc.rust-lang.org/cargo/reference/profiles.html) document
development/test inheritance, debug information and incremental compilation.
The [build-cache layout](https://doc.rust-lang.org/cargo/reference/build-cache.html)
describes workspace targets and internal artifacts;
[`cargo clean`](https://doc.rust-lang.org/cargo/commands/cargo-clean.html) documents
the scope of full-target deletion.
