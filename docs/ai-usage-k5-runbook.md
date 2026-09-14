# K5 AI usage Kafka cutover runbook

This runbook covers `/api/v1/ai/usage` only. Heartbeat rollout remains controlled
by `ATOAXIS_INGEST_MODE` and its own cohort.

## Preconditions

Before enabling an AI usage Kafka cohort, complete K0/K3/K4 staging, the real
account 24-hour verify window, parity checks, retry/offline replay checks and the
load/rollback gates. The production Kafka topic is `wakaclock.ai-usage.v1`, with
30-day retention. Use TLS/SASL and ACLs that allow the API to produce, the
`wakaclock.ai-usage.fact-sink` group to consume/produce DLQ, and the verifier group
to consume AI usage and produce only metadata-only DLQ records for malformed or
invalid envelopes.

Required services for `kafka` mode:

- API with `--features kafka` and `ATOAXIS_EVENT_BUS_URL`.
- PostgreSQL for job/outbox state and RabbitMQ for `ai.session.reconcile` relay.
- `ai-usage-ingest` and `ai-session-worker` with the same contract/configuration.

The API must fail closed at boot when a required dependency or cohort is missing;
an absent cohort is never interpreted as `all`.

## Rollout

1. Keep `ATOAXIS_AI_USAGE_INGEST_MODE=direct`, `ATOAXIS_AI_USAGE_REQUIRE_CONTRACT_V2=false`.
   Deploy the new binaries and confirm the v2-capable CLI sends
   `X-AtoAxis-Ai-Usage-Contract: 2`; old clients still receive the legacy response.
2. Set `ATOAXIS_AI_USAGE_INGEST_MODE=verify` and an explicit allowlist cohort.
   Run `ai-usage-verifier` and watch mismatch audits, publish errors, lag and
   end-to-end visibility for at least 24 hours.
3. Set `ATOAXIS_AI_USAGE_INGEST_MODE=kafka` with the same allowlist. Start
   `ai-usage-ingest` and `ai-session-worker`; verify 202/pending responses, fact
   rows, PostgreSQL jobs/outbox rows and session projection convergence for at
   least 24 hours.
4. Expand the contract-v2 cohort in this order: allowlist, 5%, 25%, 50%, 100%.
   Hold every step for at least 24 hours. Do not advance with accepted-event loss,
   non-test DLQ, identity mismatch, or lag above the gate.
5. At 100%, set the heartbeat cohort to `all` only after its independent gate is
   passed, so normal telemetry has no second direct writer.
6. After 30 stable days, set `ATOAXIS_AI_USAGE_REQUIRE_CONTRACT_V2=true` and
   continue retaining `direct`/`verify` in the binary for operator rollback.

## Health and alerts

Check API `/health` and `/metrics`, fact-sink `/live`, `/ready`, and `/metrics`,
verifier `/ready`, and the session-worker `/live`/`/ready`. Alert on consumer lag
at 5 minutes; page and begin rollback at 15 minutes. The normal lag target is
under 60 seconds and API acknowledgement p95 is under 250 ms.

Metrics and logs must contain only bounded topic/category/status labels. Never add
tenant, session, event id, prompt, response, transcript, source path or credential
values to labels or DLQ payloads.

## Rollback

Set `ATOAXIS_AI_USAGE_INGEST_MODE=direct` and
`ATOAXIS_AI_USAGE_REQUIRE_CONTRACT_V2=false`, then restart the API. This accepts
old and new clients again. Leave Kafka consumers running long enough to drain
backlog; do not stop them immediately. Stable usage IDs and payload hashes make
backlog replay converge with direct writes. Keep RabbitMQ jobs running until they
finish or are explicitly cancelled with an audit record.

If ClickHouse is unavailable, the API in Kafka mode can continue acknowledging
after Kafka confirmation while the fact-sink retries. If PostgreSQL is unavailable
after a fact insert, the fact-sink must not commit the Kafka offset; replay must
create the reconcile job/outbox later. If RabbitMQ is unavailable after the job is
written, PostgreSQL remains the source of truth and the relay retries.

## Operator checks

```sh
cargo fmt --all -- --check
cargo check --workspace --features kafka
cargo clippy --workspace --all-targets --features kafka -- -D warnings
cargo test --workspace --features kafka
```

Run the isolated Redpanda + ClickHouse + PostgreSQL + RabbitMQ integration matrix
before any production cohort change. The runner requires explicit endpoints and
uses UUID-scoped Kafka topics plus a namespaced RabbitMQ topology:

```sh
make k5-ai-usage-infra-up
make k5-integration
make k5-ai-usage-infra-down
```

For a CI-like run without the Makefile wrapper, use
`cargo run --bin ai-usage-spike --features ai-usage-spike` with
`KAFKA_TEST_URL`, `CLICKHOUSE_TEST_URL`, `POSTGRES_TEST_URL` and
`RABBITMQ_TEST_URL` set. The harness proves fact insertion, exact replay
deduplication, identity-conflict DLQ, PostgreSQL outbox relay, RabbitMQ delivery,
lease/complete transitions, mixed-model projection and sole-project attribution.
Record counts for accepted events, logical fact rows, session jobs, mismatch audits,
retries and DLQ records in the change ticket. The CI workflow also reruns the K0
11-scenario matrix and preserves isolated broker logs as an artifact on failure.
