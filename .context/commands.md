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
make infra-up        # Postgres, ClickHouse, Redis, RabbitMQ
make infra-kafka-up  # Redpanda — opt-in, `kafka` compose profile
make infra-down      # stops everything, Redpanda included
make logs
make help
```

`docker-compose.yml` is the supported local stack. The old
`docker-compose.dev.yaml` and e-commerce/Caddy/Qdrant services are legacy
template material and are not referenced by the live Makefile or server.

Redpanda is started by the local baseline and is consumed only by feature-enabled
workers. Use `make dev-heartbeat-enrichment`, `make dev-ai-usage-ingest` or
`make dev-ai-usage-verifier` after setting the matching rollout mode.

RabbitMQ adapter tests are opt-in like the ClickHouse ones and need their own
URL, never the application's `ATOAXIS_JOB_QUEUE_URL`:

```bash
cd backend/api && RABBITMQ_TEST_URL='amqp://guest:guest@127.0.0.1:5672/%2f' \
  cargo test --bin wakaclock-server rabbitmq -- --ignored --test-threads=1 \
  --skip survive_a_broker_restart
```

`jobs_and_scheduled_retries_survive_a_broker_restart` runs `docker restart` on the
container named by `RABBITMQ_TEST_RESTART_CONTAINER`; point it only at a disposable
broker. CI skips it by name.

The root Makefile now points at `backend/api` and `frontend/app`; its `check`,
`test`, `build`, `lint` and `ci` targets are the local equivalents of the
GitHub Actions gates.

## Git hooks

`lefthook` at both [../lefthook.yml](../lefthook.yml) and
[../frontend/app/lefthook.yml](../frontend/app/lefthook.yml). Frontend hooks run
lint-staged on commit, commitlint on commit-msg, `check:strict` on pre-push.
Conventional Commits are enforced
([../frontend/app/commitlint.config.cjs](../frontend/app/commitlint.config.cjs)).

## Team Phase 2 isolated verification

See [../docs/atoaxis-team-phase2.md](../docs/atoaxis-team-phase2.md).
`python3 scripts/team-restore-drill.py` uses only disposable synthetic PostgreSQL/ClickHouse
containers; it does not use application credential/config files. The two source fixtures
remain available for regression tests; stop only those named fixtures when finished.
`cargo run --bin team-privacy-worker -- --initialize-ledger` requires rollout disabled
and a missing independent ledger. `--reconcile-restore` requires a verified fresh existing
ledger and leaves sharing disabled. Normal worker and `--once` must not initialize missing state.
No command here authorizes a production rollout, schema rollback, main push or merge.
