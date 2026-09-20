# Client Crates

Four library/binary crates in the `backend/api` workspace. They are the
**client-side** half of the product: they produce heartbeats, the server
consumes them.

## `wakaclock-core`

[../../backend/api/crates/wakaclock-core/src/lib.rs](../../backend/api/crates/wakaclock-core/src/lib.rs)
— shared client logic. Public modules:

| Module | Role |
| --- | --- |
| `heartbeat` | The `Heartbeat` type, `Category`, `EntityType`, `ActivitySegment`, `union_activity_seconds`, `MAX_ACTIVITY_GAP_SECONDS`. **The canonical definition of the wire format.** |
| `api_client` | `ApiClient` — HTTP client for the server |
| `config` | client config (`WAKACLOCK_SERVER_URL`, `WAKACLOCK_API_KEY`, …) |
| `queue` | offline queue (rusqlite-backed) so heartbeats survive being offline |
| `git` | repo/branch detection via `gix` |
| `project` | `resolve_project` — **the only place a project name is decided** (see below) |
| `error` | `AppError` |
| `ai` | AI-assistance detection and attribution |

### Project names: `wakaclock-core::project`

`resolve_project(entity, hint_root)` decides a heartbeat's project from the
entity path with a plain stat walk (no `gix`, so it is safe inside the broker):

1. nearest Git working tree — a linked worktree reports the **main**
   repository's name (`.worktrees/phase8/...` → `wakaclock`);
2. non-Git workspace marker (`pnpm-workspace.yaml`, `lerna.json`, `nx.json`,
   `rush.json`, `package.json` with `workspaces`);
3. `hint_root` (a producer-reported cwd) only if it contains the entity and has
   a manifest;
4. nearest single-project manifest (`Cargo.toml`, `package.json`, …);
5. `None`.

`/`, `$HOME` and its ancestors, temp folders, `~/.claude`, `~/.codex`,
`~/Desktop`, `~/Documents` and `~/Downloads` are never a project root.

Callers: `build_ai_heartbeat` (every agent and source — a transcript or hook
cwd never names a project), `build_heartbeat` (`--project` override → `gix` →
Git from the resolver → `--alternate-project` → non-Git markers) and Codex's
`effective_project_root`. **Do not add another name-deriving path** (cwd
basename, nearest manifest); that is how `wakaclock-core`, `vscode`, `api`,
`app`, `phase8` and `tmp` each became dashboard projects.

### `wakaclock-core::ai`

Parses AI coding-agent session logs and turns them into attributed edit events.
Per-agent parsers: `claude.rs` (Claude Code), `codex.rs`, `gemini.rs`, plus
`jsonl.rs`, `patch.rs`, `correlation.rs`, `follow_up.rs`, `state.rs`, `usage.rs`.

Test fixtures — real captured session logs — live under
`backend/api/crates/wakaclock-core/src/ai/fixtures/{claude_code,codex,gemini_cli}/`.
**When changing a parser, add a fixture rather than a synthetic string.**

Crate-local docs worth reading before touching this area:
`backend/api/crates/wakaclock-core/src/ai/CAPABILITIES.md` and
`backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md`.

## `wakaclock-ast`

[../../backend/api/crates/wakaclock-ast/src/lib.rs](../../backend/api/crates/wakaclock-ast/src/lib.rs)
— tree-sitter language detection. Public surface is deliberately tiny:
`detect()` and `AstResult`. Internals (`cache`, `detector`, `languages`, `pool`)
are private modules; keep them that way.

Feeds the `ast_language` / `ast_confidence` heartbeat columns. This is the
**only** source of `Heartbeat.language` — no client passes a language over the
wire (see [../extensions/overview.md](../extensions/overview.md)), so a
language missing here means every heartbeat for that file type has
`language: null`, full stop.

**Do not treat [`handlers/v1/catalog.rs`](../../backend/api/src/handlers/v1/catalog.rs)'s
`LANGUAGES` list as a coverage list.** That's ~167 names for the dashboard's
filter dropdown, independent of this crate. A name appearing there proves
nothing about whether `wakaclock-ast` can produce it.

### Detection tiers

