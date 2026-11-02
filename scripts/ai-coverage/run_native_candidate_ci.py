#!/usr/bin/env python3
"""Explicit workflow adapter: download a pinned baseline, or retain pending gates."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from pathlib import Path

from native_candidate_smoke import run_smoke
from native_smoke_common import SmokeError
from package_internal_candidate import inspect_members


def invoke(vsix: Path, commit: str, output: Path, target: str) -> dict:
    enabled = os.environ.get("NATIVE_SMOKE_ENABLED", "false")
    if enabled == "false":
        report = {"schema_version":1, "source_commit":commit, "target":target,
                  "status":"pending", "reason":"native_smoke_not_requested",
                  "native_certification":"pending", "production_ready":False}
        output.write_text(json.dumps(report, indent=2) + "\n")
        return report
    if enabled != "true":
        raise SmokeError("native_smoke_enable_value_invalid")
    verified, _members = inspect_members(vsix, commit)
    if verified["manifest"]["target"] != target:
        raise SmokeError("native_smoke_workflow_target_mismatch")
    baseline_run = os.environ.get("NATIVE_SMOKE_BASELINE_RUN", "")
    baseline_commit = os.environ.get("NATIVE_SMOKE_BASELINE_COMMIT", "")
    if bool(baseline_run) != bool(baseline_commit):
        raise SmokeError("native_smoke_baseline_pair_required")
    previous = None
    if baseline_run:
        repo = os.environ.get("GITHUB_REPOSITORY", "")
        if not re.fullmatch(r"[1-9][0-9]*", baseline_run) or not re.fullmatch(r"[a-f0-9]{40}", baseline_commit):
            raise SmokeError("native_smoke_baseline_identity_invalid")
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
            raise SmokeError("native_smoke_repository_unconfirmed")
        destination = Path(os.environ["RUNNER_TEMP"]) / ("native-smoke-baseline-" + target)
        destination.mkdir(exist_ok=False)
        result = subprocess.run(["gh", "run", "download", baseline_run, "--repo", repo, "--name",
            f"internal-client-{target}-{baseline_commit}", "--dir", str(destination)],
            capture_output=True, timeout=120, check=False)
        if result.returncode:
            raise SmokeError("native_smoke_baseline_download_failed")
        candidates = list(destination.glob("*.vsix"))
        if len(candidates) != 1:
            raise SmokeError("native_smoke_baseline_artifact_ambiguous")
        previous = candidates[0]
    commands = json.loads(os.environ.get("NATIVE_SMOKE_VSCODE_MAP", "{}") or "{}")
    if not isinstance(commands, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in commands.items()):
        raise SmokeError("native_smoke_vscode_configuration_invalid")
    command = commands.get(target, "")
    return run_smoke(vsix, commit, output, previous_vsix=previous,
                     previous_commit=baseline_commit or None, vscode=Path(command) if command else None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vsix", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    try:
        report = invoke(args.vsix, args.commit, args.output, args.target)
    except Exception:
        report = {"schema_version":1,"source_commit":args.commit,"target":args.target,
                  "status":"failed","failure":"native_smoke_workflow_preflight_failed","production_ready":False}
        args.output.write_text(json.dumps(report) + "\n")
    print(json.dumps({"status":report["status"],"target":args.target}))
    raise SystemExit(1 if report["status"] == "failed" else 0)


if __name__ == "__main__":
    main()
