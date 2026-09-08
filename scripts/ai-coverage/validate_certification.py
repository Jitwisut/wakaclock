#!/usr/bin/env python3
"""Validate a versioned, privacy-safe AI adapter certification artifact.

The validator is deliberately independent of the live client.  It validates
the metadata produced by a driver and enforces the promotion boundary: only a
fresh, reviewed live run with every source→broker→API→dashboard stage passed
can become ``verified``.  Fixture and historical records remain useful evidence
but can never promote an adapter by themselves.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 2
STATUSES = {"verified", "scaffold", "unverified"}
REVIEW_STATUSES = {"approved", "pending", "historical", "revoked"}
EVIDENCE_KINDS = {"live", "fixture", "historical"}
ROW_STATUSES = {"passed", "failed", "skipped", "not_run"}
MAX_AGE = dt.timedelta(days=30)
MAX_FUTURE_SKEW = dt.timedelta(minutes=5)
MAX_STRING = 256
MAX_LIST = 64
MAX_COUNT = 10_000_000
ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
SHA1_RE = re.compile(r"^[0-9a-f]{40}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
EMAIL_RE = re.compile(r"\b[^\s@/]+@[^\s@/]+\.[^\s@/]+\b")
WINDOWS_PATH_RE = re.compile(r"\b[A-Za-z]:[\\/]")

MANDATORY_STAGES = (
    "source_capture",
    "producer_event",
    "broker_accept",
    "canonical_reconcile",
    "api_delivery",
    "dashboard_readback",
)

ALLOWED_KEYS = {
    "artifact_kind",
    "schema_version",
    "certificate_id",
    "status",
    "review_status",
    "promotable",
    "adapter_id",
    "client_id",
    "provider_id",
    "model_id",
    "tool_version",
    "producer_version",
    "runtime",
    "os",
    "arch",
    "edit_modes",
    "payload_schema_versions",
    "contract_version",
    "fingerprint_version",
    "corpus_version",
    "tested_commit_sha",
    "build_sha256",
    "started_at_utc",
    "completed_at_utc",
    "expires_at_utc",
    "evidence_kind",
    "evidence_digest",
    "stages",
    "scenarios",
    "metrics",
    "blockers",
    "limitations",
    "legacy_artifact_sha256",
}

FORBIDDEN_KEYS = {
    "account",
    "account_id",
    "api_key",
    "authorization",
    "command",
    "command_args",
    "content",
    "cwd",
    "diff",
    "email",
    "entity",
    "file",
    "filename",
    "home",
    "hostname",
    "path",
    "patch",
    "prompt",
    "raw",
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
    "artifact_kind",
    "schema_version",
    "certificate_id",
    "status",
    "review_status",
    "promotable",
    "adapter_id",
    "client_id",
    "provider_id",
    "model_id",
    "tool_version",
    "producer_version",
    "runtime",
    "os",
    "arch",
    "edit_modes",
    "payload_schema_versions",
    "contract_version",
    "fingerprint_version",
    "corpus_version",
    "tested_commit_sha",
    "build_sha256",
    "started_at_utc",
    "completed_at_utc",
    "expires_at_utc",
    "evidence_kind",
    "evidence_digest",
    "stages",
    "scenarios",
    "metrics",
    "blockers",
    "limitations",
}


def walk_keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {key for child in value.values() for key in walk_keys(child)}
    if isinstance(value, list):
        return {key for child in value for key in walk_keys(child)}
    return set()


def walk_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [item for child in value.values() for item in walk_strings(child)]
    if isinstance(value, list):
        return [item for child in value for item in walk_strings(child)]
    return []


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


def bounded_string(report: dict[str, Any], field: str, errors: list[str], *, nullable: bool = False) -> str | None:
    value = report.get(field)
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not value or len(value) > MAX_STRING:
        errors.append(f"{field} must be a bounded non-empty string")
        return None
    return value


def bounded_id(report: dict[str, Any], field: str, errors: list[str], *, nullable: bool = False) -> str | None:
    value = report.get(field)
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not ID_RE.fullmatch(value):
        errors.append(f"{field} must be a bounded lowercase identifier")
        return None
    return value


def bounded_list(report: dict[str, Any], field: str, errors: list[str], *, ids: bool = True) -> list[str]:
    value = report.get(field)
    if not isinstance(value, list) or len(value) > MAX_LIST:
        errors.append(f"{field} must be a bounded list")
        return []
    result: list[str] = []
    for item in value:
        valid = isinstance(item, str) and len(item) <= MAX_STRING and (not ids or bool(ID_RE.fullmatch(item)))
        if not valid:
            errors.append(f"{field} contains an invalid value")
        else:
            result.append(item)
    if len(result) != len(value):
        return result
    return result


def bounded_count(value: Any, field: str, errors: list[str]) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > MAX_COUNT:
        errors.append(f"metrics.{field} must be a bounded non-negative integer")
        return 0
    return value


def validate_rows(value: Any, field: str, errors: list[str]) -> dict[str, str]:
    if not isinstance(value, list) or not value or len(value) > MAX_LIST:
        errors.append(f"{field} must contain one or more rows")
        return {}
    rows: dict[str, str] = {}
    for row in value:
        if not isinstance(row, dict) or set(row) != {"id", "status"}:
            errors.append(f"{field} rows must contain only id and status")
            continue
        row_id = row.get("id")
        status = row.get("status")
        if not isinstance(row_id, str) or not ID_RE.fullmatch(row_id):
            errors.append(f"{field} row id is invalid")
        if status not in ROW_STATUSES:
            errors.append(f"{field} row status is invalid")
        if isinstance(row_id, str):
            if row_id in rows:
                errors.append(f"{field} contains duplicate row {row_id}")
            rows[row_id] = status if isinstance(status, str) else "invalid"
    return rows


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_artifact(report: Any, *, now: dt.datetime | None = None) -> list[str]:
    errors: list[str] = []
    if not isinstance(report, dict):
        return ["artifact must be a JSON object"]
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
    suspicious = [value for value in walk_strings(report) if EMAIL_RE.search(value) or WINDOWS_PATH_RE.search(value) or value.startswith(("/Users/", "/home/", "/private/", "file://"))]
    if suspicious:
        errors.append("artifact contains a path, account identifier, or email-like value")

    if report.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version must be {SCHEMA_VERSION}")
    if report.get("artifact_kind") not in {"adapter_certification", "historical_adapter_evidence"}:
        errors.append("artifact_kind is unsupported")
    status = report.get("status")
    if status not in STATUSES:
        errors.append("status must be verified, scaffold, or unverified")
    review_status = report.get("review_status")
    if review_status not in REVIEW_STATUSES:
        errors.append("review_status is unsupported")
    if not isinstance(report.get("promotable"), bool):
        errors.append("promotable must be boolean")
    for field in ("certificate_id", "adapter_id", "client_id", "provider_id", "contract_version", "fingerprint_version"):
        bounded_id(report, field, errors)
    bounded_id(report, "corpus_version", errors, nullable=True)
    for field in ("model_id", "tool_version", "producer_version", "runtime", "os", "arch"):
        bounded_string(report, field, errors, nullable=True)
    edit_modes = bounded_list(report, "edit_modes", errors)
    payload_schemas = bounded_list(report, "payload_schema_versions", errors)
    del edit_modes, payload_schemas

    commit = report.get("tested_commit_sha")
    if commit is not None and (not isinstance(commit, str) or not SHA1_RE.fullmatch(commit)):
        errors.append("tested_commit_sha must be null or a full lowercase Git SHA")
    for field in ("build_sha256", "evidence_digest", "legacy_artifact_sha256"):
        value = report.get(field)
        if value is not None and (not isinstance(value, str) or not SHA256_RE.fullmatch(value)):
            errors.append(f"{field} must be null or a lowercase SHA-256 digest")

    started = parse_timestamp(report.get("started_at_utc"), "started_at_utc", errors)
    completed = parse_timestamp(report.get("completed_at_utc"), "completed_at_utc", errors)
    expires = parse_timestamp(report.get("expires_at_utc"), "expires_at_utc", errors)
    current = now or dt.datetime.now(dt.timezone.utc)
    if started and completed and completed < started:
        errors.append("completed_at_utc must not precede started_at_utc")
    if completed and expires and expires < completed:
        errors.append("expires_at_utc must not precede completed_at_utc")
    if completed and completed - current > MAX_FUTURE_SKEW:
        errors.append("completed_at_utc is too far in the future")
    historical = (
        report.get("artifact_kind") == "historical_adapter_evidence"
        or report.get("review_status") == "historical"
        or report.get("evidence_kind") == "historical"
    )
    if not historical and expires and current > expires:
        errors.append("certification has expired")
    if not historical and completed and current - completed > MAX_AGE:
        errors.append("certification is older than 30 days")

    evidence_kind = report.get("evidence_kind")
    if evidence_kind not in EVIDENCE_KINDS:
        errors.append("evidence_kind is unsupported")
    stages = validate_rows(report.get("stages"), "stages", errors)
    scenarios = validate_rows(report.get("scenarios"), "scenarios", errors)
    metrics = report.get("metrics")
    if not isinstance(metrics, dict) or set(metrics) - {"captured", "producer_events", "broker_accepted", "canonical", "delivered", "duplicates", "replayed"}:
        errors.append("metrics contains unknown fields")
        metrics = {}
    counts = {field: bounded_count(metrics.get(field), field, errors) for field in ("captured", "producer_events", "broker_accepted", "canonical", "delivered", "duplicates", "replayed")}
    if report.get("artifact_kind") != "historical_adapter_evidence" and (
        counts["producer_events"] > counts["captured"]
        or counts["broker_accepted"] > counts["producer_events"]
        or counts["canonical"] > counts["broker_accepted"]
        or counts["delivered"] > counts["canonical"]
    ):
        errors.append("stage counts must be monotonic")
    for field in ("blockers", "limitations"):
        values = report.get(field)
        if not isinstance(values, list) or len(values) > MAX_LIST or any(not isinstance(item, str) or not item or len(item) > MAX_STRING for item in values):
            errors.append(f"{field} must be a bounded list of strings")

    promotable = report.get("promotable") is True
    if promotable:
        if status != "verified" or review_status != "approved":
            errors.append("promotable artifacts require status=verified and review_status=approved")
        if evidence_kind != "live":
            errors.append("promotable artifacts require live evidence")
        if report.get("build_sha256") is None or report.get("tested_commit_sha") is None or report.get("evidence_digest") is None:
            errors.append("promotable artifacts require build, commit, and evidence digests")
        if not all(stages.get(stage) == "passed" for stage in MANDATORY_STAGES):
            errors.append("promotable artifacts require every mandatory stage to pass")
        if not any(value == "passed" for value in scenarios.values()):
            errors.append("promotable artifacts require at least one passed scenario")
        if report.get("blockers") or report.get("limitations"):
            errors.append("promotable artifacts cannot carry blockers or limitations")
        if any(report.get(field) in (None, "", []) for field in ("tool_version", "producer_version", "runtime", "os", "arch")):
            errors.append("promotable artifacts require a complete runtime tuple")
    elif status == "verified" and evidence_kind not in {"live", "historical"}:
        errors.append("fixture evidence cannot claim verified status")
    if report.get("artifact_kind") == "historical_adapter_evidence" and promotable:
        errors.append("historical evidence can never be promotable")
    if review_status == "revoked" and promotable:
        errors.append("revoked artifacts cannot be promotable")
    return errors


def validate_file(path: Path, *, now: dt.datetime | None = None) -> list[str]:
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"invalid JSON: {error}"]
    return validate_artifact(report, now=now)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    paths = [args.path] if args.path.is_file() else sorted(args.path.rglob("*.json"))
    if not paths:
        print(f"no certification artifacts found under {args.path}", file=sys.stderr)
        return 1
    failures = 0
    for path in paths:
        errors = validate_file(path)
        if errors:
            failures += 1
            print(f"{path}: FAILED", file=sys.stderr)
            print("\n".join(f"  - {error}" for error in errors), file=sys.stderr)
        else:
            print(f"{path}: passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