Two tiers, dispatched from `languages::candidates_for_extension` /
`detector::detect_static_asset`:

1. **Tree-sitter** (`languages.rs` `candidates_for_extension`) — real parse,
   variable `ast_confidence` from the parser's error ratio, real
   `dependencies` (import/use statements) for the languages this crate
   predates (Rust, Python, JavaScript, TypeScript, TSX, Go, C, C++,
   Objective-C — heuristic via the C grammar, see below) plus Swift, Java,
   Kotlin, Dart, C#, Ruby, PHP, R, Solidity. Everything else added across the
   language-coverage push that brought this crate from 22 languages to 169
   of the catalog's 174 names — see below for how those two numbers relate —
   (SQL, Lua, PowerShell, Fish, GLSL, HLSL, the Backend/general-purpose,
   Infra-as-code/build, Systems/low-level, Scripting/shell-adjacent, final
   Query/Scientific/Shader/Academic/Templating/Markup, and Chroma-diff
   batches — Julia, SAS, GDScript, Prolog, Agda, Diff, Vim script, SPARQL,
   Protobuf, Cuda, Arduino, SourcePawn, Starlark, Puppet, Zig and more) gets
   real parsing too, but **no dependency extraction** —
   `extract_dependencies` returns `vec![]` for all of it, same as `Text` in
   the static tier below. Added for detection only; nothing about any of it
   is harder to extract from, just out of scope for those passes. Two special
   cases worth knowing before you next touch this file: Bazel has no
   grammar of its own — its BUILD/BUILD.bazel/WORKSPACE/WORKSPACE.bazel files
   and `.bzl` libraries are Starlark syntax, parsed by `tree-sitter-starlark`
   (also used directly for plain `.star` files, labeled "Starlark"). CMake's
   primary, near-universal filename is `CMakeLists.txt`, extension `.txt` —
   see the filename-guard gotcha below for why that needed special handling,
   not an extension arm.
2. **Static** (`detector.rs` `detect_static_asset`) — extension or filename
   trusted as-is, fixed `confidence: 1.0`, no real parse. Runs *before* the
   tree-sitter tier and returns early, so a static arm permanently shadows any
   later tree-sitter addition for that extension. Roughly 80 languages here by
   now — HTML/CSS/YAML/JSON/etc. and every WakaTime-internal pseudo-format
   (Env, Text, Dockerfile, Makefile) predating the coverage push, template
   languages (Vue, Svelte, Blade, Jinja, …), and the rest of the catalog that
   has no usable tree-sitter grammar: no crate published at all, the crate's
   only release (or *every* release, checked back to 0.1.0 — those aren't the
   same claim, see the gotchas) is ABI 15 with nothing to fall back to, the
   crate is a placeholder with no parser inside despite a real version number
   (`tree-sitter-cobol`), or every release pins a `tree-sitter` dependency
   range that excludes this workspace's 0.24 (the Elm/Emacs-Lisp/BitBake
   pattern — Squirrel, Lean, Org and OpenSCAD hit this too, see the Cargo.toml
   comment on the final batch). Don't hand-count this tier from the code to
   answer "how many" — diff `catalog.rs`'s `LANGUAGES` list against both
   tiers' source instead, the way every count in this file was produced.

