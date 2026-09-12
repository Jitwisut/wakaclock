# Duration audit

Replays a real heartbeat stream through wakaclock's timeline algorithm and
through a reference implementation of WakaTime's duration builder, so the two can
be compared on identical input. Findings live in
[../../docs/duration-accuracy-audit.md](../../docs/duration-accuracy-audit.md).

```bash
python3 verify_port.py            # prove the Python port matches activity_timeline.rs's unit tests
python3 golden.py                 # Phase 0: replay the committed fixture and enforce the manifest
python3 golden.py --print-expected # regenerate a candidate manifest after an intentional rule change
./export.sh <user-uuid> && WAKACLOCK_API_KEY=... python3 certify_live.py
                                   # release-only sanitized real-data certification
python3 verify_actor_migration.py  # reject new production uses of the legacy boolean
python3 verify_certification.py    # validate a committed sanitized release record
WAKATIME_COMPARE_START=YYYY-MM-DD WAKATIME_COMPARE_END=YYYY-MM-DD \
  WAKATIME_API_KEY=... WAKACLOCK_API_KEY=... python3 compare_wakatime.py
                                   # advisory external-oracle comparison; env-only credentials
WAKATIME_COMPARE_START=YYYY-MM-DD WAKATIME_COMPARE_END=YYYY-MM-DD \
  WAKATIME_TIMEZONE=Asia/Bangkok WAKACLOCK_RAW_HEARTBEATS=hb.jsonl \
  WAKATIME_API_KEY=... WAKACLOCK_API_KEY=... python3 compare_wakatime.py
                                   # includes a metadata-only heartbeat/gap baseline
python3 ladder.py                 # per-day: raw_sum / segments / canonical / bridged / wakatime
python3 decompose.py              # where the reported seconds come from, and who emits them
python3 sensitivity.py            # idle-timeout sweep, human-only vs agent-only
```

`timeline.py` is a line-for-line port of
`backend/api/src/services/activity_timeline.rs`. **Run `verify_port.py` first** —
it asserts the same eight cases as that module's `#[cfg(test)] mod tests`. If the
Rust changes and the port does not, `verify_port.py` fails and everything
downstream is untrustworthy.

`hb.jsonl` / `ai.jsonl` are exported user data and are not committed.

`certify_live.py` queries both `/api/v1/users/current/summaries` and
`/api/v1/dashboard/explorer`. It writes the sanitized release record atomically to
`certifications/latest.json` by default. The record contains only aggregate totals,
dates, the tested commit SHA, actor buckets, and error metrics; it never contains
paths, user identifiers, prompts, patches, or source content. The actor check fails
if the four actor buckets do not partition the API total or if an actor-filtered
Human/Unknown result disagrees with the unfiltered breakdown.

`compare_wakatime.py` is intentionally not a CI gate. Run it only during a controlled
observation window where WakaTime and Wakaclock are both active on the same machine, with
the same date range and IANA timezone. It reads `WAKATIME_API_KEY`, `WAKACLOCK_API_KEY`,
`WAKATIME_COMPARE_START`, `WAKATIME_COMPARE_END`, and `WAKATIME_TIMEZONE` from the
environment, and writes only aggregate totals, dates, timezone, commit SHA, and error
metrics to `certifications/wakatime-parity.json`. When `hb.jsonl` exists it also embeds a
sanitized baseline: observed versus measured heartbeats, timeout-sized gaps, invalid
records, and any pending/failed delivery status explicitly reported by the export. An
empty day or missing export is marked `unavailable`; it is never converted to zero.
Set `WAKACLOCK_SETTLE_SECONDS` (0–300, optional) when the client may still be flushing its
offline queue; the bounded wait is recorded in the report before either read-only snapshot.
The delay gives eventual ingestion time to settle but cannot recover a queue that was never
delivered, so pending/failed rows remain visible in the baseline.

The API exposes the rollout switch `DURATION_CALCULATION_MODE=legacy|combined_v2`. Keep
`legacy` while collecting a baseline. `combined_v2` computes the main total as the union
of WakaTime-comparable editor ranges and measured AI ranges, counts overlaps once, and
reports `comparable_seconds`, `ai_measured_seconds`, `ai_additional_seconds`, and
`calculation_version` alongside the legacy total. The server does not turn an open
process, a completion-only record, or an AI gap into duration without an observed range.

The CI certification gate also rejects a malformed or stale `latest.json`; the
sanitized record must have a timezone-aware `checked_at_utc` no more than 30 days
old. This keeps a passing historical measurement from silently becoming the active
release baseline.

`golden.jsonl` is synthetic metadata-only input. `golden.expected.json` is the
machine-readable acceptance manifest; it is the only baseline used for Phase 0.
The runner fails when total error exceeds 1%, an active day (at least 60 seconds)
exceeds 3%, a duration/actor/project breakdown no longer partitions its total, or
any expected actor type/confidence changes.
