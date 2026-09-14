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

**Selected: revision lookup (candidate 1), no longer provisional.** The existing
heartbeat repository selects the highest stored revision and consults deletion
tombstones before the fact-sink writes.  The full isolated matrix below passed,
including partial failure, offset replay and rebalance.  A stable ClickHouse
insert token remains enabled for the Kafka path as a second guard, but it was not
needed to select the D6 architecture.  Production rollout is still separately
gated by K3/K4 verification and cohort evidence; `direct` remains the rollback
path.

## Decision record template

The completed spike must append the exact Redpanda/ClickHouse versions, broker
and ClickHouse settings, failure injection point, and counts in this form:

```text
scenario=<name> input=<n> physical=<n> canonical=<n> rollup=<n>
failure_point=<none|raw_before_interval|before_offset_commit|rebalance|clickhouse_down>
D6=<revision_lookup|stable_batch_token|landing_table>
reason=<sanitized category>
```

The lines below are populated from the isolated run.  K2 correctness is therefore
closed; K3/K4 remain gated on their own rollout criteria, and direct mode remains
the rollback path.

## Isolated transport preflight (2026-09-13)

The feature-gated harness was run against the dedicated Compose project
`wakaclock-k0` (Redpanda `v24.1.8`, ClickHouse `24.10.4.191`). It created a
UUID-suffixed topic with three partitions, published the same stable event 100
times with idempotent producer settings, and drained it with two consumers in
one group using `auto.offset.reset=earliest`. The UUID-suffixed source topic was
deleted after the run; the shared DLQ topic was retained between local
invocations because Redpanda deletes topics asynchronously and an immediate
idempotent-producer recreation can race.

```text
scenario=duplicate_publish input=100 physical=100 canonical=1 rollup=pending failure_point=none D6=revision_lookup reason=transport_preflight
scenarios_completed=1 scenarios_required=10
```

This historical preflight proved producer acknowledgement, stable key/identity,
topic isolation and consumer assignment only. The full fact-sink matrix below
supersedes its provisional D6 status.

## Full K0 correctness run (2026-09-13)

The same feature-gated binary was rerun after wiring the production batch
pipeline, PostgreSQL migration, metadata-only DLQ, rebalance consumers and
failure injection points.  The run used the isolated Compose project
`wakaclock-k0`, ClickHouse `24.10.4.191`, Redpanda `v24.1.8` and PostgreSQL 16.
The source topic had three partitions; the DLQ was also isolated and retained
between local invocations to avoid Redpanda's asynchronous topic-delete race.
No payload, absolute path or credential was written to the log.

```text
scenario=duplicate_publish input=100 physical=1 canonical=1 interval=1 rollup=1 failure_point=none D6=revision_lookup reason=revision_lookup
scenario=revision_replay input=4 physical=2 canonical=1 interval=1 rollup=1 failure_point=none D6=revision_lookup reason=revision_lookup
scenario=revision_gap input=1 physical=0 canonical=0 interval=0 rollup=0 failure_point=none D6=revision_lookup reason=revision_error
scenario=legacy_server_id input=1 physical=1 canonical=1 interval=1 rollup=1 failure_point=none D6=revision_lookup reason=server_assigned_id
scenario=batch_boundary input=2 physical=1 canonical=1 interval=1 rollup=1 failure_point=none D6=revision_lookup reason=batch_shape_independent
scenario=raw_before_interval input=1 physical=1 canonical=1 interval=1 rollup=1 failure_point=raw_before_interval D6=revision_lookup reason=replay_fills_projection
scenario=before_offset_commit input=1 physical=1 canonical=1 interval=1 rollup=1 failure_point=before_offset_commit D6=revision_lookup reason=stable_identity
scenario=rebalance input=24 physical=1 canonical=1 interval=1 rollup=1 failure_point=rebalance D6=revision_lookup reason=cooperative_assignment
scenario=clickhouse_outage input=1 physical=1 canonical=1 interval=1 rollup=1 failure_point=clickhouse_down D6=revision_lookup reason=retry_after_recovery
scenario=tombstone_delayed_record input=2 physical=0 canonical=0 interval=0 rollup=1 failure_point=none D6=revision_lookup reason=tombstone_wins_no_new_rollup
scenario=safe_entity_and_parity input=1 physical=1 canonical=1 interval=1 rollup=1 failure_point=none D6=revision_lookup reason=relative_or_basename_only
scenarios_completed=11 scenarios_required=11
D6=revision_lookup reason=all_failure_and_replay_scenarios_passed
```

The interval and rollup counts in this evidence use ClickHouse `FINAL` so the
report is a logical count rather than an asynchronous MergeTree part count. For
the tombstone row, the before/after rollup comparison was unchanged (the
isolated run had one pre-existing logical rollup row); the canonical row,
interval and delayed-event path remain empty. This records the current
additive-MV semantics instead of claiming that a physical aggregate mutation
was performed.
