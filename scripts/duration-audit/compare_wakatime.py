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
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

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
    if isinstance(value, (int, float)):
        return max(0.0, float(value))
    return 0.0


def _summary_days(payload: dict) -> dict[str, float]:
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
        seconds = _seconds(total.get("total_seconds"))
        if seconds == 0.0:
            seconds = _seconds(row.get("total_seconds"))
        result[date] = seconds
    return result


def _relative_error(actual: float, expected: float) -> float:
    return abs(actual - expected) / max(abs(expected), 1.0)


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
            )
        )
    except (OSError, ValueError, urllib.error.URLError) as error:
        wakaclock = {}
        errors.append({"source": "wakaclock", "error": type(error).__name__})
    dates = sorted(set(wakatime) | set(wakaclock))
    observations = []
    for date in dates:
        expected = wakatime.get(date, 0.0)
        actual = wakaclock.get(date, 0.0)
        observations.append(
            {
                "date": date,
                "wakatime_seconds": expected,
                "wakaclock_seconds": actual,
                "absolute_error_seconds": abs(actual - expected),
                "relative_error": _relative_error(actual, expected),
            }
        )
    expected_total = sum(wakatime.values())
    actual_total = sum(wakaclock.values())
    report = {
        "schema_version": 1,
        "status": "error" if errors else "advisory",
        "checked_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "tested_commit_sha": _commit_sha(),
        "range": {"start": start, "end": end},
        "timezone": timezone,
        "errors": errors,
        "total": {
            "wakatime_seconds": expected_total,
            "wakaclock_seconds": actual_total,
            "absolute_error_seconds": abs(actual_total - expected_total),
            "relative_error": _relative_error(actual_total, expected_total),
        },
        "max_daily_relative_error": max(
            (item["relative_error"] for item in observations), default=0.0
        ),
        "observations": observations,
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