As of this writing the catalog (`catalog.rs`'s `LANGUAGES`, 179 names) and
this crate's coverage are both moving targets across two different growth
paths, and they don't stay in lockstep — re-diff rather than trust a number
here verbatim:

- **Catalog-diff coverage.** This crate covers 177 of the catalog's 179
  names. The catalog itself has also grown past its original ~167-name list,
  twice now, via **Chroma-diff batches**: comparing this crate's coverage
  against [Chroma](https://github.com/alecthomas/chroma) — the syntax
  highlighter WakaTime's own FAQ names as its language detector — surfaces
  languages worth having that the original catalog never listed as an option
  at all. First batch: CSV, GraphQL, Puppet, Nu, Zig (Zig already existed in
  the catalog; the other four were added to `catalog.rs` alongside their
  detection). Second batch: Haxe, Standard ML, VB.net, Sass, reStructuredText
  (all five newly added to `catalog.rs`). Across both, only Puppet, Zig and
  reStructuredText got real tree-sitter grammars — CSV, GraphQL, Nu, Haxe,
  Standard ML, VB.net and Sass are static tier (CSV and GraphQL each have a
  crate that turned out unusable; Nu, Haxe, Standard ML, VB.net and Sass have
  none published at all). Bumped `LANGUAGE_REGISTRY_VERSION` in `catalog.rs`
  with each batch, since the list's content changed, not just this crate's
  coverage of it. **When you next add a language wholesale-absent from
  `catalog.rs` (found by diffing against Chroma, Linguist, or anywhere else),
  add it to `catalog.rs`'s `LANGUAGES` too, alphabetically — this crate
  detecting a language the dashboard's filter dropdown doesn't know about is
  a silent half-finished feature, not a smaller version of the same
  feature.** Chroma itself still lists on the order of 170+ names this crate
  doesn't cover even after two diff passes — a large share of that gap is
  Chroma's much finer granularity (multiple CPU-specific assembly dialects,
  per-templating-engine variants, per-config-tool lexers) rather than
  distinct languages in the sense this catalog cares about; closing more of
  it is a product decision about how much of that granularity is worth
  surfacing, not just an engineering backlog.
- **A `catalog.rs` entry can be invisible to a naive extraction script even
  though it's real and always was.** XQuery sat in `catalog.rs` from before
  this whole language-coverage effort started, but the very first
  session-start capture of the list (a line-range `sed` grab) missed it —
  and, harmlessly since it was already detected, YAML too — so it never
  appeared in any "N languages left" count or list produced across the
  entire effort until specifically re-diffing the live file against that
  original capture surfaced the gap. If a coverage count in this file or a
  session ever looks static-tier levels of large for the batch that was
  actually attempted, re-derive the current catalog list from
  `catalog.rs` directly (`awk '/^const LANGUAGES/,/^\];/' ... catalog.rs`)
  rather than reusing an earlier capture — it can go stale in ways that hide
  real gaps, not just count them wrong.

**Two catalog languages have no detection and are staying that way, not
temporarily uncovered — check before spending time on either:**

- **Matlab** — its only real-world extension, `.m`, is already Objective-C's
  in this crate, with working grammar-based detection. That's a genuine,
  widely-known ambiguity (every language-detection tool resolves it with
  content heuristics, not extension alone) and Matlab's own grammar isn't
  even usable here regardless (every `tree-sitter-matlab` release, back to
  its oldest, is ABI 15 — see the gotchas). Deliberately left unmapped rather
  than fighting Objective-C for `.m` with a guess.
- **HACL** — genuine uncertainty about what this catalog entry even refers to
  (no confidently-identifiable file extension convention found), and
  assigning a plausible-sounding but unverified one risks mislabeling real
  files. Left unmapped rather than guessed.

If asked to add either, that's a product decision (accept the Matlab/
Objective-C ambiguity, or find a verified HACL convention), not a quick
follow-up to this batch.

### Adding a language — known gotchas, from having hit both

- **Check the grammar's tree-sitter ABI before writing any code**, not after:
  ```bash
  curl -s "https://static.crates.io/crates/<crate>/<crate>-<version>.crate" -o t.crate
  tar xzf t.crate && grep LANGUAGE_VERSION <crate>-<version>/src/parser.c
  ```
  The workspace runtime (`tree-sitter` in `Cargo.toml`) is pinned to ABI 14.
  A grammar crate whose newest release is ABI 15 (tree-sitter-swift 0.7.x,
  tree-sitter-dart 0.1.0+ both were) compiles fine — `Parser::set_language`
  fails **silently at runtime** instead, and `detect()` just returns `None`
  with no error. Walk back to the newest ABI-14 release instead of bumping the
  workspace's `tree-sitter` (that reopens every existing grammar's ABI
  compatibility, not just the one you're adding).
- **Check the Rust binding's export name per crate.** Most grammars export
  `pub const LANGUAGE: LanguageFn` (`.into()` into a `Candidate`). Older or
  ABI-14-pinned releases (`tree-sitter-dart` 0.0.4, `tree-sitter-kotlin`
  pre-`-ng`) export `pub fn language() -> Language` instead — call it
  directly, no `.into()`.
