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
| `error` | `AppError` |
| `ai` | AI-assistance detection and attribution |

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

Feeds the `ast_language` / `ast_confidence` heartbeat columns.

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
