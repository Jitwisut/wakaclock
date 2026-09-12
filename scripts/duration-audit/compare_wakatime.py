#!/usr/bin/env python3
"""Compare one controlled activity window with the real WakaTime summaries API.

This is deliberately advisory. WakaTime and Wakaclock observe different facts, so a
positive bias is expected when the client measured activity that WakaTime did not see.
Credentials are read only from environment variables and the report is sanitized before
it is written.
"""
from __future__ import annotations

import base64
import datetime as dt
import json
import math
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
DEFAULT_OUTPUT = HERE / "certifications" / "wakatime-parity.json"


def _fetch(base: str, key: str, start: str, end: str, timezone: str) -> dict:
    query = urllib.parse.urlencode({"start": start, "end": end, "timezone": timezone})
    token = base64.b64encode(key.encode("utf-8")).decode("ascii")
    request = urllib.request.Request(
        f"{base.rstrip('/')}/api/v1/users/current/summaries?{query}",
        headers={"Authorization": f"Basic {token}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise ValueError("summary response must be an object")
    return payload


def _seconds(value: object) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        seconds = float(value)
        if math.isfinite(seconds) and seconds >= 0:
            return seconds
    raise ValueError("missing or invalid duration measurement")


def _summary_days(payload: dict, *, comparable: bool = False) -> dict[str, float]:
    """Normalize WakaTime and Wakaclock summary envelopes to date -> seconds."""
    rows = payload.get("days", payload.get("data", []))
    if not isinstance(rows, list):
        raise ValueError("summary response has no days/data list")
    result: dict[str, float] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        date = row.get("date")
        if not isinstance(date, str):
            date = (row.get("range") or {}).get("date")
        if not isinstance(date, str):
            date = (row.get("range") or {}).get("start")
        if not isinstance(date, str):
            continue
        total = row.get("grand_total") or {}
        if not isinstance(total, dict):
            total = {}
        if comparable:
            evidence = total.get("evidence") or {}
            value = total.get("comparable_seconds", evidence.get("comparable_seconds"))
        else:
            value = total.get("total_seconds", row.get("total_seconds"))
        seconds = _seconds(value)
        date = date[:10]
        result[date] = seconds
    return result


def _raw_activity_baseline(path: Path, start: str, end: str, timezone: str) -> dict:
    """Summarize the local export without exposing paths, entities, or source content.

    A summary endpoint can prove a total but cannot explain a missing minute. This
    companion baseline counts the observations that reached the local export, the
    measured segments they carried, and gaps that need interval-level investigation.
    It never creates a heartbeat and treats an absent export as unavailable rather than
    as an empty day.
    """
    if not path.exists():
        return {"status": "unavailable", "reason": "raw_export_missing"}
    first, last = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    requested = {
        (first + dt.timedelta(days=i)).isoformat()
        for i in range((last - first).days + 1)
    }
    try:
        zone = ZoneInfo(timezone)
    except Exception:
        return {"status": "unavailable", "reason": "invalid_timezone"}
    rows_by_day: dict[str, list[dict]] = {date: [] for date in requested}
    invalid_timestamps = 0
    pending_or_failed = 0
    try:
        handle = path.open(encoding="utf-8")
    except OSError:
        return {"status": "unavailable", "reason": "raw_export_unreadable"}
    with handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except (TypeError, json.JSONDecodeError):
                invalid_timestamps += 1
                continue
            if not isinstance(row, dict):
                invalid_timestamps += 1
                continue
            raw_time = row.get("time")
            if isinstance(raw_time, bool) or not isinstance(raw_time, (int, float)):
                invalid_timestamps += 1
                continue
            timestamp = float(raw_time)
            if not math.isfinite(timestamp):
                invalid_timestamps += 1
                continue
            date = dt.datetime.fromtimestamp(timestamp, zone).date().isoformat()
            if date not in rows_by_day:
                continue
            rows_by_day[date].append(row)
            delivery = str(
                row.get("delivery_status", row.get("ingest_status", row.get("delivery", "")))
            ).strip().lower()
            if delivery in {"queued", "pending", "failed", "retry", "dead_letter", "dead-letter"}:
                pending_or_failed += 1

    days: dict[str, dict[str, object]] = {}
    for date in sorted(requested):
        rows = rows_by_day[date]
        timestamps = sorted(
            float(row["time"])
            for row in rows
            if isinstance(row.get("time"), (int, float)) and not isinstance(row.get("time"), bool)
        )
        gaps = [right - left for left, right in zip(timestamps, timestamps[1:]) if right >= left]
        measured = 0
        anchors = 0
        for row in rows:
            active = row.get("active_seconds")
            if isinstance(active, (int, float)) and not isinstance(active, bool) and math.isfinite(float(active)) and float(active) > 0:
                measured += 1
            else:
                anchors += 1
        days[date] = {
            "observed_heartbeats": len(rows),
            "measured_heartbeats": measured,
            "zero_duration_or_unmeasured_heartbeats": anchors,
            "gap_seconds": round(sum(gaps), 3),
            "within_client_window_seconds": round(sum(g for g in gaps if g <= 120), 3),
            "timeout_bridge_candidate_seconds": round(sum(g for g in gaps if 120 < g <= 900), 3),
            "idle_gap_seconds": round(sum(g for g in gaps if g > 900), 3),
            "status": "observed" if rows else "unavailable",
            "reason": None if rows else "no_exported_heartbeats",
        }
    return {
        "status": "observed" if any(rows_by_day.values()) else "unavailable",
        "source": "local_heartbeat_export",
        "interval_diagnosis": "requires_activity_interval_export",
        "pending_or_failed_rows_reported_by_export": pending_or_failed,
        "invalid_rows_or_timestamps": invalid_timestamps,
        "days": days,
    }


def _relative_error(actual: float, expected: float) -> float:
    return abs(actual - expected) / max(abs(expected), 1.0)


def _settle_window(raw: str | None) -> float:
    """Return a bounded queue-settle delay for eventually consistent uploads.

    The API cannot observe a client's private offline queue, so the comparison tool
    offers a small, explicit grace period before taking both read-only snapshots. A
    zero value keeps local/CI runs immediate; values above five minutes are rejected
    instead of turning a typo into a very long audit.
    """
    if raw is None or not raw.strip():
        return 0.0
    try:
        seconds = float(raw)
    except ValueError as error:
        raise ValueError("WAKACLOCK_SETTLE_SECONDS must be a number from 0 to 300") from error
    if not math.isfinite(seconds) or seconds < 0 or seconds > 300:
        raise ValueError("WAKACLOCK_SETTLE_SECONDS must be a number from 0 to 300")
    return seconds


def _commit_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=HERE.parent.parent, text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def main() -> int:
    start = os.environ.get("WAKATIME_COMPARE_START")
    end = os.environ.get("WAKATIME_COMPARE_END")
    timezone = os.environ.get("WAKATIME_TIMEZONE", "UTC")
    wakatime_key = os.environ.get("WAKATIME_API_KEY", "")
    wakaclock_key = os.environ.get("WAKACLOCK_API_KEY", "")
    if not start or not end:
        print("set WAKATIME_COMPARE_START and WAKATIME_COMPARE_END (YYYY-MM-DD)", file=sys.stderr)
        return 2
    if not wakatime_key or not wakaclock_key:
        print("set WAKATIME_API_KEY and WAKACLOCK_API_KEY", file=sys.stderr)
        return 2
    try:
        dt.date.fromisoformat(start)
        dt.date.fromisoformat(end)
    except ValueError:
        print("comparison dates must use YYYY-MM-DD", file=sys.stderr)
        return 2
    if start > end:
        print("comparison start must not be after end", file=sys.stderr)
        return 2

    try:
        settle_seconds = _settle_window(os.environ.get("WAKACLOCK_SETTLE_SECONDS"))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2
    if settle_seconds:
        print(
            f"waiting {settle_seconds:g}s for client delivery queues to settle before read-only snapshots",
            file=sys.stderr,
        )
        time.sleep(settle_seconds)

    raw_path = Path(
        os.environ.get("WAKACLOCK_RAW_HEARTBEATS", str(HERE / "hb.jsonl"))
    )
    baseline = _raw_activity_baseline(raw_path, start, end, timezone)

    errors: list[dict[str, str]] = []
    try:
        wakatime = _summary_days(
            _fetch("https://wakatime.com", wakatime_key, start, end, timezone)
        )
    except (OSError, ValueError, urllib.error.URLError) as error:
        # Keep the report useful and safe even when one endpoint is unavailable. Do
        # not serialize exception text: HTTP client errors can echo request URLs or
        # server responses, neither of which belongs in the sanitized artifact.
        wakatime = {}
        errors.append({"source": "wakatime", "error": type(error).__name__})
    try:
        wakaclock = _summary_days(
            _fetch(
                os.environ.get("WAKACLOCK_API", "http://localhost:8080"),
                wakaclock_key,
                start,
                end,
                timezone,
            ),
            comparable=True,
        )
    except (OSError, ValueError, urllib.error.URLError) as error:
        wakaclock = {}
        errors.append({"source": "wakaclock", "error": type(error).__name__})
    first, last = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    dates = [(first + dt.timedelta(days=i)).isoformat() for i in range((last - first).days + 1)]
    today = dt.datetime.now(ZoneInfo(timezone)).date().isoformat()
    observations = []
    for date in dates:
        expected = wakatime.get(date)
        actual = wakaclock.get(date)
        if expected is None or actual is None:
            observations.append({"date": date, "status": "unavailable", "reason": "missing_measurement"})
            continue
        observations.append(
            {
                "date": date,
                "status": "provisional" if date >= today else ("pass" if abs(actual - expected) <= 120 else "fail"),
                "wakatime_seconds": expected,
                "wakaclock_seconds": actual,
                "absolute_error_seconds": abs(actual - expected),
                "relative_error": _relative_error(actual, expected),
            }
        )
    expected_total = sum(wakatime.values())
    actual_total = sum(wakaclock.values())
    unavailable_days = sum(item["status"] == "unavailable" for item in observations)
    provisional_days = sum(item["status"] == "provisional" for item in observations)
    complete_days = len(observations) - unavailable_days - provisional_days
    acceptance_passed = (
        not errors
        and len(observations) >= 7
        and unavailable_days == 0
        and provisional_days == 0
        and all(item["status"] == "pass" for item in observations)
    )
    report = {
        "schema_version": 1,
        "status": "error" if errors else ("advisory" if acceptance_passed else "incomplete"),
        "checked_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "tested_commit_sha": _commit_sha(),
        "range": {"start": start, "end": end},
        "timezone": timezone,
        "settle_seconds": settle_seconds,
        "errors": errors,
        "total": {
            "status": "available" if unavailable_days == 0 else "incomplete",
            "wakatime_seconds": expected_total,
            "wakaclock_seconds": actual_total,
            "absolute_error_seconds": abs(actual_total - expected_total),
            "relative_error": _relative_error(actual_total, expected_total),
        },
        "max_daily_relative_error": max(
            (item["relative_error"] for item in observations if "relative_error" in item), default=0.0
        ),
        "acceptance": {
            "daily_limit_seconds": 120,
            "required_complete_days": 7,
            "complete_days": complete_days,
            "unavailable_days": unavailable_days,
            "provisional_days": provisional_days,
            "passed": acceptance_passed,
            "interval_diagnosis": "unavailable_summary_only",
        },
        "observations": observations,
        "baseline": baseline,
    }
    output = Path(os.environ.get("WAKATIME_COMPARE_OUTPUT", str(DEFAULT_OUTPUT)))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    # Keep this useful in local/CI observation scripts without making it a gate: a
    # caller can distinguish an incomplete comparison from a completed advisory one,
    # while the workflow intentionally does not invoke this script as a required job.
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
