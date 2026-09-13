# Kafka heartbeat ingest dedup spike — 2026-09-13

## Scope

This document records the K0 gate for the heartbeat Kafka path.  The harness is
feature-gated (`kafka-spike`) and must use an isolated Redpanda topic and an
isolated ClickHouse 24.10 database.  It must never truncate a shared database or
reuse production event IDs.

## Current implementation baseline

- Rust Kafka client: `rust-rdkafka 0.39.x` (`tokio`, `cmake-build`, `ssl-vendored`)
- Producer settings: idempotence on, `acks=all`, max in-flight 5, lz4,
  `linger.ms=5`, 10-second delivery timeout
- Consumer settings: manual offset commits, cooperative-sticky assignment
- ClickHouse async insert: disabled for the Kafka write path
- Tombstones: `heartbeat_deletions` is consulted by the existing revision lookup
- Event identity: `hb:{heartbeat_id}:{revision}`

## Required scenarios

The isolated harness must execute duplicate/revision replay, batch-boundary
changes, raw-before-interval crash, pre-commit crash, rebalance, ClickHouse
outage/recovery, tombstone ordering, safe entity conversion, and direct-vs-Kafka
analytics parity.  It must report input, physical, canonical and rollup row
counts without logging payloads or paths.

## D6 decision

**Provisional choice: revision lookup (candidate 1).** The existing heartbeat
repository already selects the highest stored revision and includes deletion
tombstones.  This choice is not a production rollout approval: K0 remains a
gate until the real Redpanda/ClickHouse harness passes every partial-failure and
rebalance scenario.  If any scenario fails, rerun the same matrix with the
stable per-partition batch token candidate before selecting the landing-table
fallback.

## Decision record template

The completed spike must append the exact Redpanda/ClickHouse versions, broker
and ClickHouse settings, failure injection point, and counts in this form:

```text
scenario=<name> input=<n> physical=<n> canonical=<n> rollup=<n>
failure_point=<none|raw_before_interval|before_offset_commit|rebalance|clickhouse_down>
D6=<revision_lookup|stable_batch_token|landing_table>
reason=<sanitized category>
```

Until those lines are populated by the isolated run, K2/K3/K4 remain gated in
production configuration; direct mode is the rollback path.

## Isolated transport preflight (2026-09-13)

The feature-gated harness was run against the dedicated Compose project
`wakaclock-k0` (Redpanda `v24.1.8`, ClickHouse `24.10.4.191`). It created a
UUID-suffixed topic with three partitions, published the same stable event 100
times with idempotent producer settings, and drained it with two consumers in
one group using `auto.offset.reset=earliest`. The topic was deleted after the
run.

```text
scenario=duplicate_publish input=100 physical=100 canonical=1 rollup=pending failure_point=none D6=revision_lookup reason=transport_preflight
scenarios_completed=1 scenarios_required=10
```

This proves producer acknowledgement, stable key/identity, topic isolation and
consumer assignment only. `canonical=1` is the expected logical identity, not a
ClickHouse row measurement; the ten failure-injection/parity scenarios below
still need the full fact-sink harness before D6 is promoted from provisional.
