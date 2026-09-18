# Kafka K3–K5 / RabbitMQ R5 readiness change record — 2026-09-18

## Change identity

- Branch: `features/kafka-rabbitmq-production-readiness`
- Base: `origin/main` at `49834d0`
- Worktree: isolated from the original workspace; existing untracked files were
  left untouched.
- Production defaults remain direct/disabled/fail-closed. No production flag was
  enabled by this change.

## Implemented in this branch

- Added a namespaced full-stack R5 acceptance runner for PostgreSQL, ClickHouse,
  Redis, RabbitMQ and MinIO.
- Added real-worker/API readiness probes for `/live` and `/ready`, with safe
  process cleanup and Compose evidence capture on failure.
- Added deterministic R5 scenarios for projection rebuild, export generation and
  account deletion, including duplicate delivery, lease expiry, upload replay,
  checksum/signed-URL verification and cross-account object isolation.
- Added provider-neutral report delivery, integration sync and billing reconcile
  contracts/fakes. Capabilities remain `available: false` and workers fail closed
  without a production provider/source of truth.
- Added an aggregate RabbitMQ outbox-age metric and retained existing bounded
  Kafka publish/lag/verification and job retry/lease/DLQ metrics.
- Hardened the K0/K3 harness with stable batch identity deduplication, a seeded
  test identity and isolated Redis/MinIO services.
- Added separate CI jobs for heartbeat K3/K4 transport/routing acceptance, K5
  isolated acceptance and R5 full-stack acceptance.
- Added this runbook and kept all migrations additive.

## Evidence captured locally

| Gate | Result | Evidence |
|---|---:|---|
| Formatting | passed | `cargo fmt --all -- --check` |
| Kafka workspace compile | passed | `cargo check --workspace --features kafka` |
| Kafka strict Clippy | passed | `cargo clippy --workspace --all-targets --features 'kafka r5-spike' -- -D warnings` |
| Kafka workspace tests | passed | `cargo test --workspace --features kafka --quiet` |
| K0/K2 isolated matrix | 11/11 | `make kafka-spike` |
| K5 AI usage isolated matrix | 6/6 | `make k5-integration` |
| R5 worker readiness | passed | projection, export, account deletion and API `/live` + `/ready` |
| R5 domain acceptance | 3/3 | `make r5-integration`: projection, export, account deletion |
| Provider-neutral unit tests | 4/4 | provider fake/ledger/idempotency tests |

The local R5 run completed with `r5_status=passed` and cleaned only its isolated
Compose project and test volumes. The K0/K5 local test project may be managed
separately with its matching `make ...-infra-down` target.

## Gates still open

This evidence does not certify production readiness. The following are still
operational gates:

1. A real staging account must run K3 verify for at least 24 hours with zero
   accepted-event loss, mismatch and non-test DLQ.
2. K4 heartbeat must pass load/read-your-writes targets and the allowlist → 5%
   → 25% → 50% → 100% rollout, holding each step for at least 24 hours.
3. K5 needs a real-account verify window, Kafka cohort window, client/CLI 503
   replay evidence and the same staged rollout. Contract-v2 enforcement waits
   for 30 stable days.
4. R5 export/account deletion need staging operational evidence, not only local
   MinIO/ClickHouse/PostgreSQL/Redis/RabbitMQ E2E.
5. `report.deliver`, `integration.sync` and `billing.reconcile` need a chosen
   production provider/source of truth and provider-specific E2E. They remain
   unavailable and must not be enabled.
6. Managed Kafka/RabbitMQ provider selection, TLS/SASL/ACL configuration,
   capacity/load results, alert ownership and deploy/rollback rehearsal remain
   deployment work outside this branch.
