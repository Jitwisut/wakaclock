# Commands

## Backend (`backend/api`)

The **only** valid Cargo workspace root is `backend/api`. Always `cd` there.

```bash
cd backend/api
cargo run                          # start wakaclock-server (default bin)
cargo build --release
    cargo test                         # workspace unit tests (database tests are opt-in)
cargo test -p wakaclock-core       # single crate
    cargo clippy --workspace --all-targets -- -D warnings
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

### Package manager: npm

`frontend/app/package.json` pins `npm@11.13.0`, and
`frontend/app/package-lock.json` is the only checked-in frontend lockfile.
Netlify and CI use `npm ci`; do not regenerate a pnpm or yarn lockfile.

## Infrastructure

```bash
make infra-up        # Postgres, ClickHouse, Redis
make infra-brokers-up  # Redpanda, RabbitMQ — opt-in, `brokers` compose profile
make infra-down      # stops everything, brokers included
make logs
make help
```

`docker-compose.yml` is the supported local stack. The old
`docker-compose.dev.yaml` and e-commerce/Caddy/Qdrant services are legacy
template material and are not referenced by the live Makefile or server.

Redpanda and RabbitMQ sit behind the `brokers` compose profile because no
server code connects to them yet (see [dead-code.md](dead-code.md)). When a
Kafka or AMQP adapter lands, move them back into `infra-up` and drop the profile.

The root Makefile now points at `backend/api` and `frontend/app`; its `check`,
`test`, `build`, `lint` and `ci` targets are the local equivalents of the
GitHub Actions gates.

## Git hooks

`lefthook` at both [../lefthook.yml](../lefthook.yml) and
[../frontend/app/lefthook.yml](../frontend/app/lefthook.yml). Frontend hooks run
lint-staged on commit, commitlint on commit-msg, `check:strict` on pre-push.
Conventional Commits are enforced
([../frontend/app/commitlint.config.cjs](../frontend/app/commitlint.config.cjs)).
