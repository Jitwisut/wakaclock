#!/usr/bin/env python3
"""Run a metadata-only adapter certification harness in an isolated sandbox.

The driver receives a temporary HOME and workspace.  Only a bounded summary of
its JSON stdout is retained; raw stdout/stderr, prompts, patches, paths and
tool payloads are never written to the certification artifact.  The output is
always ``review_status=pending`` and ``promotable=false``.  A reviewer must
validate the artifact and publish it in the catalog before the API can return
Verified.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from validate_certification import MANDATORY_STAGES, ROW_STATUSES, validate_artifact

ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
SHA1_RE = re.compile(r"^[0-9a-f]{40}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
MAX_COUNT = 10_000_000
MAX_DRIVER_OUTPUT = 64 * 1024
DEFAULT_SCENARIO_IDS = (
    "single-file",
    "multi-file",
    "create-delete-rename",
    "failure-no-op",
    "retry-dedup",
    "nested-execution",
)
DRIVER_ALLOWED_KEYS = {"stages", "scenarios", "metrics", "blockers"}


def bounded_id(value: str, field: str) -> str:
    value = value.strip().lower()
    if not ID_RE.fullmatch(value):
        raise ValueError(f"{field} must be a bounded lowercase identifier")
    return value


def bounded_count(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > MAX_COUNT:
        raise ValueError(f"driver {field} must be a bounded non-negative integer")
    return value


def row_map(value: Any, field: str, allowed: set[str]) -> dict[str, str]:
    if value is None:
        return {}
    if not isinstance(value, dict) or len(value) > len(allowed):
        raise ValueError(f"driver {field} must be a bounded object")
    result: dict[str, str] = {}
    for key, status in value.items():
        if key not in allowed or status not in ROW_STATUSES:
            raise ValueError(f"driver {field} contains an unknown id or status")
        result[key] = status
    return result


def bounded_blockers(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > len(DEFAULT_SCENARIO_IDS) * 2:
        raise ValueError("driver blockers must be a bounded list")
    blockers = []
    for item in value:
        if not isinstance(item, str) or not ID_RE.fullmatch(item):
            raise ValueError("driver blockers must be lowercase identifiers")
        blockers.append(item)
    return blockers


def digest_summary(value: dict[str, Any]) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def git_commit(repo: Path) -> str:
    value = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True, timeout=10).strip()
    if not SHA1_RE.fullmatch(value):
        raise ValueError("git HEAD is not a full lowercase SHA")
    return value


def run_driver(
    command: str,
    sandbox: Path,
    scenario_ids: list[str],
) -> tuple[dict[str, Any], str | None]:
    if not command:
        return {}, "driver_not_run"
    try:
        completed = subprocess.run(
            shlex.split(command),
            cwd=sandbox,
            env={
                **os.environ,
                "HOME": str(sandbox / "home"),
                "WAKACLOCK_CERTIFICATION_SANDBOX": str(sandbox),
                "WAKACLOCK_CERTIFICATION_METADATA_ONLY": "1",
                "WAKACLOCK_CERTIFICATION_SCENARIOS": ",".join(sorted(scenario_ids)),
            },
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as error:
        return {}, f"driver_failed_{type(error).__name__.lower()}"
    if completed.returncode != 0:
        return {}, "driver_failed"
    # Do not retain raw output.  Bound and parse it in memory, then select only
    # the allowlisted metadata below.
    if len(completed.stdout.encode("utf-8")) > MAX_DRIVER_OUTPUT:
        return {}, "driver_output_too_large"
    try:
        value = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return {}, "driver_output_invalid"
    if not isinstance(value, dict):
        return {}, "driver_output_invalid"
    if not value:
        return {}, "driver_empty"
    unknown = set(value) - DRIVER_ALLOWED_KEYS
    if unknown:
        return {}, "driver_output_unknown_fields"
    return value, None


def build_artifact(
    args: argparse.Namespace,
    repo: Path,
    driver: dict[str, Any],
    driver_error: str | None,
) -> dict[str, Any]:
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    completed = now
    stages = row_map(driver.get("stages"), "stages", set(MANDATORY_STAGES))
    scenarios_raw = driver.get("scenarios", {})
    allowed_scenarios = set(args.scenario_ids or DEFAULT_SCENARIO_IDS)
    scenarios = row_map(scenarios_raw, "scenarios", allowed_scenarios)
    scenarios = {scenario: scenarios.get(scenario, "not_run") for scenario in sorted(allowed_scenarios)}
    stages = {stage: stages.get(stage, "not_run") for stage in MANDATORY_STAGES}
    if driver_error:
        stages["source_capture"] = "failed"
    metrics_input = driver.get("metrics", {})
    if not isinstance(metrics_input, dict):
        metrics_input = {}
    metrics = {
        "captured": bounded_count(metrics_input.get("captured", 0), "metrics.captured"),
        "producer_events": bounded_count(metrics_input.get("producer_events", 0), "metrics.producer_events"),
        "broker_accepted": bounded_count(metrics_input.get("broker_accepted", 0), "metrics.broker_accepted"),
        "canonical": bounded_count(metrics_input.get("canonical", 0), "metrics.canonical"),
        "delivered": bounded_count(metrics_input.get("delivered", 0), "metrics.delivered"),
        "duplicates": bounded_count(metrics_input.get("duplicates", 0), "metrics.duplicates"),
        "replayed": bounded_count(metrics_input.get("replayed", 0), "metrics.replayed"),
    }
    blockers = bounded_blockers(driver.get("blockers"))
    if driver_error:
        blockers.insert(0, driver_error)
    summary = {
        "adapter_id": args.adapter_id,
        "client_id": args.client_id,
        "provider_id": args.provider_id,
        "stages": stages,
        "scenarios": scenarios,
        "metrics": metrics,
        "blockers": blockers,
    }
    artifact = {
        "artifact_kind": "adapter_certification",
        "schema_version": 2,
        "certificate_id": f"{args.client_id}-pending-{now.strftime('%Y%m%d%H%M%S')}",
        "status": "scaffold",
        "review_status": "pending",
        "promotable": False,
        "adapter_id": args.adapter_id,
        "client_id": args.client_id,
        "provider_id": args.provider_id,
        "model_id": args.model_id,
        "tool_version": args.tool_version,
        "producer_version": args.producer_version,
        "runtime": args.runtime,
        "os": args.os,
        "arch": args.arch,
        "edit_modes": args.edit_modes,
        "payload_schema_versions": args.payload_schema_versions,
        "contract_version": args.contract_version,
        "fingerprint_version": args.fingerprint_version,
        "corpus_version": args.corpus_version,
        "tested_commit_sha": args.tested_commit_sha or git_commit(repo),
        "build_sha256": args.build_sha256,
        "started_at_utc": now.isoformat().replace("+00:00", "Z"),
        "completed_at_utc": completed.isoformat().replace("+00:00", "Z"),
        "expires_at_utc": (completed + dt.timedelta(days=30)).isoformat().replace("+00:00", "Z"),
        "evidence_kind": "live",
        "evidence_digest": digest_summary(summary),
        "stages": [{"id": key, "status": stages[key]} for key in MANDATORY_STAGES],
        "scenarios": [{"id": key, "status": status} for key, status in sorted(scenarios.items())],
        "metrics": metrics,
        "blockers": blockers,
        "limitations": ["pending human review; this artifact is never a catalog promotion by itself"],
    }
    errors = validate_artifact(artifact, now=completed)
    if errors:
        raise ValueError("generated artifact failed validation: " + "; ".join(errors))
    return artifact


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--adapter-id", required=True)
    parser.add_argument("--client-id", required=True)
    parser.add_argument("--provider-id", required=True)
    parser.add_argument("--driver", help="metadata-only driver command; JSON stdout is parsed in memory")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model-id")
    parser.add_argument("--tool-version")
    parser.add_argument("--producer-version")
    parser.add_argument("--runtime", default="cli")
    parser.add_argument("--os")
    parser.add_argument("--arch")
    parser.add_argument("--edit-mode", action="append", dest="edit_modes", default=[])
    parser.add_argument("--payload-schema", action="append", dest="payload_schema_versions", default=[])
    parser.add_argument("--contract-version", default="producer-v1")
    parser.add_argument("--fingerprint-version", default="caf1")
    parser.add_argument("--corpus-version")
    parser.add_argument("--tested-commit-sha")
    parser.add_argument("--build-sha256")
    parser.add_argument(
        "--scenario-id",
        action="append",
        dest="scenario_ids",
        help="Expected scenario id; repeat to replace the default Codex campaign set",
    )
    args = parser.parse_args()
    try:
        args.adapter_id = bounded_id(args.adapter_id, "adapter-id")
        args.client_id = bounded_id(args.client_id, "client-id")
        args.provider_id = bounded_id(args.provider_id, "provider-id")
        args.contract_version = bounded_id(args.contract_version, "contract-version")
        args.fingerprint_version = bounded_id(args.fingerprint_version, "fingerprint-version")
        args.scenario_ids = [bounded_id(value, "scenario-id") for value in (args.scenario_ids or [])]
        if args.tested_commit_sha and not SHA1_RE.fullmatch(args.tested_commit_sha):
            raise ValueError("tested-commit-sha must be a full lowercase SHA")
        if args.build_sha256 and not SHA256_RE.fullmatch(args.build_sha256):
            raise ValueError("build-sha256 must be a lowercase SHA-256 digest")
        with tempfile.TemporaryDirectory(prefix="wakaclock-cert-") as temporary:
            sandbox = Path(temporary)
            (sandbox / "home").mkdir()
            driver, driver_error = run_driver(
                args.driver or "",
                sandbox,
                args.scenario_ids or list(DEFAULT_SCENARIO_IDS),
            )
            artifact = build_artifact(args, args.repo, driver, driver_error)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(artifact, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(args.output)
        return 0
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"live certification failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
