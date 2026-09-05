# AtoAxis for Zed

This extension is intentionally a thin launcher. Zed sends LSP document lifecycle events to
`wakaclock-ls`; the language server builds privacy-safe AtoAxis heartbeats using the same
`wakaclock-core` and AST/project detection as the CLI.

## Tracking contract

- `didOpen` sends an activity heartbeat.
- `didChange` is coalesced and flushed by `wakaclock-ls` every 30 seconds.
- `didSave` sends an immediate write heartbeat.
- Untitled/non-file buffers are ignored.
- Source text is used locally for language/dependency detection and is never serialized as a
  heartbeat field.

The extension first uses `wakaclock-ls` from the worktree shell `PATH`. If it is not installed,
it downloads the matching `wakaclock-ls-<platform>` asset from the latest GitHub release and
verifies the accompanying `.sha256` digest before execution.

Configure the normal AtoAxis CLI credentials (`WAKACLOCK_API_KEY` / `~/.wakaclock/config.toml`)
before enabling tracking.

## Development

```bash
rustup target add wasm32-wasip2
cargo check --manifest-path extensions/zed/Cargo.toml --target wasm32-wasip2
cargo test --manifest-path extensions/zed/Cargo.toml
```

In Zed, use **Extensions → Install Dev Extension** and choose this directory. A real-host smoke
requires a local Zed installation; CI verifies the WASM build and the launcher contract.
