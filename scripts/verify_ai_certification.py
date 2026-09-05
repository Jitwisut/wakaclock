#!/usr/bin/env python3
"""Verify metadata-only Universal AI adapter certification artifacts.

The verifier is intentionally independent of the backend.  It checks the small
reviewable artifact that is safe to commit, while refusing prompt, source,
command, path, identity, and credential fields.  A directory argument verifies
every ``*.json`` artifact below it; a file argument verifies one artifact.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
STATUSES = {"verified", "scaffold", "unverified"}
MAX_AGE = dt.timedelta(days=30)
MAX_FUTURE_SKEW = dt.timedelta(minutes=5)
ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
ALLOWED_KEYS = {
    "schema_version",
    "status",
    "client_id",
    "provider_id",
    "model_id",
    "client_version",
    "plugin_version",
    "contract_version",
    "fingerprint_version",
    "checked_at_utc",
    "expires_at_utc",
    "tested_commit_sha",
    "timezone",
    "scenario_ids",
    "live_e2e",
    "captured_events",
    "correlated_events",
    "canonical_activities",
    "duplicate_events",
    "delivered_events",
    "replayed_events",
    "delivery_result",
    "tolerance",
    "blockers",
}
FORBIDDEN_KEYS = {
    "api_key",
    "authorization",
    "command",
    "command_args",
    "content",
    "diff",
    "entity",
    "file",
    "filename",
    "heartbeat_id",
    "home",
    "path",
    "patch",
    "prompt",
    "response",
    "source",
    "source_code",
    "source_content",
    "token",
    "user",
    "user_id",
    "username",
}
REQUIRED_KEYS = {
    "schema_version",
    "status",
    "client_id",
    "provider_id",
    "model_id",
    "client_version",
    "plugin_version",
    "contract_version",
    "fingerprint_version",
    "checked_at_utc",
    "tested_commit_sha",
    "timezone",
    "scenario_ids",
    "live_e2e",
    "captured_events",
    "correlated_events",
    "canonical_activities",
    "duplicate_events",
    "delivered_events",
    "replayed_events",
    "delivery_result",
    "blockers",
}


def walk_keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {key for child in value.values() for key in walk_keys(child)}
    if isinstance(value, list):
        return {key for child in value for key in walk_keys(child)}
    return set()


def parse_timestamp(value: Any, field: str, errors: list[str]) -> dt.datetime | None:
    if not isinstance(value, str):
        errors.append(f"{field} must be an ISO-8601 timestamp")
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        errors.append(f"{field} must be an ISO-8601 timestamp")
        return None
    if parsed.tzinfo is None:
        errors.append(f"{field} must include a timezone")
        return None
    return parsed.astimezone(dt.timezone.utc)


def nonnegative_int(report: dict[str, Any], field: str, errors: list[str]) -> int:
    value = report.get(field)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        errors.append(f"{field} must be a non-negative integer")
        return 0
    if value > 10_000_000:
        errors.append(f"{field} exceeds the certification bound")
    return value


def verify_report(report: Any, *, now: dt.datetime | None = None) -> list[str]:
    errors: list[str] = []
    if not isinstance(report, dict):
        return ["report must be a JSON object"]
    keys = set(report)
    missing = sorted(REQUIRED_KEYS - keys)
    unknown = sorted(keys - ALLOWED_KEYS)
    if missing:
        errors.append(f"missing fields: {', '.join(missing)}")
    if unknown:
        errors.append(f"unknown fields: {', '.join(unknown)}")
    forbidden = sorted(walk_keys(report) & FORBIDDEN_KEYS)
    if forbidden:
        errors.append(f"forbidden privacy fields: {', '.join(forbidden)}")
    if report.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version must be {SCHEMA_VERSION}")
    status = report.get("status")
    if status not in STATUSES:
        errors.append("status must be verified, scaffold, or unverified")
    for field in ("client_id", "provider_id", "contract_version", "fingerprint_version"):
        value = report.get(field)
        if not isinstance(value, str) or not ID_RE.fullmatch(value):
            errors.append(f"{field} must be a bounded lowercase identifier")
    for field in ("model_id", "client_version", "plugin_version"):
        value = report.get(field)
        if value is not None and (not isinstance(value, str) or len(value) > 256):
            errors.append(f"{field} must be null or a bounded string")
    timezone = report.get("timezone")
    if not isinstance(timezone, str) or not timezone or len(timezone) > 64:
        errors.append("timezone must be a bounded non-empty string")
    sha = report.get("tested_commit_sha")
    if not isinstance(sha, str) or not SHA_RE.fullmatch(sha):
        errors.append("tested_commit_sha must be a full lowercase Git SHA")
    checked = parse_timestamp(report.get("checked_at_utc"), "checked_at_utc", errors)
    current = now or dt.datetime.now(dt.timezone.utc)
    if checked is not None:
        age = current - checked
        if age > MAX_AGE:
            errors.append("certification is older than 30 days")
        if age < -MAX_FUTURE_SKEW:
            errors.append("checked_at_utc is too far in the future")
    expires = report.get("expires_at_utc")
    if expires is not None:
        expires_at = parse_timestamp(expires, "expires_at_utc", errors)
        if expires_at is not None and current > expires_at:
            errors.append("certification has expired")
        if checked is not None and expires_at is not None and expires_at < checked:
            errors.append("expires_at_utc must not precede checked_at_utc")
    scenarios = report.get("scenario_ids")
    if not isinstance(scenarios, list) or not scenarios or any(
        not isinstance(item, str) or not ID_RE.fullmatch(item) for item in scenarios
    ):
        errors.append("scenario_ids must contain one or more bounded identifiers")
    blockers = report.get("blockers")
    if not isinstance(blockers, list) or any(
        not isinstance(item, str) or not item or len(item) > 256 for item in blockers
    ):
        errors.append("blockers must be a list of bounded strings")
    delivery = report.get("delivery_result")
    if not isinstance(delivery, str) or delivery not in {"delivered", "not_observed", "blocked"}:
        errors.append("delivery_result must be delivered, not_observed, or blocked")
    live = report.get("live_e2e")
    if not isinstance(live, bool):
        errors.append("live_e2e must be boolean")

    counts = {
        field: nonnegative_int(report, field, errors)
        for field in (
            "captured_events",
            "correlated_events",
            "canonical_activities",
            "duplicate_events",
            "delivered_events",
            "replayed_events",
        )
    }
    if counts["correlated_events"] > counts["captured_events"]:
        errors.append("correlated_events cannot exceed captured_events")
    if counts["canonical_activities"] > counts["captured_events"]:
        errors.append("canonical_activities cannot exceed captured_events")
    if counts["duplicate_events"] > counts["captured_events"]:
        errors.append("duplicate_events cannot exceed captured_events")
    if counts["delivered_events"] > counts["captured_events"]:
        errors.append("delivered_events cannot exceed captured_events")
    if status == "verified":
        if live is not True:
            errors.append("verified artifacts require live_e2e=true")
        if counts["captured_events"] == 0 or counts["canonical_activities"] == 0:
            errors.append("verified artifacts require observed events and activities")
        if counts["delivered_events"] == 0 or delivery != "delivered":
            errors.append("verified artifacts require successful delivery")
    elif live is True:
        errors.append("scaffold/unverified artifacts cannot claim live_e2e=true")
    if status in {"scaffold", "unverified"} and not blockers:
        errors.append("scaffold/unverified artifacts must list a blocker")
    if status == "verified" and delivery == "blocked":
        errors.append("verified artifacts cannot have blocked delivery")
    return errors


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path, help="artifact JSON or certification directory")
    args = parser.parse_args()
    paths = [args.path] if args.path.is_file() else sorted(args.path.rglob("*.json"))
    if not paths:
        print(f"no certification artifacts found under {args.path}", file=sys.stderr)
        return 1
    failures = 0
    for path in paths:
        try:
            report = load(path)
        except (OSError, json.JSONDecodeError) as error:
            print(f"{path}: invalid JSON ({error})", file=sys.stderr)
            failures += 1
            continue
        errors = verify_report(report)
        if errors:
            print(f"{path}: FAILED", file=sys.stderr)
            print("\n".join(f"  - {error}" for error in errors), file=sys.stderr)
            failures += 1
        else:
            print(f"{path}: passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
