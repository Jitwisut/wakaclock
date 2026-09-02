# Rust workspace

The live Rust workspace is [`backend/api`](../backend/api). It owns the
server crate and the shared AtoAxis client crates under `backend/api/crates`.

There is intentionally no repository-root `Cargo.toml`: keeping a second
workspace at the repository root caused Cargo to resolve paths that do not
exist and made `cargo` commands depend on the caller's working directory.
Use the root `Makefile`, or pass `--manifest-path backend/api/Cargo.toml`, for
Rust commands.
