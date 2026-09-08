# F1-03 sidecar transport evidence — 2026-09-05

Status: **implemented as the first F1 slice**. The transport contract and the
bounded VS Code reader are covered by focused tests. The broader F1 exit gate
still depends on pending observations, exact reconciliation, canonical
revisions, projections, and the crash/concurrency suite owned by F1-02/F1-04
and F1-06–F1-10.

## Contract

New broker sidecar rows are JSONL `schema_version: 2` records with:

- an opaque `stream_id` that is generated once and stored in the broker SQLite
  database;
- a positive, monotonic `sequence` allocated per stream; and
- the existing metadata-only event fields (`event_id`, entity, time, line
  counts, and observed actor metadata).

The sidecar remains metadata-only. It does not add source text, prompts,
responses, or patch bodies. `event_id` is still the semantic producer identity;
`(stream_id, sequence)` is the transport identity used to order and deduplicate
the JSONL delivery.

Rows written by older binaries omit `schema_version` and are read as v1. Rows
with a future or unsupported schema are skipped without becoming attribution
evidence. A v2 row without a valid stream or sequence is also skipped.

## Durable writer cursor

`BrokerStore::open_at` creates two additive tables:

- `broker_sidecar_state(stream_key, stream_id, next_sequence)` stores the stream
  identity and the next sequence after a broker restart;
- `broker_sidecar_events(event_id, stream_key, sequence, written_at)` stores the
  idempotent event-to-sequence reservation.

`append_broker_sidecar` reserves the mapping in an immediate SQLite transaction
before appending JSONL. A retry for the same event receives the same sequence;
it does not scan the entire sidecar file. A crash after reservation and before
the append leaves a gap that the retry fills with the reserved identity. A
crash after the append and before `written_at` is recorded can produce one
physical duplicate line, which the reader removes by transport identity.

## Bounded incremental reader

`extensions/vscode/src/aiAttribution.ts` now:

- reads at most 256 KiB per refresh and retains at most 500 accepted events;
- rejects a line over 64 KiB and never parses an unterminated trailing line;
- advances by byte offset instead of rescanning the complete JSONL file;
- detects truncate/rename through file identity and resynchronizes from byte
  zero while retaining stream ordering and deduplication state;
- skips duplicate or out-of-order `(stream_id, sequence)` rows and keeps legacy
  v1 rows keyed by `event_id`;
- persists `ai-events.cursor.json` next to the sidecar with private permissions.
  The checkpoint contains only the bounded cursor, transport keys, pending
  metadata events, and consumed IDs, so an extension restart does not lose an
  event that is waiting for editor correlation or replay an already consumed
  ownership record; and
- atomically replaces the checkpoint and keeps the sidecar usable if the local
  home directory is temporarily read-only.

The cursor advances only through complete newline-delimited records. If a
process stops while a producer is appending a line, the next reader re-reads
that incomplete byte range and accepts it only after the newline arrives.

## Evidence

Focused tests in `extensions/vscode/test/aiAttribution.test.ts` cover:

| Scenario | Expected result |
| --- | --- |
| Partial append without newline | no attribution until the line is complete |
| Appended bytes | only new bytes are read and the event is consumed once |
| Truncate/rotation with a new stream | reader resynchronizes and accepts the new stream |
| v1 compatibility and future schema | legacy row remains readable; unknown schema is ignored |
| Extension restart | pending metadata survives; consumed ownership is not replayed |

`wakaclock-core` test `sidecar_cursor_is_monotonic_idempotent_and_survives_reopen`
covers first allocation, retry idempotency, monotonic sequences, and broker
database reopen. The existing broker process tests continue to verify that the
metadata-only sidecar is produced for accepted AI events.

## Deliberate boundary

This slice does not change the attribution policy. An empty candidate set still
has the F0 `human` fallback until F1-09's correction path is ready; mixed
human+AI batches, delayed evidence reconciliation, canonical aliases/revisions,
and server projections remain separate F1 tasks. The transport now preserves
the evidence needed for those tasks without claiming that transport order alone
proves editor ownership.
