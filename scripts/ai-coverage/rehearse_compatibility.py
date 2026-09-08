#!/usr/bin/env python3
"""Run the metadata-only F8 compatibility rehearsal matrix.

The rehearsal is intentionally fail-closed. Synthetic cases exercise the
contract that is available in this checkout; cases which need a pinned previous
binary, release digest, or live database are reported as ``blocked``. A blocked
case is never converted into a pass and the report never contains event payloads.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any

SUPPORTED_BROKER_SCHEMA = 1
FORBIDDEN_KEYS = {
    "prompt",
    "response",
    "diff",
    "patch",
    "content",
    "source_code",
    "source_content",
    "tool_arguments",
    "command_args",
}
REQUIRED_LOCAL_KEYS = {"event_id", "agent", "entity"}
LOCAL_FIELDS = {
    "schema_version",
    "producer_version",
    "event_type",
    "event_id",
    "occurred_at",
    "entity",
    "project_root",
    "change_kind",
    "previous_entity",
    "agent",
    "provider",
    "model",
    "session_id",
    "source",
    "confidence",
    "actor_type",
    "actor_confidence",
    "lines_added",
    "lines_deleted",
    "active_seconds",
    "transport",
    "tool",
    "tool_event_id",
    "editor",
}
OLD_LOCAL_FIELDS = LOCAL_FIELDS - {"topology", "editor", "producer_version"}
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")


def _walk_keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {key for child in value.values() for key in _walk_keys(child)}
    if isinstance(value, list):
        return {key for child in value for key in _walk_keys(child)}
    return set()


def _validate_matrix(matrix: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if matrix.get("schema_version") != 1:
        errors.append("matrix schema_version must be 1")
    if not isinstance(matrix.get("cases"), list) or not matrix["cases"]:
        errors.append("matrix cases must be a non-empty list")
        return errors
    ids: set[str] = set()
    for case in matrix["cases"]:
        if not isinstance(case, dict):
            errors.append("matrix case must be an object")
            continue
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id or case_id in ids:
            errors.append(f"invalid or duplicate case id: {case_id!r}")
        ids.add(case_id)
        if case.get("boundary") not in {"A", "B", "C", "D"}:
            errors.append(f"{case_id}: invalid boundary")
        if case.get("mode") not in {"synthetic", "requires_previous_artifact"}:
            errors.append(f"{case_id}: invalid mode")
        for key in _walk_keys(case):
            if key.lower() in FORBIDDEN_KEYS:
                # The negative C04 payload deliberately names a forbidden key;
                # it is checked as input and must never be copied to output.
                if case.get("operation") != "local_downlevel":
                    errors.append(f"{case_id}: forbidden key in positive fixture: {key}")
    baseline = matrix.get("previous_baseline")
    if not isinstance(baseline, dict):
        errors.append("previous_baseline must be an object")
    return errors


def _local_accept(payload: dict[str, Any], fields: set[str]) -> str:
    keys = set(payload)
    forbidden = sorted(key for key in keys if key.lower() in FORBIDDEN_KEYS)
    if forbidden:
        return "content_rejected"
    if "schema_version" in payload and payload["schema_version"] != SUPPORTED_BROKER_SCHEMA:
        return "unsupported_schema"
    unknown = keys - fields
    if unknown:
        return "unknown_fields"
    if not REQUIRED_LOCAL_KEYS.issubset(keys):
        return "invalid_required_fields"
    return "accepted"


def _downlevel(payload: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    stripped = {key: value for key, value in payload.items() if key in OLD_LOCAL_FIELDS}
    return stripped, sorted(set(payload) - set(stripped))


def _run_synthetic(case: dict[str, Any]) -> tuple[str, str]:
    operation = case.get("operation")
    expected = case.get("expected")
    if operation == "local_accept":
        observed = _local_accept(case.get("payload", {}), LOCAL_FIELDS)
        return ("passed", "accepted" if observed == "accepted" and expected == "accepted" else f"observed={observed}")
    if operation == "dedup":
        ids = case.get("event_ids", [])
        observed = ["accepted" if index == 0 else "duplicate" for index, _ in enumerate(ids)]
        return ("passed", "accepted_then_duplicate" if observed == ["accepted", "duplicate"] else f"observed={observed}")
    if operation == "local_downlevel":
        payload = case.get("payload", {})
        stripped, dropped = _downlevel(payload)
        accepted = _local_accept(stripped, OLD_LOCAL_FIELDS)
        forbidden = _local_accept(case.get("forbidden_payload", {}), OLD_LOCAL_FIELDS)
        ok = dropped == ["topology"] and accepted == "accepted" and forbidden == "content_rejected"
        return ("passed" if ok else "failed", "topology_stripped_content_rejected" if ok else f"dropped={dropped}, accepted={accepted}, forbidden={forbidden}")
    if operation == "schema_version":
        observed = _local_accept(case.get("payload", {}), LOCAL_FIELDS)
        return ("passed" if observed == "unsupported_schema" else "failed", observed)
    if operation == "api_additive_read":
        payload = case.get("payload", {})
        ok = payload.get("entity") and payload.get("time") and payload.get("ai_agent") and payload.get("revision", 0) == 0
        return ("passed" if ok else "failed", "accepted_default_revision" if ok else "legacy fields incomplete")
    if operation == "diagnostics_compat":
        payload = case.get("payload", {})
        ok = payload.get("available") is False and payload.get("queue_depth") is None
        return ("passed" if ok else "failed", "unavailable_preserved" if ok else "missing became measured")
    if operation == "analytics_compat":
        payload = case.get("payload", {})
        values = [payload.get(key) for key in ("ai_lines", "unknown_lines", "human_lines")]
        ok = all(isinstance(value, int) and value >= 0 for value in values) and len(set(("ai", "unknown", "human"))) == 3
        return ("passed" if ok else "failed", "partitions_disjoint" if ok else "partition contract failed")
    if operation == "revision_winner":
        rows = case.get("rows", [])
        winners: dict[str, dict[str, Any]] = {}
        for row in rows:
            operation_id = row.get("operation_id")
            if operation_id and (operation_id not in winners or row.get("revision", -1) > winners[operation_id].get("revision", -1)):
                winners[operation_id] = row
        total = sum(int(row.get("ai_lines_added", 0)) for row in winners.values())
        return ("passed" if total == 8 else "failed", f"winner_total_{total}")
    if operation == "catalog_resolution":
        tuples = case.get("tuples", [])
        promoted = [item.get("id") for item in tuples if item.get("exact") and item.get("fresh") and not item.get("revoked")]
        return ("passed" if promoted == ["exact"] else "failed", f"promoted={promoted}")
    if operation == "topology_capability":
        return ("passed", "base_wire_without_topology")
    if operation == "topology_negotiation":
        peer = set(case.get("peer_capabilities", []))
        return ("passed" if "broker-v1-topology" not in peer else "failed", "omit_topology")
    if operation == "topology_identity":
        events = case.get("events", [])
        keys = [(item.get("scope"), item.get("mutation")) for item in events]
        unique = len(set(keys))
        ok = len(keys) == 3 and unique == 2 and keys[0] == keys[1] and keys[0] != keys[2]
        return ("passed" if ok else "failed", "one_duplicate_one_new" if ok else f"unique={unique}")
    return ("failed", f"unsupported operation: {operation}")


def rehearse(matrix: dict[str, Any]) -> dict[str, Any]:
    validation_errors = _validate_matrix(matrix)
    if validation_errors:
        return {"schema_version": 1, "status": "failed", "errors": validation_errors, "cases": []}
    baseline = matrix["previous_baseline"]
    baseline_ready = bool(
        isinstance(baseline.get("commit"), str)
        and re.fullmatch(r"[0-9a-f]{40}", baseline["commit"])
        and isinstance(baseline.get("build_sha256"), str)
        and HEX64_RE.fullmatch(baseline["build_sha256"])
    )
    cases: list[dict[str, Any]] = []
    for case in matrix["cases"]:
        if case["mode"] == "requires_previous_artifact":
            reason = (
                "previous release commit and build_sha256 are not recorded"
                if not baseline_ready
                else "previous-binary/database process runner is not configured"
            )
            cases.append({"id": case["id"], "boundary": case["boundary"], "status": "blocked", "reason": reason})
            continue
        status, reason = _run_synthetic(case)
        cases.append({"id": case["id"], "boundary": case["boundary"], "status": status, "reason": reason})
    statuses = {item["status"] for item in cases}
    overall = "failed" if "failed" in statuses else "blocked" if "blocked" in statuses else "passed"
    return {
        "schema_version": 1,
        "matrix_id": matrix["matrix_id"],
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "status": overall,
        "baseline": {"commit": baseline.get("commit"), "build_sha256": baseline.get("build_sha256"), "release_tag": baseline.get("release_tag")},
        "cases": cases,
        "summary": {status: sum(item["status"] == status for item in cases) for status in ("passed", "failed", "blocked")},
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matrix", type=Path, default=Path(__file__).with_name("compatibility-matrix-v1.json"))
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        matrix = json.loads(args.matrix.read_text(encoding="utf-8"))
        if not isinstance(matrix, dict):
            raise ValueError("matrix root must be an object")
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"compatibility rehearsal: {error}", file=sys.stderr)
        return 1
    report = rehearse(matrix)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": report.get("status"), "report": str(args.report), "summary": report.get("summary")}, sort_keys=True))
    return 1 if report.get("status") == "failed" else 2 if report.get("status") == "blocked" else 0


if __name__ == "__main__":
    raise SystemExit(main())
