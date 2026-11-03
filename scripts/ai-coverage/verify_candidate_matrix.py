#!/usr/bin/env python3
"""Read-only artifact/evidence aggregation. Never execute a packaged binary."""
from __future__ import annotations

import argparse
import json
import re
import os
from pathlib import Path

from package_internal_candidate import TARGETS, digest, inspect_members, verify_standalone
from internal_candidate_preflight import validate

REQUIRED_SMOKE = {"install_idempotent", "upgrade_rollback", "status_persistent_pause_resume",
                  "vsix_install_activation", "queue_receipts_preserved", "uninstall_preserves_queue"}


def verify_target(directory: Path, target: str, commit: str) -> dict:
    path = directory / f"candidate-{target}.json"
    report = json.loads(path.read_text())
    if report.get("source_commit") != commit or report.get("target") != target:
        raise ValueError("candidate_matrix_source_mismatch")
    artifacts = report.get("artifacts")
    if not isinstance(artifacts, dict) or len(artifacts) != 2:
        raise ValueError("candidate_matrix_artifacts_missing")
    files = []
    for name, expected in artifacts.items():
        if not isinstance(name, str) or Path(name).name != name or name in {".", ".."}:
            raise ValueError("candidate_matrix_artifact_path_invalid")
        artifact = directory / name
        if artifact.is_symlink() or digest(artifact.read_bytes()) != expected:
            raise ValueError("candidate_matrix_artifact_hash_mismatch")
        files.append(artifact)
    vsix = [file for file in files if file.suffix == ".vsix"]
    standalone = [file for file in files if file.suffix in {".zip", ".gz"}]
    if len(vsix) != 1 or len(standalone) != 1:
        raise ValueError("candidate_matrix_artifact_pair_invalid")
    if not standalone[0].name.endswith(".zip" if target.startswith("win32") else ".tar.gz"):
        raise ValueError("candidate_matrix_standalone_format_invalid")
    verified, members = inspect_members(vsix[0], commit)
    manifest = verified["manifest"]
    if manifest["target"] != target or report.get("binary_sha256") != manifest["sha256"]:
        raise ValueError("candidate_matrix_binary_mismatch")
    expected_files = {manifest["binary"]:members[f"extension/resources/bin/{manifest['binary']}"]}
    expected_files.update({name.removeprefix("extension/"):value for name, value in members.items()
                           if name.startswith("extension/resources/ai-agents/")})
    expected_files["runtime-manifest.json"] = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
    verify_standalone(standalone[0], expected_files)
    runner = json.loads((directory / f"native-runner-{target}.json").read_text())
    if (runner.get("source_commit") != commit or runner.get("target") != target
            or runner.get("native_runner_preflight") != "passed"):
        raise ValueError("candidate_matrix_native_runner_unconfirmed")
    validate(target, runner.get("system"), runner.get("machine", ""), runner.get("node_arch"), runner.get("rust_host"))
    smoke = json.loads((directory / f"native-smoke-{target}.json").read_text())
    if smoke.get("source_commit") != commit or smoke.get("target") != target:
        raise ValueError("candidate_matrix_smoke_scope_mismatch")
    if smoke.get("status") not in {"pending", "passed", "failed"}:
        raise ValueError("candidate_matrix_smoke_status_invalid")
    native = smoke["status"]
    if native == "passed":
        checks = smoke.get("checks", {})
        host = checks.get("vsix_install_activation", {})
        upgrade = checks.get("upgrade_rollback", {})
        queue = checks.get("queue_receipts_preserved", {})
        if (smoke.get("binary_sha256") != manifest["sha256"]
                or smoke.get("vsix_sha256") != digest(vsix[0].read_bytes())
                or not REQUIRED_SMOKE.issubset(checks)
                or any(checks[key].get("status") != "passed" for key in REQUIRED_SMOKE)
                or host.get("source_commit") != commit or host.get("target") != target
                or host.get("binary_sha256") != manifest["sha256"]
                or not re.fullmatch(r"[a-f0-9]{40}", upgrade.get("previous_commit", ""))
                or upgrade.get("previous_commit") == commit
                or not re.fullmatch(r"[a-f0-9]{64}", upgrade.get("previous_binary_sha256", ""))
                or upgrade.get("previous_binary_sha256") == manifest["sha256"]
                or upgrade.get("installed_binary_sha256") != manifest["sha256"]
                or queue.get("fixture_records") != 1
                or queue.get("server_acceptance") != "not_tested_503_fixture"
                or any(not re.fullmatch(r"[a-f0-9]{64}", queue.get(key, "")) for key in ("payload_sha256", "input_sha256"))
                or not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+[A-Za-z0-9.+-]*", host.get("vscode_version", ""))
                or any(host.get(key) is not True for key in ("installed", "activated", "commands_registered", "bundled_cli_executed", "custom_override_preserved"))):
            raise ValueError("candidate_matrix_native_pass_not_proven")
    return {"target":target, "artifact_hashes_verified":True, "artifact_count":2,
            "binary_sha256":manifest["sha256"], "native_smoke":native,
            "native_certification":"pending", "live_adapter_certification":"pending"}


def verify_matrix(directory: Path, commit: str) -> dict:
    targets = []
    for target in sorted(TARGETS):
        try:
            targets.append(verify_target(directory, target, commit))
        except Exception:
            targets.append({"target":target, "artifact_hashes_verified":False,
                            "native_smoke":"unconfirmed", "failure":"candidate_matrix_target_evidence_invalid"})
    artifacts = all(t["artifact_hashes_verified"] for t in targets)
    native = artifacts and all(t["native_smoke"] == "passed" for t in targets)
    failed = not artifacts or any(t["native_smoke"] == "failed" for t in targets)
    return {"schema_version":1, "source_commit":commit, "targets":targets,
            "expected_artifact_count":8, "all_artifacts_verified":artifacts,
            "native_smoke_complete":native, "internal_test_ready":bool(native and not failed),
            "status":"failed" if failed else "passed" if native else "pending",
            "native_certification":"pending", "provider_certification":"pending",
            "signing":"unsigned", "release_channel":"internal", "production_ready":False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = verify_matrix(args.directory, args.commit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n")
    if os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as summary:
            summary.write("## Internal candidate evidence\n\n"
                          f"- All eight artifacts verified: {result['all_artifacts_verified']}\n"
                          f"- Native smoke complete: {result['native_smoke_complete']}\n"
                          f"- Ready for internal testing: {result['internal_test_ready']}\n"
                          "- Signing, provider certification and production readiness: pending\n")
    print(json.dumps({"status":result["status"], "artifacts_verified":result["all_artifacts_verified"],
                      "native_smoke_complete":result["native_smoke_complete"]}))
    raise SystemExit(1 if result["status"] == "failed" else 0)


if __name__ == "__main__":
    main()
