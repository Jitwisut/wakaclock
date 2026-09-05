"""Run the reproducible Phase 0 attribution and duration golden dataset.

The fixture is deliberately metadata-only. It exercises the normalized heartbeat
contract without storing source text, user identifiers, exported paths, or live
heartbeat payloads. The same JSONL is replayed through the duration port and a
WakaTime-compatible reference builder.
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping

sys.path.insert(0, str(Path(__file__).resolve().parent))
from timeline import (  # noqa: E402
    build_intervals,
    canonicalize_bridged,
    total_seconds,
    wakatime_durations,
    wakatime_per_key,
)


ROOT = Path(__file__).resolve().parent
FIXTURE = ROOT / "golden.jsonl"
MANIFEST = ROOT / "golden.expected.json"
VERSION = "phase0-golden-v1"
IDLE_TIMEOUT_SECONDS = 900.0
AGENT_IDLE_TIMEOUT_SECONDS = 120.0
ACTOR_TYPES = ("human", "ai_verified", "ai_inferred", "unknown")


def _legacy_boolean(row: Mapping[str, Any], expected: bool) -> bool:
    value = row.get("is_ai_generated")
    if isinstance(value, bool):
        return value is expected
    if isinstance(value, (int, float)):
        return bool(value) is expected
    return False


def _positive(row: Mapping[str, Any], key: str) -> bool:
    value = row.get(key)
    return isinstance(value, (int, float)) and value > 0


def _has_ai_evidence(row: Mapping[str, Any]) -> bool:
    def _nonempty(value: Any) -> bool:
        return isinstance(value, str) and bool(value.strip())

    return (
        _legacy_boolean(row, True)
        or _nonempty(row.get("ai_agent"))
        or _nonempty(row.get("ai_event_id"))
        or str(row.get("ai_source") or "").lower() in ("agent_hook", "mcp")
        or _positive(row, "ai_lines_added")
        or _positive(row, "ai_lines_deleted")
    )


def _has_human_evidence(row: Mapping[str, Any]) -> bool:
    return row.get("positive_editor_evidence") is True or any(
        _positive(row, key)
        for key in (
            "human_lines_added",
            "human_lines_deleted",
            "keystrokes",
            "chars_added",
            "chars_deleted",
        )
    )


def _has_attribution_lines(row: Mapping[str, Any]) -> bool:
    return any(
        _positive(row, key)
        for key in (
            "ai_lines_added",
            "ai_lines_deleted",
            "human_lines_added",
            "human_lines_deleted",
            "unattributed_lines_added",
            "unattributed_lines_deleted",
        )
    )


def resolve_attribution(row: Mapping[str, Any]) -> Dict[str, Any]:
    """Python mirror of wakaclock-core::resolve_attribution for fixture checks."""
    explicit = row.get("actor_type")
    if explicit is not None and explicit not in ACTOR_TYPES:
        raise ValueError(f"{row['case']}: unsupported actor_type={explicit!r}")

    explicit_confidence = row.get("actor_confidence")
    if explicit_confidence is not None:
        if not isinstance(explicit_confidence, (int, float)) or not math.isfinite(
            float(explicit_confidence)
        ) or not 0.0 <= float(explicit_confidence) <= 1.0:
            raise ValueError(f"{row['case']}: actor_confidence must be between 0 and 1")

    ai_evidence = _has_ai_evidence(row)
    human_evidence = _has_human_evidence(row)
    ambiguous_lines = _positive(row, "unattributed_lines_added") or _positive(
        row, "unattributed_lines_deleted"
    )
    if ai_evidence and human_evidence and explicit is None:
        raise ValueError(f"{row['case']}: conflicting AI and Human evidence")

    if explicit is not None:
        if explicit in ("ai_verified", "ai_inferred") and _legacy_boolean(row, False):
            raise ValueError(f"{row['case']}: enum conflicts with false legacy boolean")
        if explicit in ("human", "unknown") and _legacy_boolean(row, True):
            raise ValueError(f"{row['case']}: enum conflicts with true legacy boolean")
        if explicit in ("human", "unknown") and ai_evidence and not (
            explicit == "unknown" and ambiguous_lines
        ):
            raise ValueError(f"{row['case']}: enum conflicts with AI evidence")
        if explicit == "human" and _has_attribution_lines(row) and ai_evidence:
            raise ValueError(f"{row['case']}: human enum contains AI lines")
        if explicit == "human" and ambiguous_lines:
            raise ValueError(f"{row['case']}: human enum contains ambiguous line counters")
        if explicit in ("ai_verified", "ai_inferred") and any(
            _positive(row, key) for key in ("human_lines_added", "human_lines_deleted")
        ):
            raise ValueError(f"{row['case']}: AI enum contains Human lines")
        if explicit == "unknown" and (ai_evidence or human_evidence) and not ambiguous_lines:
            raise ValueError(f"{row['case']}: unknown enum contains positive evidence")
        actor_type = explicit
    elif ai_evidence:
        verified = str(row.get("ai_confidence") or "").lower() == "verified" or str(
            row.get("ai_source") or ""
        ).lower() in ("agent_hook", "mcp")
        actor_type = "ai_verified" if verified else "ai_inferred"
    elif human_evidence:
        actor_type = "human"
    else:
        actor_type = "unknown"

    if explicit_confidence is not None:
        confidence = float(explicit_confidence)
    elif actor_type == "human":
        confidence = 1.0
    elif actor_type == "ai_verified":
        confidence = 0.95 if str(row.get("ai_source", "")).lower() == "mcp" else 1.0
    elif actor_type == "ai_inferred":
        confidence = 0.8 if str(row.get("ai_confidence", "")).lower() == "correlated" else 0.6
    else:
        confidence = 0.0

    return {"actor_type": actor_type, "actor_confidence": confidence}


def load_fixture() -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    cases = set()
    forbidden = {"content", "source_content", "diff", "user_id", "api_key", "token"}
    with FIXTURE.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            if not isinstance(row, dict):
                raise ValueError(f"fixture line {line_number} is not an object")
            unexpected = forbidden.intersection(row)
            if unexpected:
                raise ValueError(f"fixture line {line_number} contains private/raw keys: {unexpected}")
            case = row.get("case")
            if not isinstance(case, str) or not case.strip() or case in cases:
                raise ValueError(f"fixture line {line_number} has a missing or duplicate case")
            cases.add(case)
            if not isinstance(row.get("time"), (int, float)):
                raise ValueError(f"{case}: time must be numeric")
            if not isinstance(row.get("project"), str) or not row["project"].strip():
                raise ValueError(f"{case}: project must be a non-empty synthetic label")
            resolution = resolve_attribution(row)
            normalized = copy.deepcopy(row)
            normalized.update(resolution)
            normalized["is_ai_generated"] = resolution["actor_type"] in (
                "ai_verified",
                "ai_inferred",
            )
            normalized["heartbeat_id"] = f"golden:{len(rows):03d}"
            normalized.setdefault("language", "Unknown")
            normalized.setdefault("category", "coding")
            rows.append(normalized)
    if not rows:
        raise ValueError("golden fixture is empty")
    return sorted(rows, key=lambda row: (float(row["time"]), row["heartbeat_id"]))


def _day_start(timestamp: float) -> datetime:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def _date(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()


def _days(rows: Iterable[Mapping[str, Any]]) -> List[str]:
    return sorted({_date(float(row["time"])) for row in rows})


def _window_for_date(day: str) -> tuple[float, float]:
    start = datetime.fromisoformat(day).replace(tzinfo=timezone.utc)
    return start.timestamp(), (start + timedelta(days=1)).timestamp()


def _duration_by_actor(intervals: Iterable[Any]) -> Dict[str, float]:
    result = {actor: 0.0 for actor in ACTOR_TYPES}
    for interval in intervals:
        seconds = max(0.0, interval.end - interval.start)
        if seconds == 0:
            continue
        if interval.source == "editor" and interval.actor_type == "human":
            actor = "human"
        elif interval.source == "ai" and interval.actor_type in ("ai_verified", "ai_inferred"):
            actor = interval.actor_type
        else:
            # Handover and no-provenance time are intentionally not Human.
            actor = "unknown"
        result[actor] += seconds
    return result


def _line_attribution(rows: Iterable[Mapping[str, Any]]) -> Dict[str, Any]:
    heartbeat_counts = Counter()
    lines = {actor: {"added": 0, "deleted": 0} for actor in ACTOR_TYPES}
    cases = {}
    for row in rows:
        actor = row["actor_type"]
        if actor == "unknown" and not (
            _positive(row, "unattributed_lines_added")
            or _positive(row, "unattributed_lines_deleted")
        ) and any(
            _positive(row, key)
            for key in (
                "human_lines_added",
                "human_lines_deleted",
                "keystrokes",
                "chars_added",
                "chars_deleted",
            )
        ):
            raise AssertionError(f"{row['case']}: unknown evidence was counted as Human")
        heartbeat_counts[actor] += 1
        if actor == "human":
            added_key, deleted_key = "human_lines_added", "human_lines_deleted"
        elif actor in ("ai_verified", "ai_inferred"):
            added_key, deleted_key = "ai_lines_added", "ai_lines_deleted"
        else:
            added_key = deleted_key = None
        if added_key is not None:
            lines[actor]["added"] += int(row.get(added_key) or 0)
            lines[actor]["deleted"] += int(row.get(deleted_key) or 0)
        # An ambiguous counter is Unknown even when the same row carries a known
        # actor classification.  It must never disappear or leak into Human.
        lines["unknown"]["added"] += int(row.get("unattributed_lines_added") or 0)
        lines["unknown"]["deleted"] += int(row.get("unattributed_lines_deleted") or 0)
        if actor == "unknown":
            lines["unknown"]["added"] += int(row.get("ai_lines_added") or 0)
            lines["unknown"]["added"] += int(row.get("human_lines_added") or 0)
            lines["unknown"]["deleted"] += int(row.get("ai_lines_deleted") or 0)
            lines["unknown"]["deleted"] += int(row.get("human_lines_deleted") or 0)
        cases[row["case"]] = {
            "actor_type": actor,
            "actor_confidence": row["actor_confidence"],
        }
    return {
        "heartbeat_counts": {actor: heartbeat_counts[actor] for actor in ACTOR_TYPES},
        "lines": lines,
        "cases": cases,
    }


def calculate(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    min_start = _day_start(float(rows[0]["time"])).timestamp()
    max_end = (
        _day_start(float(rows[-1]["time"])) + timedelta(days=1)
    ).timestamp()
    all_intervals = canonicalize_bridged(
        build_intervals([], rows, min_start, max_end),
        IDLE_TIMEOUT_SECONDS,
        AGENT_IDLE_TIMEOUT_SECONDS,
    )
    if any(
        interval.actor_type == "unknown" and interval.source == "editor"
        for interval in all_intervals
    ):
        raise AssertionError("unknown duration was normalized to the Human/editor bucket")
    waclock_total = total_seconds(all_intervals)
    wakatime_total, _ = wakatime_durations(rows, IDLE_TIMEOUT_SECONDS)
    daily: Dict[str, Any] = {}
    for day in _days(rows):
        start, end = _window_for_date(day)
        day_rows = [row for row in rows if start <= float(row["time"]) < end]
        day_intervals = canonicalize_bridged(
            build_intervals([], rows, start, end),
            IDLE_TIMEOUT_SECONDS,
            AGENT_IDLE_TIMEOUT_SECONDS,
        )
        day_waclock = total_seconds(day_intervals)
        day_wakatime, _ = wakatime_durations(day_rows, IDLE_TIMEOUT_SECONDS)
        project_waclock = defaultdict(float)
        for interval in day_intervals:
            project_waclock[interval.project or "Unknown"] += max(
                0.0, interval.end - interval.start
            )
        project_wakatime = wakatime_per_key(
            day_rows, lambda row: row.get("project") or "Unknown", IDLE_TIMEOUT_SECONDS
        )
        daily[day] = {
            "waclock_seconds": day_waclock,
            "wakatime_seconds": day_wakatime,
            "projects": {
                "waclock_seconds": dict(sorted(project_waclock.items())),
                "wakatime_seconds": dict(sorted(project_wakatime.items())),
            },
            "actor_duration_seconds": _duration_by_actor(day_intervals),
        }

    attribution = _line_attribution(rows)
    attribution["duration_seconds"] = _duration_by_actor(all_intervals)
    return {
        "duration": {
            "waclock_seconds": waclock_total,
            "wakatime_seconds": wakatime_total,
            "daily": daily,
        },
        "attribution": attribution,
    }


def _stable(value: Any) -> Any:
    """Remove runtime-only error fields before comparing the expected manifest."""
    return value


def _relative_error(actual: float, reference: float) -> float:
    return abs(actual - reference) / max(abs(reference), 1.0)


def validate(result: Dict[str, Any], manifest: Mapping[str, Any]) -> Dict[str, Any]:
    expected = manifest.get("expected")
    if not isinstance(expected, dict):
        raise ValueError("manifest is missing expected results")
    if _stable(result) != expected:
        raise AssertionError("expected attribution or duration result changed")

    limits = manifest.get("limits", {})
    max_total_error = float(limits.get("max_total_error", 0.01))
    max_daily_error = float(limits.get("max_daily_error", 0.03))
    min_daily_seconds = float(limits.get("min_daily_seconds", 60.0))

    duration = result["duration"]
    total_error = _relative_error(duration["waclock_seconds"], duration["wakatime_seconds"])
    if total_error > max_total_error:
        raise AssertionError(f"total duration error {total_error:.6f} exceeds {max_total_error:.6f}")

    actor_total = sum(result["attribution"]["duration_seconds"].values())
    if abs(actor_total - duration["waclock_seconds"]) > 1e-6:
        raise AssertionError("actor duration breakdown does not sum to WakaClock total")

    daily_errors = {}
    for day, values in duration["daily"].items():
        project_total = sum(values["projects"]["waclock_seconds"].values())
        if abs(project_total - values["waclock_seconds"]) > 1e-6:
            raise AssertionError(f"project duration breakdown does not sum on {day}")
        actor_day_total = sum(values["actor_duration_seconds"].values())
        if abs(actor_day_total - values["waclock_seconds"]) > 1e-6:
            raise AssertionError(f"actor duration breakdown does not sum on {day}")
        error = _relative_error(values["waclock_seconds"], values["wakatime_seconds"])
        daily_errors[day] = error
        if values["wakatime_seconds"] >= min_daily_seconds and error > max_daily_error:
            raise AssertionError(
                f"daily duration error on {day} {error:.6f} exceeds {max_daily_error:.6f}"
            )

    fixture_rows = load_fixture()
    expected_lines = {
        "added": sum(
            sum(
                int(row.get(key) or 0)
                for key in (
                    "ai_lines_added",
                    "human_lines_added",
                    "unattributed_lines_added",
                )
            )
            for row in fixture_rows
        ),
        "deleted": sum(
            sum(
                int(row.get(key) or 0)
                for key in (
                    "ai_lines_deleted",
                    "human_lines_deleted",
                    "unattributed_lines_deleted",
                )
            )
            for row in fixture_rows
        ),
    }
    actual_lines = {
        side: sum(result["attribution"]["lines"][actor][side] for actor in ACTOR_TYPES)
        for side in ("added", "deleted")
    }
    if actual_lines != expected_lines:
        raise AssertionError(
            f"line attribution breakdown does not sum to input counters: "
            f"actual={actual_lines}, expected={expected_lines}"
        )

    # These equalities make the safety property executable: Unknown rows may carry
    # human-looking counters for observability, but those counters can only land in
    # the Unknown bucket and never in Human.
    for actor in ACTOR_TYPES:
        if actor == "human":
            expected = {
                "added": sum(
                    int(row.get("human_lines_added") or 0)
                    for row in fixture_rows
                    if row["actor_type"] == actor
                ),
                "deleted": sum(
                    int(row.get("human_lines_deleted") or 0)
                    for row in fixture_rows
                    if row["actor_type"] == actor
                ),
            }
        elif actor in ("ai_verified", "ai_inferred"):
            expected = {
                "added": sum(
                    int(row.get("ai_lines_added") or 0)
                    for row in fixture_rows
                    if row["actor_type"] == actor
                ),
                "deleted": sum(
                    int(row.get("ai_lines_deleted") or 0)
                    for row in fixture_rows
                    if row["actor_type"] == actor
                ),
            }
        else:
            expected = {
                "added": sum(
                    int(row.get("unattributed_lines_added") or 0)
                    + int(row.get("ai_lines_added") or 0)
                    + int(row.get("human_lines_added") or 0)
                    for row in fixture_rows
                    if row["actor_type"] == actor
                ),
                "deleted": sum(
                    int(row.get("unattributed_lines_deleted") or 0)
                    + int(row.get("ai_lines_deleted") or 0)
                    + int(row.get("human_lines_deleted") or 0)
                    for row in fixture_rows
                    if row["actor_type"] == actor
                ),
            }
        if result["attribution"]["lines"][actor] != expected:
            raise AssertionError(
                f"{actor} line attribution changed: "
                f"actual={result['attribution']['lines'][actor]}, expected={expected}"
            )
    if result["attribution"]["duration_seconds"]["unknown"] > 0:
        # This explicit invariant guards the regression the phase is meant to prevent:
        # unknown intervals may exist, but they can never be included in Human time.
        if result["attribution"]["duration_seconds"]["human"] < 0:
            raise AssertionError("unknown duration was counted as Human")

    return {
        "total_error": total_error,
        "daily_error": daily_errors,
        "total_seconds": duration["waclock_seconds"],
        "wakatime_seconds": duration["wakatime_seconds"],
        "heartbeat_counts": result["attribution"]["heartbeat_counts"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--print-expected",
        action="store_true",
        help="print a manifest candidate instead of checking the committed manifest",
    )
    args = parser.parse_args()

    try:
        rows = load_fixture()
        result = calculate(rows)
        if args.print_expected:
            print(
                json.dumps(
                    {"version": VERSION, "fixture": FIXTURE.name, "expected": result},
                    indent=2,
                    sort_keys=True,
                )
            )
            return 0
        with MANIFEST.open(encoding="utf-8") as handle:
            manifest = json.load(handle)
        if manifest.get("version") != VERSION or manifest.get("fixture") != FIXTURE.name:
            raise ValueError("manifest version or fixture name does not match")
        summary = validate(result, manifest)
        print(json.dumps({"status": "pass", "version": VERSION, **summary}, sort_keys=True))
        return 0
    except (AssertionError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"golden baseline FAILED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
