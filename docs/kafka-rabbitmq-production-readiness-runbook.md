# Kafka/RabbitMQ production-readiness runbook

This runbook is the operational companion for Kafka K3/K4/K5 and RabbitMQ R5.
It describes the evidence required before changing a production flag. A green
compile or a local unit-test run is not a rollout approval.

## Safe defaults

Keep these values in every production deployment until the corresponding gate is
signed off:

```text
ATOAXIS_INGEST_MODE=direct
ATOAXIS_AI_USAGE_INGEST_MODE=direct
ATOAXIS_AI_USAGE_REQUIRE_CONTRACT_V2=false
ATOAXIS_PROJECTION_REBUILD_MODE=sync
ATOAXIS_EXPORT_MODE=disabled
ATOAXIS_ACCOUNT_DELETION_MODE=disabled
```

`direct` is the Kafka break-glass path. The direct implementation must remain
in the binary after Kafka reaches 100%. Provider-dependent R5 workers remain
fail-closed until a real provider/source of truth has been selected and its
provider-specific E2E suite is merged.

## Local acceptance topology

The isolated Compose file provides PostgreSQL, ClickHouse, Redis, Redpanda,
RabbitMQ and MinIO. Each runner uses a separate Compose project and the harness
adds a UUID namespace to Kafka topics, consumer groups, RabbitMQ exchanges and
queues. Never point these targets at a shared database or production broker.

```sh
# K0/K3/K4 transport and routing matrix
make kafka-spike-infra-up K0_COMPOSE_PROJECT=wakaclock-k3-k4
make kafka-spike K0_COMPOSE_PROJECT=wakaclock-k3-k4
make kafka-spike-infra-down K0_COMPOSE_PROJECT=wakaclock-k3-k4

# K0 + K5 AI usage fact/session matrix
make k5-integration K5_COMPOSE_PROJECT=wakaclock-k5

# R5 readiness, real workers, outbox relay, RabbitMQ and cross-store checks
make r5-integration R5_COMPOSE_PROJECT=wakaclock-r5
```

`make r5-integration` starts the real API, projection worker, export worker and
account-deletion worker, waits for `/live` and `/ready`, then runs the isolated
domain harness. It cleans only the `wakaclock-r5` containers and test volumes.
On CI, set `R5_EVIDENCE_DIR` to retain sanitized Compose logs on failure.

## Health checks

Check liveness first, then readiness. A successful `/live` does not mean that a
worker has connected to PostgreSQL, ClickHouse and RabbitMQ.

```sh
curl --fail http://127.0.0.1:28080/live
curl --fail http://127.0.0.1:28080/ready
curl --fail http://127.0.0.1:28086/live   # projection.rebuild
curl --fail http://127.0.0.1:28086/ready
curl --fail http://127.0.0.1:28082/ready   # export.generate
curl --fail http://127.0.0.1:28087/ready   # account.delete
```

For a deployed instance, substitute the service DNS names and configured
health ports. Confirm the broker-side view as well:

```sh
rpk topic describe wakaclock.heartbeat.v1
rpk topic describe wakaclock.ai-usage.v1
rabbitmq-diagnostics -q check_port_connectivity
rabbitmqctl list_queues name messages consumers
```

Do not paste command output containing broker URLs, credentials, payloads or
tenant identifiers into a ticket.

## Metrics and evidence

Scrape `/metrics` from the relevant API/worker process. Labels are restricted to
bounded service/topic/category/result values. Never add a user ID, event ID,
job ID, path, prompt, source, token, credential or raw error payload to a label,
log field or DLQ body.

The minimum gate dashboard contains:

- Kafka publish acknowledgements, publish errors, acknowledgement latency,
  consumer lag, retry/DLQ counts, verification mismatches and oldest record age.
- RabbitMQ job deliveries, success/failure/retry/dead-letter counts, lease-loss
  and lease-sweep counts, processing latency and `oldest_outbox_age_seconds`.
- API/worker `/live` and `/ready` status, readiness transitions and lease
  expiration/requeue evidence.

For every rollout step retain only aggregate evidence: accepted count, durable
count, logical duplicate count, mismatch count, non-test DLQ count, lag p95,
ack p95, ClickHouse visibility p95, retry count and rollback result.

## K3/K4 heartbeat rollout

1. Run the isolated transport matrix and confirm accepted-event loss, logical
   duplicates, verifier mismatches and non-test DLQ are all zero.
2. In staging, set `ATOAXIS_INGEST_MODE=verify` with a small explicit user
   allowlist. Keep ClickHouse as the authoritative write path. Run the verifier
   for at least 24 hours.
