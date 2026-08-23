# Commands

## Backend (`backend/api`)

The **only** valid Cargo workspace root is `backend/api`. Always `cd` there.

```bash
cd backend/api
cargo run                          # start wakaclock-server (default bin)
cargo build --release
cargo test                         # inline #[cfg(test)] modules, ~31 files
cargo test -p wakaclock-core       # single crate
cargo clippy -- -D warnings
cargo fmt                          # config: ../../rustfmt.toml
cargo watch -x run                 # requires cargo-watch
```

Client binaries live in the same workspace:

```bash
cd backend/api && cargo run -p wakaclock-cli
cd backend/api && cargo run -p wakaclock-ls
```

## Frontend (`frontend/app`)

`package.json` is at `frontend/app/package.json`, **not** `frontend/`.

```bash
cd frontend/app
npm run dev            # Turbopack dev server, :3000
npm run build
npm run typecheck      # tsc --noEmit
npm run lint:strict    # eslint --max-warnings=0
npm run test:run       # vitest once
npm run test:e2e       # playwright
npm run validate       # typecheck + lint:strict + test:run
npm run check:strict   # full CI gate (adds coverage, storybook, madge, knip)
npm run storybook      # :6006
```

The full script list (Storybook audits, Chromatic, knip, madge) is documented
in [../frontend/app/CLAUDE.md](../frontend/app/CLAUDE.md) — not repeated here.

### Package manager: `Unknown / Needs verification`

Conflicting signals, all present in the repo today:

- `frontend/app/pnpm-lock.yaml` — tracked, most recently updated (2026-08-23).
- `frontend/app/package-lock.json` — tracked, older (2026-07-26).
- `frontend/package-lock.json` — tracked, stray, no sibling `package.json`.
- `.pnpm-store/` at repo root.
- `Makefile` uses `pnpm` for frontend targets.
- `netlify.toml` builds with `npm run build`.
- `frontend/app/CLAUDE.md` says `npm ci`.
- No `packageManager` field in `frontend/app/package.json`.

**Guidance:** match whatever the user is already using in the session; do not
regenerate or delete a lockfile. Netlify (the deployed path) uses npm.

## Infrastructure

```bash
make docker-up        # docker-compose up: postgres, clickhouse, redis, redpanda,
                      # rabbitmq, ch-ui  (see docker-compose.yml)
make docker-down
make docker-logs
make docker-status
make clickhouse-cli
make help             # 130+ targets, self-documenting
```

`docker-compose.dev.yaml` additionally defines `qdrant` and `caddy`. Neither
Redis, RabbitMQ, Redpanda nor Qdrant is used by the running server — see
[dead-code.md](dead-code.md).

## Broken Makefile targets — do not use

[../Makefile](../Makefile) sets `FRONTEND_DIR = frontend`, but `package.json`
lives in `frontend/app`. These therefore fail:

- `make dev-frontend`, `make build-frontend`, `make test-frontend`
- `make dev` (invokes `dev-frontend`)
- `make build`, `make test` (invoke the above)

Also `make dev-worker` runs `cargo run --bin worker`; no `worker` binary is
defined in [../backend/api/Cargo.toml](../backend/api/Cargo.toml).

Use the explicit `cd backend/api` / `cd frontend/app` commands above instead.
The Makefile header still reads "Multi-Shop eCommerce Connector" — it is
inherited template tooling and only partly adapted.

## Git hooks

`lefthook` at both [../lefthook.yml](../lefthook.yml) and
[../frontend/app/lefthook.yml](../frontend/app/lefthook.yml). Frontend hooks run
lint-staged on commit, commitlint on commit-msg, `check:strict` on pre-push.
Conventional Commits are enforced
([../frontend/app/commitlint.config.cjs](../frontend/app/commitlint.config.cjs)).
