#!/usr/bin/env python3
"""Emit a sanitized release certification from one live API comparison.

The raw export is intentionally read only from the ignored ``hb.jsonl`` file. The
output contains no user ID, path, prompt, diff, or source content, so it can be
reviewed and committed as a release artifact when the live gate is run.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from urllib.error import HTTPError
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from timeline import wakatime_durations  # noqa: E402


def fetch(base: str, key: str, start: str, end: str) -> dict:
    token = base64.b64encode(key.encode()).decode()
    request = urllib.request.Request(
        f"{base.rstrip('/')}/api/v1/users/current/summaries?start={start}&end={end}",
        headers={"Authorization": f"Basic {token}"},
    )
    return fetch_json(request)


def fetch_explorer(
    base: str, key: str, start: str, end: str, actor_type: str | None = None
) -> dict:
    path = f"/api/v1/dashboard/explorer?start={start}&end={end}"
    if actor_type is not None:
        path += f"&actor_type={actor_type}"
    request = urllib.request.Request(
        f"{base.rstrip('/')}{path}",
        headers={"Authorization": "Basic " + base64.b64encode(key.encode()).decode()},
    )
    return fetch_json(request)


def relative_error(actual: float, reference: float) -> float:
    return abs(actual - reference) / max(abs(reference), 1.0)


ACTOR_TYPES = ("human", "ai_verified", "ai_inferred", "unknown")


def fetch_json(request: urllib.request.Request) -> dict:
    for attempt in range(8):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code != 429 or attempt == 7:
                raise
            retry_after = error.headers.get("Retry-After")
            try:
                delay = max(float(retry_after or "2.1"), 2.1)
            except ValueError:
                delay = 2.1
            time.sleep(delay)
    raise AssertionError("unreachable")


def explorer_duration(payload: dict) -> dict[str, float]:
    summary = payload.get("summary", {})
    # The public explorer response exposes duration fields directly on summary;
    # accept the nested shape used by older local fixtures as well.
    duration = summary.get("duration", summary)
    return {
        "human": float(duration.get("human_seconds", 0.0)),
        "ai_verified": float(duration.get("ai_verified_seconds", 0.0)),
        "ai_inferred": float(duration.get("ai_inferred_seconds", 0.0)),
        "unknown": float(duration.get("unknown_seconds", 0.0)),
        "total": float(duration.get("total_seconds", 0.0)),
    }


def write_report(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(report, indent=2, sort_keys=True) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False
    ) as temporary:
        temporary.write(encoded)
        temporary_path = Path(temporary.name)
    os.replace(temporary_path, path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default=os.environ.get("WAKACLOCK_API", "http://localhost:8080"))
    parser.add_argument("--key", default=os.environ.get("WAKACLOCK_API_KEY", ""))
    parser.add_argument("--raw", type=Path, default=HERE / "hb.jsonl")
    parser.add_argument(
        "--output",
        type=Path,
        default=HERE / "certifications" / "latest.json",
        help="sanitized report path; defaults to certifications/latest.json",
    )
    args = parser.parse_args()
    if not args.key:
        print("set WAKACLOCK_API_KEY (or pass --key)", file=sys.stderr)
        return 2
    if not args.raw.exists():
        print(f"missing ignored live export: {args.raw.name}; run export.sh first", file=sys.stderr)
        return 2

    with args.raw.open(encoding="utf-8") as handle:
        heartbeats = [json.loads(line) for line in handle if line.strip()]
    if not heartbeats:
        print("live export is empty", file=sys.stderr)
        return 2

    by_day: dict[str, list[dict]] = {}
    for heartbeat in heartbeats:
        day = dt.datetime.fromtimestamp(float(heartbeat["time"]), dt.timezone.utc).date().isoformat()
        by_day.setdefault(day, []).append(heartbeat)
    start, end = min(by_day), max(by_day)
    response = fetch(args.base, args.key, start, end)
    reported = {entry["date"]: entry for entry in response.get("days", [])}

    daily = []
    actor_totals = {actor: 0.0 for actor in ACTOR_TYPES}
    actor_partition_error = 0.0
    actor_filter_error = 0.0
    duration_surface_error = 0.0
    filtered_totals = {
        actor: explorer_duration(fetch_explorer(args.base, args.key, start, end, actor))["total"]
        for actor in ACTOR_TYPES
    }
    for day in sorted(by_day):
        reference, _ = wakatime_durations(by_day[day], 900.0)
        entry = reported.get(day)
        api_seconds = float((entry or {}).get("grand_total", {}).get("total_seconds", 0.0))
        explorer = explorer_duration(fetch_explorer(args.base, args.key, day, day))
        for actor in ACTOR_TYPES:
            actor_totals[actor] += explorer[actor]
        actor_partition_error = max(
            actor_partition_error,
            abs(sum(explorer[actor] for actor in ACTOR_TYPES) - explorer["total"]),
        )
        duration_surface_error = max(duration_surface_error, abs(explorer["total"] - api_seconds))
        daily.append(
            {
                "date": day,
                "api_seconds": api_seconds,
                "wakatime_seconds": reference,
                "relative_error": relative_error(api_seconds, reference),
                "actor_total_seconds": explorer["total"],
            }
        )

    for actor in ACTOR_TYPES:
        actor_filter_error = max(
            actor_filter_error,
            abs(actor_totals[actor] - filtered_totals[actor]),
        )

    api_total = sum(item["api_seconds"] for item in daily)
    reference_total = sum(item["wakatime_seconds"] for item in daily)
    total_error = relative_error(api_total, reference_total)
    eligible_daily = [item for item in daily if item["wakatime_seconds"] >= 60.0]
    max_daily_error = max((item["relative_error"] for item in eligible_daily), default=0.0)
    status = (
        "pass"
        if total_error <= 0.01
        and max_daily_error <= 0.03
        and actor_partition_error <= 0.5
        and actor_filter_error <= 0.5
        and duration_surface_error <= 0.5
        else "fail"
    )
    try:
        commit_sha = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=HERE.parent.parent, text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        commit_sha = "unknown"

    report = {
        "schema_version": 2,
        "evidence_kind": "internal_api_replay_consistency",
        "reference_source": "local_wakatime_algorithm_on_wakaclock_export",
        "external_wakatime_verified": False,
        "status": status,
        "checked_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "tested_commit_sha": commit_sha,
        "range": {"start": start, "end": end},
        "total": {
            "api_seconds": api_total,
            "algorithm_reference_seconds": reference_total,
            "wakatime_seconds": reference_total,  # Legacy field; see reference_source.
            "relative_error": total_error,
        },
        "max_eligible_daily_error": max_daily_error,
        "actor_totals_seconds": actor_totals,
        "actor_partition_error_seconds": actor_partition_error,
        "actor_filter_error_seconds": actor_filter_error,
        "duration_surface_error_seconds": duration_surface_error,
        "unknown_counted_as_human": actor_filter_error > 0.5,
        "limits": {
            "max_total_error": 0.01,
            "max_daily_error": 0.03,
            "min_daily_seconds": 60.0,
            "max_actor_partition_error_seconds": 0.5,
            "max_actor_filter_error_seconds": 0.5,
            "max_duration_surface_error_seconds": 0.5,
        },
    }
    write_report(args.output, report)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if status == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
