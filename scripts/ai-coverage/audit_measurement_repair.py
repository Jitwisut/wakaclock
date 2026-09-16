#!/usr/bin/env python3
"""Read-only, metadata-only comparison of canonical rows and fresh parser candidates.

Does not apply corrections. Missing reparse events are unresolved, never proof of a
failed operation. The identity-repair endpoint must not be used to change counters.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path


def counter(value):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 4294967295:
        raise ValueError("invalid line counter")
    return value


def key(row, candidate=False):
    event = row.get("event_id" if candidate else "ai_event_id")
    session = row.get("session_id")
    if not isinstance(event, str) or not event.strip():
        return None
    if session is not None and not isinstance(session, str):
        return None
    return event, session


def audit(rows, candidates):
    if not isinstance(rows, list) or not isinstance(candidates, list):
        raise ValueError("expected metadata row lists")
    fresh = {}
    conflicts = set()
    for candidate in candidates:
        ref = key(candidate, True)
        if ref is None:
            continue
        if "lines_added" not in candidate or "lines_deleted" not in candidate:
            conflicts.add(ref)
            continue
        value = (counter(candidate["lines_added"]), counter(candidate["lines_deleted"]))
        if ref in fresh and fresh[ref] != value:
            conflicts.add(ref)
        fresh[ref] = value
    occurrences = Counter(key(row) for row in rows)
    counts = Counter()
    changes = []
    for row in rows:
        ref = key(row)
        if ref is None:
            counts["missing_stable_reference"] += 1
            continue
        if ref in conflicts or occurrences[ref] != 1:
            counts["ambiguous_reference"] += 1
            continue
        if ref not in fresh:
            counts["source_unresolved"] += 1
            continue
        if row.get("actor_type") not in ("ai_verified", "ai_inferred"):
            counts["non_ai_row"] += 1
            continue
        old = (counter(row.get("ai_lines_added")), counter(row.get("ai_lines_deleted")))
        new = fresh[ref]
        if old == new:
            counts["unchanged"] += 1
            continue
        counts["requires_measurement_revision"] += 1
        # Hash the scoped reference so even malformed external IDs cannot expose content.
        digest = hashlib.sha256(json.dumps(ref, separators=(",", ":")).encode()).hexdigest()
        changes.append({"reference_digest": digest,
                        "before": {"added": old[0], "deleted": old[1]},
                        "after": {"added": new[0], "deleted": new[1]}})
    return {"schema_version": 1, "dry_run": True, "applied": False,
            "status": "requires_review" if changes else "no_proven_corrections",
            "counts": dict(sorted(counts.items())), "changes": changes,
            "apply_blocker": "measurement_revision_apply_not_implemented",
            "preserves": ["timestamps", "measured_time", "identity", "source_rows"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--canonical", required=True, type=Path)
    parser.add_argument("--reparsed", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        raw = json.loads(args.canonical.read_text())
        replay = json.loads(args.reparsed.read_text())
        report = audit(raw.get("data", []) if isinstance(raw, dict) else raw,
                       replay.get("candidates", []) if isinstance(replay, dict) else replay)
    except (OSError, ValueError, TypeError, AttributeError):
        parser.exit(2, "invalid or unavailable metadata input\n")
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"dry_run": True, "counts": report["counts"]}, sort_keys=True))


if __name__ == "__main__":
    main()
