#!/usr/bin/env python3
"""Run a bounded Codex CLI campaign and emit only certification metadata.

This is the F5-02 driver for ``run_live_certification.py``.  It deliberately
does not copy credentials, retain Codex stdout, or write prompts, patches,
paths, account identifiers, or source content to the artifact.  A campaign is
opt-in with ``--execute`` because it invokes an authenticated AI client and may
consume a paid account.  The driver can prove transcript capture and parser
events locally; broker/API/dashboard stages remain ``not_run`` until their
explicit delivery/readback configuration is supplied.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

MANDATORY_STAGES = (
    "source_capture",
    "producer_event",
    "broker_accept",
    "canonical_reconcile",
    "api_delivery",
    "dashboard_readback",
)
SCENARIO_IDS = (
    "single-file",
    "multi-file",
    "create-delete-rename",
    "failure-no-op",
    "retry-dedup",
    "nested-execution",
)
SCENARIO_PROMPTS = {
    "single-file": (
        "In this disposable workspace, create or modify single.txt with a short marker. "
        "Do not touch any other file."
    ),
    "multi-file": (
        "In this disposable workspace, create or modify multi-a.txt and multi-b.txt with "
        "short markers. Do not touch any other file."
    ),
    "create-delete-rename": (
        "In this disposable workspace, create created.txt, rename rename-source.txt to "
        "rename-target.txt, and delete delete-me.txt if it exists. Do not touch any other file."
    ),
    "failure-no-op": (
        "In this disposable workspace, do not change any files. Explain what you would do "
        "without invoking a file mutation tool."
    ),
    "retry-dedup": (
        "In this disposable workspace, make one small change to retry.txt and then stop. "
        "Do not change any other file."
    ),
    "nested-execution": (
        "In this disposable workspace, make one small change to nested.txt through the normal "
        "file-edit path and stop. Do not change any other file."
    ),
}
VERSION_RE = re.compile(r"\bcodex-cli\s+([0-9A-Za-z._-]+)\b")
PARSED_RE = re.compile(r"\b(\d+) event\(s\) parsed since last scan\b")
BROKER_RE = re.compile(r"\bbroker accepted (\d+) \(duplicates (\d+)\)\b")
MAX_PROCESS_OUTPUT = 2 * 1024 * 1024


def bounded_id(value: str) -> str:
    value = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,63}", value):
        raise ValueError("identifier is outside the bounded format")
    return value


def executable(value: str) -> str | None:
    resolved = shutil.which(value)
    if resolved:
        return resolved
    candidate = Path(value).expanduser()
    return str(candidate) if candidate.is_file() else None


def run_process(command: list[str], *, cwd: Path, env: dict[str, str], timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def snapshot_sessions(codex_home: Path) -> dict[Path, tuple[int, int]]:
    root = codex_home / "sessions"
    if not root.is_dir():
        return {}
    result: dict[Path, tuple[int, int]] = {}
    for path in root.rglob("*.jsonl"):
        try:
            stat = path.stat()
        except OSError:
            continue
        result[path] = (stat.st_mtime_ns, stat.st_size)
    return result


def newest_changed_session(
    codex_home: Path,
    before: dict[Path, tuple[int, int]],
    started_ns: int,
) -> Path | None:
    after = snapshot_sessions(codex_home)
    candidates = [
        path
        for path, metadata in after.items()
        if metadata[0] >= started_ns and (path not in before or before[path] != metadata)
    ]
    return max(candidates, key=lambda path: after[path][0], default=None)


def parse_parser_output(output: str) -> tuple[int, int, int]:
    parsed = sum(int(match.group(1)) for match in PARSED_RE.finditer(output))
    accepted = 0
    duplicates = 0
    for match in BROKER_RE.finditer(output):
        accepted += int(match.group(1))
        duplicates += int(match.group(2))
    return parsed, accepted, duplicates


def empty_summary() -> dict[str, Any]:
    return {
        "stages": {stage: "not_run" for stage in MANDATORY_STAGES},
        "scenarios": {scenario: "not_run" for scenario in SCENARIO_IDS},
        "metrics": {
            "captured": 0,
            "producer_events": 0,
            "broker_accepted": 0,
            "canonical": 0,
            "delivered": 0,
            "duplicates": 0,
            "replayed": 0,
        },
        "blockers": [],
    }


def add_blocker(summary: dict[str, Any], blocker: str) -> None:
    if blocker not in summary["blockers"]:
        summary["blockers"].append(blocker)


def scenario_status(scenario: str, command_ok: bool, parsed: int, session_found: bool) -> str:
    if not command_ok or not session_found:
        return "failed"
    if scenario == "failure-no-op":
        return "passed" if parsed == 0 else "failed"
    if scenario in {"retry-dedup", "nested-execution"}:
        # A single parser pass cannot prove retry identity or nested execution
        # lineage. Keep these rows honest until the delivery/readback probes run.
        return "not_run"
    return "passed" if parsed > 0 else "failed"


def run_campaign(args: argparse.Namespace, sandbox: Path) -> dict[str, Any]:
    summary = empty_summary()
    (sandbox / "home").mkdir(parents=True, exist_ok=True)
    configured_scenarios = [
        bounded_id(value)
        for value in os.environ.get("WAKACLOCK_CERTIFICATION_SCENARIOS", "").split(",")
        if value.strip()
    ]
    selected = args.scenario_ids or configured_scenarios or list(SCENARIO_IDS)
    summary["scenarios"] = {scenario: "not_run" for scenario in selected}

    if not args.execute:
        add_blocker(summary, "campaign_not_enabled")
        return summary

    codex = executable(args.codex)
    if codex is None:
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "codex_executable_unavailable")
        return summary

    codex_home_value = args.codex_home or os.environ.get("CODEX_HOME")
    if not codex_home_value:
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "codex_auth_home_not_configured")
        return summary
    codex_home = Path(codex_home_value).expanduser()
    if not codex_home.is_dir():
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "codex_auth_home_unavailable")
        return summary

    process_env = {**os.environ, "HOME": str(sandbox / "home"), "CODEX_HOME": str(codex_home)}
    version_result = run_process([codex, "--version"], cwd=sandbox, env=process_env, timeout=args.timeout)
    version_text = f"{version_result.stdout}\n{version_result.stderr}"
    version_match = VERSION_RE.search(version_text)
    if version_result.returncode != 0 or version_match is None:
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "codex_version_unavailable")
        return summary
    if args.expected_version and version_match.group(1) != args.expected_version:
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "codex_version_mismatch")
        return summary

    login = run_process([codex, "login", "status"], cwd=sandbox, env=process_env, timeout=args.timeout)
    if login.returncode != 0:
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "codex_auth_unavailable")
        return summary

    wakaclock = executable(args.wakaclock)
    if wakaclock is None:
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "wakaclock_cli_unavailable")
        return summary

    workspace = sandbox / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    captured_dir = sandbox / "captured"
    captured_dir.mkdir()

    for scenario in selected:
        scenario_root = workspace / f"scenario-{scenario.replace('-', '_')}"
        scenario_root.mkdir(parents=True, exist_ok=True)
        if scenario == "create-delete-rename":
            # Seed the files inside the same disposable root passed to Codex.
            # Seeding the parent workspace would make the rename/delete prompt
            # silently operate on paths Codex cannot see.
            (scenario_root / "rename-source.txt").write_text("seed\n", encoding="utf-8")
            (scenario_root / "delete-me.txt").write_text("seed\n", encoding="utf-8")
        before = snapshot_sessions(codex_home)
        started_ns = time.time_ns()
        command = [
            codex,
            "exec",
            "--json",
            "--cd",
            str(scenario_root),
            "--sandbox",
            "workspace-write",
            "--approve-for-me",
            SCENARIO_PROMPTS[scenario],
        ]
        try:
            completed = run_process(command, cwd=scenario_root, env=process_env, timeout=args.timeout)
        except (OSError, subprocess.SubprocessError):
            summary["scenarios"][scenario] = "failed"
            add_blocker(summary, "codex_exec_failed")
            continue
        if len(completed.stdout.encode("utf-8")) > MAX_PROCESS_OUTPUT:
            summary["scenarios"][scenario] = "failed"
            add_blocker(summary, "codex_output_too_large")
            continue

        session = newest_changed_session(codex_home, before, started_ns)
        if session is None:
            summary["scenarios"][scenario] = "failed"
            add_blocker(summary, "codex_transcript_not_captured")
            continue
        captured = captured_dir / f"{scenario.replace('-', '_')}.jsonl"
        try:
            shutil.copyfile(session, captured)
        except OSError:
            summary["scenarios"][scenario] = "failed"
            add_blocker(summary, "codex_transcript_copy_failed")
            continue

        sync_command = [
            wakaclock,
            "ai",
            "sync",
            "--agent",
            "codex",
            "--from-start",
            "--transcript",
            str(captured),
        ]
        if not args.deliver:
            sync_command.insert(3, "--dry-run")
        try:
            parsed_result = run_process(sync_command, cwd=sandbox, env=process_env, timeout=args.timeout)
        except (OSError, subprocess.SubprocessError):
            summary["scenarios"][scenario] = "failed"
            add_blocker(summary, "parser_probe_failed")
            continue
        parser_output = f"{parsed_result.stdout}\n{parsed_result.stderr}"
        parsed, accepted, duplicates = parse_parser_output(parser_output)
        summary["metrics"]["captured"] += parsed
        summary["metrics"]["producer_events"] += parsed
        summary["metrics"]["broker_accepted"] += accepted
        summary["metrics"]["duplicates"] += duplicates
        summary["stages"]["source_capture"] = "passed"
        if parsed > 0 or scenario == "failure-no-op":
            summary["stages"]["producer_event"] = "passed"
        summary["scenarios"][scenario] = scenario_status(
            scenario,
            parsed_result.returncode == 0,
            parsed,
            session is not None,
        )
        if parsed_result.returncode != 0:
            add_blocker(summary, "parser_probe_failed")

    if args.deliver:
        if not os.environ.get("WAKACLOCK_SERVER_URL"):
            add_blocker(summary, "api_url_not_configured")
        if not os.environ.get("WAKACLOCK_API_KEY"):
            add_blocker(summary, "api_key_not_configured")
        if summary["metrics"]["broker_accepted"] > 0:
            summary["stages"]["broker_accept"] = "passed"
            summary["stages"]["api_delivery"] = "passed"
        else:
            summary["stages"]["broker_accept"] = "not_run"
            summary["stages"]["api_delivery"] = "not_run"
    else:
        add_blocker(summary, "delivery_not_requested")

    # These two stages require an explicit, privacy-safe readback probe. Never
    # infer them from a successful local parser or an HTTP 2xx alone.
    add_blocker(summary, "canonical_readback_not_configured")
    add_blocker(summary, "dashboard_readback_not_configured")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Run authenticated Codex scenarios")
    parser.add_argument("--codex", default=os.environ.get("CODEX_BIN", "codex"))
    parser.add_argument("--codex-home")
    parser.add_argument("--wakaclock", default=os.environ.get("WAKACLOCK_CLI_PATH", "wakaclock"))
    parser.add_argument("--expected-version", default="0.153.4")
    parser.add_argument("--deliver", action="store_true", help="Send parsed events to the configured API")
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--scenario-id", action="append", dest="scenario_ids")
    args = parser.parse_args()
    try:
        args.timeout = max(1, min(args.timeout, 900))
        args.scenario_ids = [bounded_id(value) for value in (args.scenario_ids or [])]
        unknown = sorted(set(args.scenario_ids) - set(SCENARIO_IDS))
        if unknown:
            raise ValueError("unsupported scenario id")
        sandbox_value = os.environ.get("WAKACLOCK_CERTIFICATION_SANDBOX")
        if not sandbox_value:
            raise ValueError("WAKACLOCK_CERTIFICATION_SANDBOX is required")
        sandbox = Path(sandbox_value)
        summary = run_campaign(args, sandbox)
        print(json.dumps(summary, sort_keys=True))
        return 0
    except (OSError, ValueError, subprocess.SubprocessError):
        summary = empty_summary()
        add_blocker(summary, "campaign_driver_failed")
        print(json.dumps(summary, sort_keys=True))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
