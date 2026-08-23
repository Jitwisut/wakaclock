# Conventions

Split into **Existing Convention** (already practiced consistently — follow it)
and **Recommended Convention** (an improvement, *not* a current rule — do not
enforce it on existing code or claim it as project policy).

---

## Existing Convention — Rust

**Naming.** Modules `snake_case`, one per domain concept, with the *same stem*
reused across layers: `handlers/v1/goals.rs` → `services/goals.rs` →
`model/goal.rs`. Keep that alignment when adding a domain.

**Types.** `Arc<AppState>` everywhere for shared state. Repositories and
services are plain structs with `new(...)`, constructed once in
[../backend/api/src/infrastructure/app/init.rs](../backend/api/src/infrastructure/app/init.rs).

**Errors.** `anyhow::Result` + `.context("...")` internally; handlers convert to
`(StatusCode, Json<serde_json::Value>)` with a local `app_error`. No shared
`IntoResponse` error type exists. See [backend/overview.md](backend/overview.md).

**Dependencies.** Pinned once in `[workspace.dependencies]` of
[../backend/api/Cargo.toml](../backend/api/Cargo.toml); members use
`.workspace = true`.

**Logging.** `tracing` (`info!`, `warn!`, `error!`). `TraceLayer` is applied
globally. Do not `println!`.

**Comments.** Doc comments explain *why a decision was made*, especially where
the obvious approach was rejected (see `hash_key` in `middleware/auth.rs`, the
`ReplacingMergeTree` note in `auth_cache.rs`, the timeline note in
`services/duration.rs`). This is a strong house style — match it.

**Tests.** Inline `#[cfg(test)] mod tests` in the file under test. No `tests/`
directory. Pure decision functions split from async DB adapters so they test
without a database.

**Formatting.** [../rustfmt.toml](../rustfmt.toml), [../clippy.toml](../clippy.toml).
`cargo clippy -- -D warnings` must pass.

---

## Existing Convention — TypeScript / React

Template-level style (2-space, single quotes, ~100 cols, `PascalCase.tsx`,
`use-thing.ts`, `@/` alias) is documented in
[../frontend/app/CLAUDE.md](../frontend/app/CLAUDE.md) — not repeated here.

Product-level rules that are **not** in that file:

**No zustand.** `no-restricted-imports` is set to `error` on `zustand` in
[../frontend/app/eslint.config.mjs](../frontend/app/eslint.config.mjs). Use
React Context + `useReducer`. The existing docs are stale on this point.

**All backend access goes through `lib/wakaclock/`.** No bare `axios`/`fetch` in
components. See [frontend/data-layer.md](frontend/data-layer.md).

**Every query key carries `userId`.** Non-negotiable — it is the tenant
isolation boundary in the cache.

**`QueryState` for every panel.** Do not hand-roll loading/error/empty UI.

**Page-local components sit beside the page** in a `components/` folder;
cross-page product components go in `components/wakaclock/`.

**Stories live in `.storybook/stories/**`,** never co-located.

**Avoid large edits in `components/ui/`** — vendored shadcn primitives.

---

## Existing Convention — Repository-wide

**Commits.** Conventional Commits, enforced by commitlint
([../frontend/app/commitlint.config.cjs](../frontend/app/commitlint.config.cjs)):
`feat|fix|docs|refactor|test|chore|ci|build(scope): message`, 100-char header.

**Hooks.** lefthook — lint-staged on commit, commitlint on commit-msg,
`check:strict` on pre-push.

**Editor.** [../.editorconfig](../.editorconfig).

**Security posture.** Analytics responses are per-account private: the global
`Cache-Control: private, no-store` + `Vary: Authorization` layers in `main.rs`
must not be overridden on authenticated routes. Secrets never enter tracked
files — [environment.md](environment.md).

**Bilingual comments.** Some inherited files carry Thai-language doc comments
(mostly in the dead template tree, a few in live repositories). Write new
comments in English; do not mass-translate existing ones as a side effect of
another change.

---

## Recommended Convention — NOT current project rules

Improvements worth making, listed separately so no agent mistakes them for
established practice. **Do not apply these unless the user asks.**

1. **A shared backend error type** implementing `IntoResponse`, replacing the
   per-file `app_error` duplication.
2. **A versioned migration runner** with an applied-migrations ledger, replacing
   idempotent-DDL-on-every-boot — [data/migrations.md](data/migrations.md).
3. **Codegen for the API contract** (utoipa → OpenAPI → TS types) instead of
   hand-mirroring Rust `model/` structs in `lib/wakaclock/types.ts`.
4. **Deleting the dead template tree** (`src/interfaces/`, `src/docs/`,
   `src/model/v1/`, `src/helpers/*`, `backend/api/credentials/`) and fixing the
   root `Cargo.toml` and `Makefile` — [dead-code.md](dead-code.md).
5. **Choosing one package manager** and removing the other lockfiles —
   [commands.md](commands.md).
6. **`X-Forwarded-For` handling** so rate limiting works behind a proxy.
