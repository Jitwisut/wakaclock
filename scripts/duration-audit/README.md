# Duration audit

Replays a real heartbeat stream through wakaclock's timeline algorithm and
through a reference implementation of WakaTime's duration builder, so the two can
be compared on identical input. Findings live in
[../../docs/duration-accuracy-audit.md](../../docs/duration-accuracy-audit.md).

```bash
python3 verify_port.py            # prove the Python port matches activity_timeline.rs's unit tests
./export.sh <user-uuid>           # dump that user's heartbeats from ClickHouse
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