- **`looks_like_objective_c` in `languages.rs` false-positives on substrings.**
  It used to match bare `"@property"`, which is also a substring of Swift's
  `@propertyWrapper` — any Swift file using one got mis-scored toward
  Objective-C. Any new indicator string added there needs a boundary check,
  not `str::contains`.
- **An ABI break can land in a patch release, inside a version range you'd
  expect to be safe.** `tree-sitter-c-sharp` 0.23.1 is ABI 14 and 0.23.5 is
  ABI 15 — same `0.23.x` line. A bare `"0.23"` requirement would silently pick
  up the broken patch on the next `cargo update`. Every grammar added past
  Swift/Java/Kotlin/Dart is exact-pinned (`"=x.y.z"` or Cargo's implicit exact
  match for `"0.0.z"`) rather than range-pinned, specifically because of this.
- **A crate predating the `tree-sitter-language` FFI shim links its own
  `tree-sitter` version directly, and that's a compile error, not an ABI
  mismatch.** `tree-sitter-sql` 0.0.2 (the only release) depends on
  `tree-sitter = "0.19"`; its `Language` type doesn't unify with this crate's
  `tree-sitter 0.24` `Language` at all — `cargo build` fails with "multiple
  different versions of crate `tree_sitter`", immediately, not at runtime.
  There's no version to walk back to for a crate with only one release; the
  fix was a different grammar entirely (`tree-sitter-sequel`, the
  actively-maintained derekstride/tree-sitter-sql grammar — crates.io name
  differs from its GitHub repo name, Rust module is `tree_sitter_sequel`).
- **`node-types.json` can advertise a field the grammar doesn't actually
  assign in the common case.** C#'s `using_directive` node-types entry lists a
  `name` field, but `using System;` parses as `(using_directive (identifier))`
  with the child completely unlabeled — only the alias/static-using variants
  populate the field. `child_by_field_name` silently returns `None` here;
  don't trust node-types.json's field list without parsing a real sample
  (`tree_sitter::Parser` + `.to_sexp()` on a throwaway `examples/` binary is
  the fast way to check).
