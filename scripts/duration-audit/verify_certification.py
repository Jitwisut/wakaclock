#!/usr/bin/env python3
"""Validate the shape and thresholds of the sanitized live certification."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

ACTORS = ("human", "ai_verified", "ai_inferred", "unknown")
MAX_CERTIFICATION_AGE = dt.timedelta(days=30)
MAX_FUTURE_SKEW = dt.timedelta(minutes=5)
REQUIRED = {
    "schema_version",
    "status",
    "checked_at_utc",
    "tested_commit_sha",
    "range",
    "total",
    "max_eligible_daily_error",
    "actor_totals_seconds",
    "actor_partition_error_seconds",
    "actor_filter_error_seconds",
    "duration_surface_error_seconds",
    "unknown_counted_as_human",
    "limits",
}
FORBIDDEN_KEYS = {
    "api_key",
    "authorization",
    "content",
    "entity",
    "heartbeat_id",
    "path",
    "patch",
    "prompt",
    "project",
    "response",
    "source",
    "source_content",
    "token",
    "user_id",
}


def walk_keys(value: object) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {key for child in value.values() for key in walk_keys(child)}
    if isinstance(value, list):
        return {key for child in value for key in walk_keys(child)}
    return set()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "path",
        nargs="?",
        type=Path,
        default=Path(__file__).resolve().parent / "certifications" / "latest.json",
    )
    args = parser.parse_args()
    try:
        report = json.loads(args.path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"certification verification FAILED: {error}", file=sys.stderr)
        return 1

    errors: list[str] = []
    if not isinstance(report, dict):
        errors.append("report must be a JSON object")
    else:
        missing = sorted(REQUIRED - set(report))
        if missing:
            errors.append(f"missing fields: {', '.join(missing)}")
        if report.get("schema_version") != 2:
            errors.append("schema_version must be 2")
        if report.get("status") != "pass":
            errors.append("status must be pass")
        checked_at = report.get("checked_at_utc")
        if not isinstance(checked_at, str):
            errors.append("checked_at_utc must be an ISO-8601 timestamp")
        else:
            try:
                parsed_checked_at = dt.datetime.fromisoformat(
                    checked_at.replace("Z", "+00:00")
                )
                if parsed_checked_at.tzinfo is None:
                    errors.append("checked_at_utc must include a timezone")
                else:
                    age = dt.datetime.now(dt.timezone.utc) - parsed_checked_at.astimezone(
                        dt.timezone.utc
                    )
                    if age > MAX_CERTIFICATION_AGE:
                        errors.append(
                            "certification is older than "
                            f"{MAX_CERTIFICATION_AGE.days} days"
                        )
                    elif age < -MAX_FUTURE_SKEW:
                        errors.append("checked_at_utc is too far in the future")
            except ValueError:
                errors.append("checked_at_utc must be an ISO-8601 timestamp")
        sha = report.get("tested_commit_sha")
        if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha):
            errors.append("tested_commit_sha must be a full Git SHA")
        forbidden = sorted(walk_keys(report) & FORBIDDEN_KEYS)
        if forbidden:
            errors.append(f"forbidden privacy fields: {', '.join(forbidden)}")

        total = report.get("total", {})
        if not isinstance(total, dict):
            errors.append("total must be an object")
        elif total.get("relative_error", 1.0) > 0.01:
            errors.append("total relative error exceeds 1%")

        if report.get("max_eligible_daily_error", 1.0) > 0.03:
            errors.append("daily relative error exceeds 3%")
        if report.get("unknown_counted_as_human") is not False:
            errors.append("Unknown must not be counted as Human")
        actors = report.get("actor_totals_seconds", {})
        if not isinstance(actors, dict) or any(actor not in actors for actor in ACTORS):
            errors.append("actor_totals_seconds must contain all actor buckets")
        if report.get("actor_partition_error_seconds", 1.0) > 0.5:
            errors.append("actor buckets do not partition the total")
        if report.get("actor_filter_error_seconds", 1.0) > 0.5:
            errors.append("actor filtered totals disagree with the breakdown")
        if report.get("duration_surface_error_seconds", 1.0) > 0.5:
            errors.append("summary and explorer totals disagree")

    if errors:
        print("certification verification FAILED", file=sys.stderr)
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"certification verification passed: {args.path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
