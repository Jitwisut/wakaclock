# F5-02 Codex CLI campaign driver — 2026-09-06

The F5-02 implementation now includes a bounded campaign driver at
`scripts/ai-coverage/run_codex_cli_campaign.py`. It is the adapter-specific
driver for `scripts/ai-coverage/run_live_certification.py`; it does not promote
an artifact or change the reviewed catalog.

## What the driver does

- Requires an explicit `--execute` flag before invoking an authenticated Codex
  client. This prevents an accidental campaign from consuming an account or
  paid quota.
- Preflights the Codex executable, exact expected version, an explicit
  `CODEX_HOME`/auth home, and the shipped `wakaclock` binary.
- Runs bounded disposable-workspace scenarios for single-file, multi-file,
  create/delete/rename, failure/no-op, retry/dedup, and nested execution.
- Copies each newly written transcript only into the temporary certification
  sandbox, replays it through the shipped CLI parser, and retains only event
  counters and stage/scenario statuses in stdout.
- For `retry-dedup`, a delivered campaign performs a second sync and requires
  the same parsed event to be reported as already delivered with zero new
  events. `nested-execution` stays `not_run` until Codex exposes a stable,
  privacy-safe parent/child execution identity.
- With `--readback`, the driver performs an event-bound metadata-only dry scan,
  reads the isolated account's heartbeat rows, verifies canonical winners in
  ClickHouse, and compares the dashboard's AI delta with canonical line counts.
  Provider/model expectations and the read-only ClickHouse connection are passed
  through bounded arguments or environment variables; no raw event IDs leave
  the process.
- Never places Codex stdout, prompts, patches, source, account paths, or
  credentials in the certification result.
- Treats a local broker acknowledgement as `broker_accept` only; it never marks
  `api_delivery` passed without the event-bound API readback probe.
- Leaves canonical and dashboard stages as `not_run` unless `--readback` is
  enabled. A local parser pass cannot imply backend delivery or UI visibility.

Example dry-run metadata campaign command (it will report a blocker until
`--execute` is added):

```bash
python3 scripts/ai-coverage/run_live_certification.py \
  --repo . \
  --adapter-id codex \
  --client-id codex \
  --provider-id openai \
  --tool-version 0.153.4 \
  --producer-version 0.1.0 \
  --runtime cli \
  --os darwin \
  --arch arm64 \
  --edit-mode native_single_file \
  --payload-schema codex-v2 \
  --scenario-id single-file \
  --scenario-id multi-file \
  --scenario-id create-delete-rename \
  --scenario-id failure-no-op \
  --scenario-id retry-dedup \
  --scenario-id nested-execution \
  --driver 'python3 scripts/ai-coverage/run_codex_cli_campaign.py' \
  --output /tmp/codex-pending.json
```

An authenticated run must opt in explicitly and provide the user's existing
Codex auth home through `CODEX_HOME`; credentials are never copied into the
artifact. Delivery additionally requires `WAKACLOCK_SERVER_URL` and
`WAKACLOCK_API_KEY`. Full certification adds `--readback`,
`--expected-provider`, `--expected-model`, and a read-only
`CLICKHOUSE_URL`/credential tuple.

## Harness hardening

The generic certification harness now rejects an empty or unknown-field driver
response. Missing stages and scenarios become `not_run`; an empty response can
never create the former synthetic `live-driver: passed` row. Driver blockers are
accepted only as bounded lowercase codes and are preserved in the pending
artifact for review.

## Current boundary

The readback implementation and regression suite are complete. The final
`codex-cli 0.153.4` campaign passed source capture, producer event, broker
acceptance, API delivery, canonical reconciliation and dashboard readback for
8 events; retry/dedup replayed one event with zero new events. The artifact is
still `review_status=pending` and the nested execution scenario remains an
explicit blocker until Codex exposes a stable parent/child identity. Human
review and catalog promotion remain separate release decisions.