- **A crate linking `tree-sitter` directly isn't automatically the SQL-crate
  problem above — check the requirement's bounds, not just its presence.**
  `tree-sitter-fish` depends on `tree-sitter = ">=0.22.0"` (unbounded) rather
  than the `tree-sitter-language` shim, and that unifies fine with this
  crate's `tree-sitter 0.24` at compile time. `tree-sitter-sql`'s `"0.19"` is
  the same shape of dependency but a narrow, pre-1.0 range that excludes
  0.24 entirely. Don't reject a grammar for linking `tree-sitter` directly —
  just try the build; a real conflict fails loudly (E0308, "multiple
  different versions of crate `tree_sitter`") and is cheap to detect.
- **Sometimes there's no ABI-14 release to walk back to at all.**
  `tree-sitter-hcl` has exactly one release (1.1.0) and it's ABI 15 — unlike
  Swift/Dart/C#/PowerShell/Solidity, there's no older patch to pin. HCL is
  handled by the static tier instead (`detect_static_asset`, `.hcl`/`.tf`/
  `.tfvars`). This is a legitimate permanent outcome for a language, not just
  a stepping stone — check the full version list (crates.io's version-history
  page, or walk the local sparse-index cache at
  `~/.cargo/registry/index/*/.cache/<2-letter>/<2-letter>/<crate-name>`) before
  concluding a language needs the static tier.
- **A version can be ABI 14 and still be unusable, for a third reason: its own
  `tree-sitter` dependency range, not the grammar's ABI.** `tree-sitter-elm`
  and `tree-sitter-elisp` each have an ABI-14 release (5.6.6/5.7.0 and 1.4.0/
  1.5.0 respectively), but every ABI-14 release of both predates their move to
  the `tree-sitter-language` shim and instead pins a direct `tree-sitter =
  "0.20.x"` dependency. Because `tree-sitter` declares `links = "tree-sitter"`
  in its manifest, Cargo allows only **one** version of it anywhere in the
  build — this fails as a dependency-resolution error ("failed to select a
  version for `tree-sitter`" / a `links` conflict) the moment `cargo build`
  tries to unify it with every other grammar's `^0.24`, not as a Rust type
  mismatch (that's the SQL crate's failure mode) and not silently at runtime
  (that's the plain ABI-15 failure mode). Three different failure modes for
  "grammar's tree-sitter version doesn't match ours" — know which one you're
  looking at. Concretely: an old-binding-style crate (`fn language() ->
  Language`, no `LanguageFn`) is a signal to check its OWN `Cargo.toml`
  `tree-sitter` requirement before picking a version, not just that version's
  ABI number — `grep -A2 '^\[dependencies\]' <crate>-<version>/Cargo.toml.orig`
  after extracting the `.crate` tarball. When every ABI-14 release also fails
  this check, that's static tier, same as HCL.
- **A crate linking `tree-sitter` directly isn't automatically the SQL-crate
  problem above — check the requirement's bounds, not just its presence.**
  `tree-sitter-fish` depends on `tree-sitter = ">=0.22.0"` (unbounded) rather
  than the `tree-sitter-language` shim, and that unifies fine with this
  crate's `tree-sitter 0.24` at compile time. `tree-sitter-sql`'s `"0.19"` is
  the same shape of dependency but a narrow, pre-1.0 range that excludes
  0.24 entirely. Don't reject a grammar for linking `tree-sitter` directly —
  just try the build; a real conflict fails loudly (E0308, "multiple
  different versions of crate `tree_sitter`") and is cheap to detect.
- **Sometimes there's no ABI-14 release to walk back to at all.**
  `tree-sitter-hcl` has exactly one release (1.1.0) and it's ABI 15 — unlike
  Swift/Dart/C#/PowerShell/Solidity, there's no older patch to pin.  HCL is
  handled by the static tier instead (`detect_static_asset`, `.hcl`/`.tf`/
  `.tfvars`). This is a legitimate permanent outcome for a language, not just
  a stepping stone — check the full version list (crates.io's version-history
  page, or walk the local sparse-index cache at
  `~/.cargo/registry/index/*/.cache/<2-letter>/<2-letter>/<crate-name>`) before
  concluding a language needs the static tier.
- **A grammar's primary file often isn't reachable by extension at all —
  check the language's actual convention, not just what extension its name
  suggests.** `CMakeLists.txt`'s extension is `.txt`, which `detect_static_asset`
  claims as plain Text before the tree-sitter tier ever runs; Meson's own
  files (`meson.build`, `meson.options`, `meson_options.txt`) have no
  extension of their own at all. Both needed an exact filename check ahead of
  the generic extension match — `CMakeLists.txt`'s guard lives in
  `languages.rs::candidates_for` (it needs the real grammar, so it has to
  return `None` out of `detect_static_asset` and let the tree-sitter tier
  handle it — see that function's comment); Meson's is entirely in the static
  tier since it has no grammar. The same issue bites picking a *new*
  extension for an unrelated language: ApacheConf's conventional names
  (`httpd.conf`, `apache2.conf`) carry `.conf`, which INI already owns here —
  its filename guard has to run *before* the `"ini" | "cfg" | "conf"` arm or
  it silently becomes INI. Test the collision, not just the happy path
  (`apacheconf_filenames_do_not_regress_to_ini` in `detector.rs`).
- **ABI compatibility is backward, confirmed rather than assumed on this
  round.** `tree-sitter-nix` 0.3.0 (its only release) is ABI 13, one below
  the ABI-14 target everything else here pins to, and it compiled and passed
  detection tests without incident — a runtime built for ABI N also loads
  grammars built for any ABI ≤ N. Useful when a crate's only release sits
  below the target ABI instead of above it (the usual failure direction in
  this file): that's not automatically a dead end the way ABI 15 is, verify
  with a real build before assuming it needs the static tier.
- **A crate name existing on crates.io doesn't mean it contains a grammar —
  check what's actually inside before probing its ABI.** `tree-sitter-cobol`
  0.1.0 is the only release of that name, has no `parser.c`, no
  `bindings/rust/`, nothing but a `src/main.rs` — a squatted or placeholder
  crate name, not a parser. `cargo add --dry-run` succeeding and a version
  number existing are not evidence of a usable grammar; extract the `.crate`
  tarball and look (`find <crate>-<version> -maxdepth 3`) before spending
  time on ABI probing.
- **"Only ABI 15" and "never had an ABI-14 release" look identical from the
  latest version alone — they aren't the same claim, and only one of them
  needs the crate's full version history checked.** HCL and VHDL (single
  release, ABI 15) are simply new grammars with no earlier release to have
  been ABI 14 at. SystemVerilog, Batchfile (`tree-sitter-batch`) and
  AutoHotkey each have many releases (SystemVerilog: 6, Batchfile: 16,
  AutoHotkey: 12) and *every one* is ABI 15, checked all the way back to each
  crate's 0.1.0 — these authors' tooling was already on ABI 15 from the
  start, there's no "walk back to the version before the break" move
  available the way there was for Swift/Dart/C#/PowerShell/Solidity/Scala/
  Fortran. Functionally the same outcome (static tier), but don't stop at
  version 2 or 3 back and conclude "no ABI-14 release" without having
  actually checked the crate's full history.
- **A narrow direct `tree-sitter` dependency isn't automatically the Elm/
  Emacs-Lisp dead end — check whether the range happens to include this
  workspace's exact pinned patch, `0.24.7`.** `tree-sitter-sourcepawn` 0.7.8
  is ABI 14 and pins `tree-sitter = "~0.24.0"` directly (not the shim) — that
  tilde range is `>=0.24.0, <0.25.0`, which does contain `0.24.7`, so it
  built without a `links` conflict. Squirrel's `~0.20.9`, Lean4's `0.25` and
  Org's `>= 0.19, < 0.21` don't contain it, so those really are dead ends.
  Same underlying check as the SQL-vs-Fish distinction earlier in this list,
  just easy to skip once "narrow direct dependency" starts pattern-matching
  to "give up" — read the actual range against `0.24.7`, don't just check
  whether it's narrow.
- **A crate export name found once for a language isn't safe to assume for
  the version you actually land on.** `tree-sitter-cuda` 0.21.1 (checked
  first, turned out to be ABI 15) exports `LANGUAGE_CUDA`; the ABI-14 release
  actually used, 0.21.0, exports the same `LANGUAGE_CUDA` — no surprise
  there, but it's a coincidence, not a rule, and it's the kind of thing that
  produces a `cannot find value LANGUAGE in crate` compile error if assumed
  rather than checked on the exact pinned version. Verify the binding on the
  version in the `Cargo.toml` pin, not on whichever version you happened to
  probe first.

## `wakaclock-cli`

[../../backend/api/crates/wakaclock-cli/src/main.rs](../../backend/api/crates/wakaclock-cli/src/main.rs)
— clap-based CLI. Composes `wakaclock-ast::detect` with `wakaclock-core`'s
heartbeat, queue, git and AI parsers. `agent_service.rs` handles AI-agent
session discovery.

This is the binary the VS Code extension shells out to
([../extensions/overview.md](../extensions/overview.md)).

## `wakaclock-ls`

[../../backend/api/crates/wakaclock-ls/src/main.rs](../../backend/api/crates/wakaclock-ls/src/main.rs)
— `tower-lsp` language server, single file. Editor-agnostic tracking for editors
without a native plugin.

## Rules

- **The heartbeat wire format lives in `wakaclock-core::heartbeat`.** If you
  change it, update the server's
  [../../backend/api/src/model/heartbeat.rs](../../backend/api/src/model/heartbeat.rs)
  and the ClickHouse DDL in
  [../../backend/api/src/repository/heartbeat.rs](../../backend/api/src/repository/heartbeat.rs)
  in the same change. Three places, one format.
- Client crates must not depend on `wakaclock-server`. The dependency runs one
  way: server ← (nothing); cli/ls → core, ast.
- Version pins are declared once in
  `[workspace.dependencies]` of
  [../../backend/api/Cargo.toml](../../backend/api/Cargo.toml). Member crates
  reference them with `.workspace = true` — do not pin a version in a member
  `Cargo.toml`.