3. Confirm single and bulk heartbeat, server-generated IDs, replay, out-of-order
   revisions, consumer restart/rebalance, Kafka outage, ClickHouse delay and
   malformed-event metadata-only DLQ behavior.
4. Switch only the allowlist to `ATOAXIS_INGEST_MODE=kafka`. Before moving on,
   confirm API acknowledgement p95 is below 250 ms, ClickHouse visibility p95 is
   below 3 seconds and normal consumer lag is below 60 seconds.
5. Expand in this exact order: explicit team allowlist, 5%, 25%, 50%, 100%.
   Hold every step for at least 24 hours. Stop immediately on mismatch, accepted
   loss, non-test DLQ or lag above the gate.
6. Users outside the cohort must remain on the direct path. A Kafka publish
   failure for an in-cohort user is `503 Service Unavailable` with
   `Retry-After`; it must not be reported as an accepted heartbeat.

### K4 rollback

Set `ATOAXIS_INGEST_MODE=direct`, restart the API, and keep consumers running
long enough to drain the existing Kafka backlog. Verify that direct and replayed
records converge and that no tombstoned account is repopulated. Record the flag
change time, backlog before/after, mismatch count and final ClickHouse counts.

## K5 AI usage rollout

K5 is independent from heartbeat. Keep the AI usage cohort and contract flag
separate from `ATOAXIS_INGEST_MODE`.

1. Deploy with `ATOAXIS_AI_USAGE_INGEST_MODE=direct` and
   `ATOAXIS_AI_USAGE_REQUIRE_CONTRACT_V2=false`.
2. Run verify mode on an allowlist for 24 hours. Confirm payload-hash conflicts
   go to sanitized DLQ, and no verifier mismatch or non-test DLQ remains.
3. Run Kafka mode on the same allowlist for 24 hours. Confirm `202 Accepted`,
   `processing_state=pending`, idempotent fact rows, durable
   `ai.session.reconcile` jobs/outbox rows and session convergence.
4. Expand contract-v2 users allowlist → 5% → 25% → 50% → 100%, holding each
   step for at least 24 hours. `make k5-integration` is a mandatory CI gate.
5. After 30 stable days, set
   `ATOAXIS_AI_USAGE_REQUIRE_CONTRACT_V2=true`. Keep direct/verify compiled as
   break-glass rollback modes.

### K5 failure and rollback rules

Do not commit a Kafka offset until the fact and reconcile job/outbox are durable.
For ClickHouse, PostgreSQL, RabbitMQ, consumer-crash, duplicate-delivery,
mixed-model and account-tombstone failures, retry/replay must be observable and
idempotent. Roll back to direct mode if the 503/Retry-After contract, durable
fact, identity ledger or session convergence gate fails.

## RabbitMQ R5 rollout

### `projection.rebuild`

Keep `ATOAXIS_PROJECTION_REBUILD_MODE=job` opt-in until the full-stack suite
proves deterministic child-job IDs, duplicate delivery, lease expiry, broker
restart and worker restart. Live ingest and rebuild must not move a projection
backward or add a logical duplicate.

### `export.generate`

Use MinIO in CI as the production-like S3 boundary. The gate is API request →
PostgreSQL job/outbox → RabbitMQ → export worker → object upload → completed
job. Verify signed URL expiry, checksum, content type, row/byte bounds,
tenant ownership, idempotency replay and worker death after upload. Only then
set `ATOAXIS_EXPORT_MODE=job`.

### `account.delete`

This is destructive and must be promoted last. Verify tombstone/account lock,
ingest stop, queued-job retirement, PostgreSQL allowlist deletion, ClickHouse
fact/projection deletion, Redis/session cleanup, S3 artifact deletion and
metadata-only completion audit. Repeat crash/restart and duplicate delivery at
each boundary, plus cross-account isolation. Only then set
`ATOAXIS_ACCOUNT_DELETION_MODE=job`.

### Provider-neutral R5

`report.deliver`, `integration.sync` and `billing.reconcile` intentionally expose
`available: false`, return `503` before persisting new work and fail closed in
workers. The fake providers and ledgers are suitable for contract/fake E2E only;
they do not satisfy production readiness. Choose the real provider/source of
truth and add provider-specific E2E in a later change before enabling any of
these endpoints.

## Incident evidence and rollback

On a failed gate, first preserve aggregate metrics and sanitized broker logs,
then stop cohort expansion. Kafka rollback is a mode change to `direct` followed
by consumer drain. RabbitMQ rollback closes creation of new jobs while durable
jobs either drain or are explicitly cancelled with an audit transition. Never
delete an outbox row, topic, queue or object-store artifact to make a dashboard
look clean.

The branch keeps migrations additive. Any future destructive schema change needs
its own reviewed migration and is outside this readiness branch.
