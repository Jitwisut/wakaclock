#!/usr/bin/env python3
"""Run a bounded Codex CLI campaign and emit only certification metadata.

This is the F5-02 driver for ``run_live_certification.py``.  It deliberately
does not copy credentials, retain Codex stdout, or write prompts, patches,
paths, account identifiers, or source content to the artifact.  A campaign is
opt-in with ``--execute`` because it invokes an authenticated AI client and may
consume a paid account.  The driver can prove transcript capture and parser
events locally; broker/API/dashboard stages remain ``not_run`` until their
explicit delivery/readback configuration is supplied.

A scenario run drives a real Codex CLI with the wakaclock hook active, so its
heartbeats reach whatever account ``WAKACLOCK_API_KEY`` points at and would
otherwise show ``scenario-*`` projects on a developer's own dashboard.  ``--execute``
therefore refuses to run against a personal account: pass ``--campaign-api-key``
(a throwaway user), ``--campaign-server-url`` (a disposable backend), or the
explicit ``--allow-shared-account`` opt-out. Transcript storage is independently
isolated: ``--codex-home`` must name a separately authenticated Codex home outside
the personal/active home. Never reuse the personal transcript directory, even
with an isolated API key, since background collectors can replay those sessions.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
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
        "In this disposable workspace, use the apply_patch tool (not a shell command) to "
        "create or modify single.txt with a short marker. Do not touch any other file."
    ),
    "multi-file": (
        "In this disposable workspace, use one apply_patch tool call (not shell commands) "
        "to create or modify multi-a.txt and multi-b.txt with short markers. Do not touch "
        "any other file."
    ),
    "create-delete-rename": (
        "In this disposable workspace, use the apply_patch tool (not shell commands) to "
        "create created.txt, move rename-source.txt to rename-target.txt, and delete "
        "delete-me.txt. Do not touch any other file."
    ),
    "failure-no-op": (
        "In this disposable workspace, do not change any files. Explain what you would do "
        "without invoking a file mutation tool."
    ),
    "retry-dedup": (
        "In this disposable workspace, use the apply_patch tool (not a shell command) to "
        "make one small change to retry.txt and then stop. Do not change any other file."
    ),
    "nested-execution": (
        "In this disposable workspace, use the apply_patch tool to make one small change to "
        "nested.txt through the normal file-edit path and stop. Do not change any other file."
    ),
}
VERSION_RE = re.compile(r"\bcodex-cli\s+([0-9A-Za-z._-]+)\b")
THREAD_ID_RE = re.compile(r'"thread_id"\s*:\s*"([A-Za-z0-9_-]{8,128})"')
PARSED_RE = re.compile(r"\b(\d+) event\(s\) parsed since last (?:scan|sync)\b")
PARSED_DETAIL_RE = re.compile(
    r"\b(\d+) event\(s\) parsed since last (?:scan|sync), "
    r"(\d+) already delivered, (\d+) new\b"
)
BROKER_RE = re.compile(r"\bbroker accepted (\d+) \(duplicates (\d+)\)")
MAX_PROCESS_OUTPUT = 2 * 1024 * 1024
DRY_RUN_EVENT_RE = re.compile(r"^\s*\[dry-run\]\s+(\S+)\s+", re.MULTILINE)
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


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
    thread_id: str | None = None,
) -> Path | None:
    after = snapshot_sessions(codex_home)
    candidates = [
        path
        for path, metadata in after.items()
        if metadata[0] >= started_ns and (path not in before or before[path] != metadata)
    ]
    if thread_id:
        thread_candidates = [path for path in candidates if thread_id in path.name]
        if thread_candidates:
            candidates = thread_candidates
    return max(candidates, key=lambda path: after[path][0], default=None)


def parse_parser_output(output: str) -> tuple[int, int, int, int, int]:
    """Extract bounded sync counters without retaining parser output.

    Current CLI builds print the already-delivered/new split.  Keep the older
    count-only shape as a compatibility fallback because a shipped binary may
    be one release behind the driver.  The split is required for the retry
    scenario; a count-only response can never prove replay deduplication.
    """
    detailed = list(PARSED_DETAIL_RE.finditer(output))
    if detailed:
        parsed = sum(int(match.group(1)) for match in detailed)
        already_delivered = sum(int(match.group(2)) for match in detailed)
        new_events = sum(int(match.group(3)) for match in detailed)
    else:
        parsed = sum(int(match.group(1)) for match in PARSED_RE.finditer(output))
        already_delivered = 0
        new_events = parsed
    accepted = 0
    duplicates = 0
    for match in BROKER_RE.finditer(output):
        accepted += int(match.group(1))
        duplicates += int(match.group(2))
    return parsed, accepted, duplicates, already_delivered, new_events


def parse_dry_run_event_ids(output: str) -> set[str]:
    """Extract opaque event IDs from the CLI's metadata-only dry-run output.

    The IDs are retained only in memory and are used to bind the later API and
    ClickHouse readback to this campaign. Paths and the rest of the dry-run
    output are deliberately discarded.
    """
    return {match.group(1) for match in DRY_RUN_EVENT_RE.finditer(output)}


def _json_request(
    method: str,
    url: str,
    *,
    api_key: str,
    payload: dict[str, Any] | None = None,
    timeout: int = 15,
) -> tuple[int, dict[str, Any] | None]:
    """Perform a bounded metadata-only request without returning raw errors."""
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, method=method)
    request.add_header("Authorization", "Basic " + base64.b64encode(f"{api_key}:".encode()).decode())
    if body is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            value = json.loads(response.read().decode("utf-8"))
            return response.status, value if isinstance(value, dict) else None
    except (OSError, urllib.error.HTTPError, json.JSONDecodeError, UnicodeDecodeError):
        return 0, None


def _clickhouse_rows(
    url: str,
    *,
    username: str,
    password: str,
    query: str,
    timeout: int = 15,
) -> list[dict[str, Any]] | None:
    """Read only allowlisted canonical columns from an isolated ClickHouse."""
    request = urllib.request.Request(url.rstrip("/") + "/", data=query.encode("utf-8"), method="POST")
    credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
    request.add_header("Authorization", "Basic " + credentials)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            value = json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.HTTPError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    rows = value.get("data") if isinstance(value, dict) else None
    return rows if isinstance(rows, list) and all(isinstance(row, dict) for row in rows) else None


def _campaign_dates(started_at: float, finished_at: float) -> list[str]:
    first = dt.datetime.fromtimestamp(started_at, dt.timezone.utc).date()
    last = dt.datetime.fromtimestamp(finished_at, dt.timezone.utc).date()
    current = first
    dates: list[str] = []
    while current <= last and len(dates) < 3:
        dates.append(current.isoformat())
        current += dt.timedelta(days=1)
    return dates


def _dashboard_totals(payload: dict[str, Any]) -> dict[str, int] | None:
    if payload.get("schema_version") != 3:
        return None
    daily = payload.get("daily_attribution")
    if not isinstance(daily, list):
        return None
    totals = {
        "ai_added": 0,
        "ai_deleted": 0,
        "ai_verified_added": 0,
        "ai_verified_deleted": 0,
    }
    try:
        for row in daily:
            if not isinstance(row, dict):
                return None
            for key in totals:
                value = row.get(key, 0)
                if not isinstance(value, int) or value < 0:
                    return None
                totals[key] += value
    except (TypeError, ValueError):
        return None
    return totals


def _dashboard_snapshot(
    campaign_url: str,
    campaign_key: str,
    when: float,
) -> dict[str, int] | None:
    date = dt.datetime.fromtimestamp(when, dt.timezone.utc).date()
    query = urllib.parse.urlencode(
        {"start": date.isoformat(), "end": (date + dt.timedelta(days=1)).isoformat(), "timezone": "UTC"}
    )
    status, response = _json_request(
        "GET",
        f"{campaign_url.rstrip('/')}/api/v1/dashboard/analytics?{query}",
        api_key=campaign_key,
    )
    if status != 200 or response is None:
        return None
    return _dashboard_totals(response)


def _resolve_user_id(campaign_url: str, campaign_key: str) -> str | None:
    status, response = _json_request(
        "GET",
        f"{campaign_url.rstrip('/')}/api/v1/users/current",
        api_key=campaign_key,
    )
    if status != 200 or response is None:
        return None
    data = response.get("data")
    if not isinstance(data, dict):
        return None
    value = data.get("id") or data.get("user_id")
    return value if isinstance(value, str) and UUID_RE.fullmatch(value) else None


def _readback_campaign(
    args: argparse.Namespace,
    *,
    campaign_url: str,
    campaign_key: str,
    event_ids: set[str],
    started_at: float,
    finished_at: float,
    baseline_dashboard: dict[str, int] | None,
) -> tuple[dict[str, str], dict[str, int], list[str]]:
    """Verify event-bound API, canonical and dashboard visibility.

    All raw rows and IDs stay in process memory. The returned values contain
    only stage statuses, bounded counters and blocker codes suitable for the
    certification artifact.
    """
    stages = {"api_delivery": "not_run", "canonical_reconcile": "not_run", "dashboard_readback": "not_run"}
    metrics = {"delivered": 0, "canonical": 0}
    blockers: list[str] = []
    if not campaign_url or not campaign_key:
        return stages, metrics, ["readback_identity_not_configured"]
    if not UUID_RE.fullmatch(args.readback_user_id or ""):
        return stages, metrics, ["readback_user_id_not_configured"]
    if not event_ids:
        return stages, metrics, ["readback_event_ids_not_configured"]
    expected_provider = args.expected_provider
    expected_model = args.expected_model
    if not expected_provider or not expected_model:
        return stages, metrics, ["readback_tuple_not_configured"]

    api_base = campaign_url.rstrip("/") + "/api/v1"
    api_rows: list[dict[str, Any]] = []
    for date in _campaign_dates(started_at, finished_at):
        query = urllib.parse.urlencode({"date": date, "timezone": "UTC"})
        status, response = _json_request(
            "GET",
            f"{api_base}/heartbeats?{query}",
            api_key=campaign_key,
        )
        if status != 200 or response is None or not isinstance(response.get("data"), list):
            blockers.append("api_delivery_readback_failed")
            break
        api_rows.extend(row for row in response["data"] if isinstance(row, dict))
    if not blockers:
        api_matches = [row for row in api_rows if row.get("ai_event_id") in event_ids]
        api_counts: dict[str, int] = {}
        for row in api_matches:
            event_id = row.get("ai_event_id")
            if isinstance(event_id, str):
                api_counts[event_id] = api_counts.get(event_id, 0) + 1
        missing = event_ids - set(api_counts)
        duplicate = any(count != 1 for count in api_counts.values())
        tuple_ok = all(
            row.get("actor_type") == "ai_verified"
            and row.get("ai_agent") == "codex"
            and row.get("ai_provider") == expected_provider
            and row.get("ai_model") == expected_model
            for row in api_matches
        )
        if missing:
            blockers.append("api_delivery_event_missing")
        if duplicate:
            blockers.append("api_delivery_event_duplicate")
        if not tuple_ok:
            blockers.append("api_delivery_tuple_mismatch")
        if not blockers:
            stages["api_delivery"] = "passed"
            metrics["delivered"] = len(api_matches)

    clickhouse_url = args.clickhouse_url
    if not clickhouse_url:
        blockers.append("canonical_readback_not_configured")
    else:
        start = max(0.0, started_at - 300.0)
        end = finished_at + 300.0
        user_id = args.readback_user_id
        quote = chr(39)
        query = (
            "SELECT ai_event_id, revision, actor_type, ai_agent, ai_provider, ai_model, "
            "ai_lines_added, ai_lines_deleted "
            "FROM wakaclock.heartbeats_canonical "
            f"WHERE user_id = toUUID({quote}{user_id}{quote}) "
            f"AND time >= {start} AND time <= {end} LIMIT 10000 FORMAT JSON"
        )
        rows = _clickhouse_rows(
            clickhouse_url,
            username=args.clickhouse_user,
            password=args.clickhouse_password,
            query=query,
        )
        if rows is None:
            blockers.append("canonical_readback_failed")
        else:
            matches = [row for row in rows if row.get("ai_event_id") in event_ids]
            counts: dict[str, int] = {}
            for row in matches:
                event_id = row.get("ai_event_id")
                if isinstance(event_id, str):
                    counts[event_id] = counts.get(event_id, 0) + 1
            missing = event_ids - set(counts)
            duplicate = any(count != 1 for count in counts.values())
            tuple_ok = all(
                row.get("actor_type") == "ai_verified"
                and row.get("ai_agent") == "codex"
                and row.get("ai_provider") == expected_provider
                and row.get("ai_model") == expected_model
                for row in matches
            )
            if missing:
                blockers.append("canonical_event_missing")
            if duplicate:
                blockers.append("canonical_event_duplicate")
            if not tuple_ok:
                blockers.append("canonical_tuple_mismatch")
            # A separate canonical query is authoritative even when API
            # readback has a transient issue; retain its exact count.
            if not missing and not duplicate and tuple_ok:
                stages["canonical_reconcile"] = "passed"
                metrics["canonical"] = len(matches)

            expected_added = sum(int(row.get("ai_lines_added") or 0) for row in matches)
            expected_deleted = sum(int(row.get("ai_lines_deleted") or 0) for row in matches)
            dashboard_baseline = baseline_dashboard
            if dashboard_baseline is None:
                blockers.append("dashboard_baseline_not_captured")
            else:
                dashboard: dict[str, int] | None = None
                for _ in range(5):
                    current = dt.datetime.fromtimestamp(finished_at, dt.timezone.utc).date()
                    end_date = current + dt.timedelta(days=1)
                    query_string = urllib.parse.urlencode(
                        {"start": current.isoformat(), "end": end_date.isoformat(), "timezone": "UTC"}
                    )
                    status, response = _json_request(
                        "GET",
                        f"{api_base}/dashboard/analytics?{query_string}",
                        api_key=campaign_key,
                    )
                    if status == 200 and response is not None:
                        dashboard = _dashboard_totals(response)
                        if dashboard is not None:
                            delta_added = dashboard["ai_verified_added"] - dashboard_baseline["ai_verified_added"]
                            delta_deleted = dashboard["ai_verified_deleted"] - dashboard_baseline["ai_verified_deleted"]
                            if delta_added == expected_added and delta_deleted == expected_deleted:
                                break
                    time.sleep(1)
                if dashboard is None:
                    blockers.append("dashboard_readback_failed")
                else:
                    delta_added = dashboard["ai_verified_added"] - dashboard_baseline["ai_verified_added"]
                    delta_deleted = dashboard["ai_verified_deleted"] - dashboard_baseline["ai_verified_deleted"]
                    if delta_added != expected_added or delta_deleted != expected_deleted:
                        blockers.append("dashboard_delta_mismatch")
                    else:
                        stages["dashboard_readback"] = "passed"
    return stages, metrics, sorted(set(blockers))


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
    if scenario == "nested-execution":
        # The Codex CLI transcript does not expose a stable parent/child
        # execution contract that this driver can validate safely.
        return "not_run"
    if scenario == "retry-dedup":
        # The caller upgrades this row only after a second delivered sync proves
        # that the same event is already delivered and no new event is emitted.
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
    unknown_configured = sorted(set(configured_scenarios) - set(SCENARIO_IDS))
    if unknown_configured:
        raise ValueError("unsupported certification scenario")
    selected = args.scenario_ids or configured_scenarios or list(SCENARIO_IDS)
    summary["scenarios"] = {scenario: "not_run" for scenario in selected}

    if not args.execute:
        add_blocker(summary, "campaign_not_enabled")
        return summary

    campaign_key = args.campaign_api_key or os.environ.get("WAKACLOCK_CAMPAIGN_API_KEY")
    campaign_url = args.campaign_server_url or os.environ.get("WAKACLOCK_CAMPAIGN_SERVER_URL")
    if not (campaign_key or campaign_url or args.allow_shared_account):
        # Fail closed rather than let a real Codex run post `scenario-*` heartbeats onto
        # whatever WAKACLOCK_API_KEY points at (typically the operator's own account).
        add_blocker(summary, "campaign_identity_not_isolated")
        return summary

    campaign_started_at = time.time()
    campaign_event_ids: set[str] = set()
    baseline_dashboard: dict[str, int] | None = None
    if args.readback:
        if not args.deliver:
            add_blocker(summary, "readback_requires_delivery")
        elif not campaign_key or not campaign_url:
            add_blocker(summary, "readback_identity_not_configured")
        else:
            if not args.readback_user_id:
                args.readback_user_id = _resolve_user_id(campaign_url, campaign_key)
            if not args.readback_user_id:
                add_blocker(summary, "readback_user_id_not_configured")
            baseline_dashboard = _dashboard_snapshot(campaign_url, campaign_key, campaign_started_at)
            if baseline_dashboard is None:
                add_blocker(summary, "dashboard_baseline_not_captured")

    codex = executable(args.codex)
    if codex is None:
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "codex_executable_unavailable")
        return summary

    # API isolation alone is insufficient: the personal collector can later replay
    # campaign transcripts from a shared CODEX_HOME under its own API identity.
    # Require an explicitly selected transcript home, never inherit the active one.
    codex_home_value = args.codex_home
    if not codex_home_value:
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "codex_auth_home_not_configured")
        return summary
    codex_home = Path(codex_home_value).expanduser().resolve()
    personal_homes = {Path.home().joinpath(".codex").resolve()}
    if os.environ.get("CODEX_HOME"):
        personal_homes.add(Path(os.environ["CODEX_HOME"]).expanduser().resolve())
    if os.name == "posix":
        import pwd

        personal_homes.add(Path(pwd.getpwuid(os.getuid()).pw_dir, ".codex").resolve())
    if any(codex_home == home or home in codex_home.parents for home in personal_homes):
        add_blocker(summary, "campaign_transcript_home_not_isolated")
        summary["stages"]["source_capture"] = "failed"
        return summary
    if not codex_home.is_dir():
        summary["stages"]["source_capture"] = "failed"
        add_blocker(summary, "codex_auth_home_unavailable")
        return summary

    process_env = {**os.environ, "HOME": str(sandbox / "home"), "CODEX_HOME": str(codex_home)}
    # Route every scenario heartbeat (from the live Codex hook and from `wakaclock sync`)
    # to the isolated campaign identity so it never lands on a personal dashboard.
    if campaign_key:
        process_env["WAKACLOCK_API_KEY"] = campaign_key
    if campaign_url:
        process_env["WAKACLOCK_SERVER_URL"] = campaign_url
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
        try:
            initialized = run_process(
                ["git", "init", "-q"],
                cwd=scenario_root,
                env=process_env,
                timeout=args.timeout,
            )
        except (OSError, subprocess.SubprocessError):
            summary["scenarios"][scenario] = "failed"
            add_blocker(summary, "disposable_repo_init_failed")
            continue
        if initialized.returncode != 0:
            summary["scenarios"][scenario] = "failed"
            add_blocker(summary, "disposable_repo_init_failed")
            continue
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
            "--skip-git-repo-check",
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
        if completed.returncode != 0:
            summary["scenarios"][scenario] = "failed"
            add_blocker(summary, "codex_exec_failed")
            continue

        thread_match = THREAD_ID_RE.search(completed.stdout)
        session = newest_changed_session(
            codex_home,
            before,
            started_ns,
            thread_id=thread_match.group(1) if thread_match else None,
        )
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

        expected_event_ids: set[str] = set()
        if args.readback:
            dry_run_command = [
                wakaclock,
                "ai",
                "sync",
                "--agent",
                "codex",
                "--dry-run",
                "--from-start",
                "--transcript",
                str(captured),
            ]
            try:
                dry_run_result = run_process(
                    dry_run_command,
                    cwd=sandbox,
                    env=process_env,
                    timeout=args.timeout,
                )
            except (OSError, subprocess.SubprocessError):
                dry_run_result = None
            if dry_run_result is None or dry_run_result.returncode != 0:
                add_blocker(summary, "readback_event_probe_failed")
            else:
                expected_event_ids = parse_dry_run_event_ids(
                    f"{dry_run_result.stdout}\n{dry_run_result.stderr}"
                )

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
        parsed, accepted, duplicates, _already_delivered, new_events = parse_parser_output(parser_output)
        summary["metrics"]["captured"] += parsed
        summary["metrics"]["producer_events"] += parsed
        summary["metrics"]["broker_accepted"] += accepted
        summary["metrics"]["duplicates"] += duplicates
        summary["stages"]["source_capture"] = "passed"
        if parsed > 0 or scenario == "failure-no-op":
            summary["stages"]["producer_event"] = "passed"
        status = scenario_status(
            scenario,
            parsed_result.returncode == 0,
            parsed,
            session is not None,
        )
        if parsed_result.returncode != 0:
            add_blocker(summary, "parser_probe_failed")
        if args.readback:
            if parsed > 0 and len(expected_event_ids) != parsed:
                add_blocker(summary, "readback_event_count_mismatch")
            campaign_event_ids.update(expected_event_ids)

        if scenario == "retry-dedup":
            if not args.deliver:
                add_blocker(summary, "retry_dedup_requires_delivery")
            elif (
                parsed_result.returncode != 0
                or session is None
                or parsed == 0
                or new_events == 0
                or accepted == 0
            ):
                status = "failed"
                add_blocker(summary, "retry_dedup_initial_sync_failed")
            else:
                # A second non-dry sync exercises the durable delivered-event
                # identity store. It must report the original event as already
                # delivered and produce zero new events; broker duplicate counts
                # alone are insufficient because they can hide a parser replay.
                try:
                    replay_result = run_process(
                        sync_command,
                        cwd=sandbox,
                        env=process_env,
                        timeout=args.timeout,
                    )
                except (OSError, subprocess.SubprocessError):
                    replay_result = None
                if replay_result is None:
                    status = "failed"
                    add_blocker(summary, "retry_dedup_probe_failed")
                else:
                    replay_output = f"{replay_result.stdout}\n{replay_result.stderr}"
                    replay_parsed, replay_accepted, replay_duplicates, replay_already, replay_new = parse_parser_output(
                        replay_output
                    )
                    summary["metrics"]["broker_accepted"] += replay_accepted
                    summary["metrics"]["duplicates"] += replay_duplicates
                    summary["metrics"]["replayed"] += replay_already
                    if (
                        replay_result.returncode == 0
                        and replay_parsed > 0
                        and replay_already >= replay_parsed
                        and replay_new == 0
                    ):
                        status = "passed"
                    else:
                        status = "failed"
                        add_blocker(summary, "retry_dedup_not_proven")
            summary["scenarios"][scenario] = status
        elif scenario == "nested-execution":
            summary["scenarios"][scenario] = status
            add_blocker(summary, "nested_execution_probe_not_configured")
        else:
            summary["scenarios"][scenario] = status

    if args.deliver:
        if not campaign_url and not os.environ.get("WAKACLOCK_SERVER_URL"):
            add_blocker(summary, "api_url_not_configured")
        if not campaign_key and not os.environ.get("WAKACLOCK_API_KEY"):
            add_blocker(summary, "api_key_not_configured")
        if summary["metrics"]["broker_accepted"] > 0:
            summary["stages"]["broker_accept"] = "passed"
            if args.readback:
                readback_stages, readback_metrics, readback_blockers = _readback_campaign(
                    args,
                    campaign_url=campaign_url or os.environ.get("WAKACLOCK_SERVER_URL", ""),
                    campaign_key=campaign_key or os.environ.get("WAKACLOCK_API_KEY", ""),
                    event_ids=campaign_event_ids,
                    started_at=campaign_started_at,
                    finished_at=time.time(),
                    baseline_dashboard=baseline_dashboard,
                )
                summary["stages"].update(readback_stages)
                summary["metrics"]["delivered"] = readback_metrics["delivered"]
                summary["metrics"]["canonical"] = readback_metrics["canonical"]
                for blocker in readback_blockers:
                    add_blocker(summary, blocker)
            else:
                # `wakaclock ai sync` reports the local broker inbox acknowledgement.
                # That durable local acceptance is deliberately not treated as proof
                # that the API received the event; only an explicit readback probe can
                # promote the delivery stage.
                summary["stages"]["api_delivery"] = "not_run"
                add_blocker(summary, "api_delivery_readback_not_configured")
        else:
            summary["stages"]["broker_accept"] = "not_run"
            summary["stages"]["api_delivery"] = "not_run"
    else:
        add_blocker(summary, "delivery_not_requested")

    if not args.readback:
        # These two stages require an explicit, privacy-safe readback probe. Never
        # infer them from a successful local parser or an HTTP 2xx alone.
        add_blocker(summary, "canonical_readback_not_configured")
        add_blocker(summary, "dashboard_readback_not_configured")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Run authenticated Codex scenarios")
    parser.add_argument("--codex", default=os.environ.get("CODEX_BIN", "codex"))
    parser.add_argument("--codex-home", help="Separately authenticated Codex home; personal/active homes are rejected")
    parser.add_argument("--wakaclock", default=os.environ.get("WAKACLOCK_CLI_PATH", "wakaclock"))
    parser.add_argument("--expected-version", default="0.153.4")
    parser.add_argument("--deliver", action="store_true", help="Send parsed events to the configured API")
    parser.add_argument(
        "--readback",
        action="store_true",
        help="Bind API, canonical and dashboard readback to this campaign's opaque event IDs",
    )
    parser.add_argument("--readback-user-id", default=os.environ.get("WAKACLOCK_CAMPAIGN_USER_ID"))
    parser.add_argument("--expected-provider", default=os.environ.get("WAKACLOCK_EXPECTED_PROVIDER"))
    parser.add_argument("--expected-model", default=os.environ.get("WAKACLOCK_EXPECTED_MODEL"))
    parser.add_argument("--clickhouse-url", default=os.environ.get("CLICKHOUSE_URL"))
    parser.add_argument("--clickhouse-user", default=os.environ.get("CLICKHOUSE_USER", "default"))
    parser.add_argument("--clickhouse-password", default=os.environ.get("CLICKHOUSE_PASSWORD", ""))
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--scenario-id", action="append", dest="scenario_ids")
    parser.add_argument("--receipt-output", type=Path, help="Run the isolated local receipt campaign and write its separate metadata artifact")
    parser.add_argument(
        "--campaign-api-key",
        default=os.environ.get("WAKACLOCK_CAMPAIGN_API_KEY"),
        help="wakaclock API key for a throwaway campaign account; scenario heartbeats "
        "land under it, not the operator's, so they never reach a personal dashboard",
    )
    parser.add_argument(
        "--campaign-server-url",
        default=os.environ.get("WAKACLOCK_CAMPAIGN_SERVER_URL"),
        help="Override WAKACLOCK_SERVER_URL for the campaign (e.g. a disposable backend)",
    )
    parser.add_argument(
        "--allow-shared-account",
        action="store_true",
        help="Opt out of campaign isolation and post scenario heartbeats under the "
        "current wakaclock account (not recommended)",
    )
    args = parser.parse_args()
    try:
        args.timeout = max(1, min(args.timeout, 900))
        args.scenario_ids = [bounded_id(value) for value in (args.scenario_ids or [])]
        unknown = sorted(set(args.scenario_ids) - set(SCENARIO_IDS))
        if unknown:
            raise ValueError("unsupported scenario id")
        if args.receipt_output:
            # Separate artifact contract: preserve the generic certification stdout schema.
            import sys
            sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "work-sessions"))
            from receipt_campaign import run as run_receipts, SCENARIOS as RECEIPT_SCENARIOS
            from local_lab import private_json
            selected = args.scenario_ids or list(RECEIPT_SCENARIOS)
            if set(selected) - set(RECEIPT_SCENARIOS):
                raise ValueError("unsupported receipt scenario")
            report = run_receipts("codex", args.execute, selected, min(args.timeout, 300))
            private_json(args.receipt_output, report)
            summary = empty_summary()
            summary["scenarios"] = {r["scenario"]: r["status"] for r in report["scenarios"]}
            summary["blockers"] = report["blockers"] + ["receipt_artifact_requires_review"]
            # Legacy stages stay not_run: a new receipt report is not old adapter certification.
            print(json.dumps(summary, sort_keys=True))
            return 0 if report["scenarios"] and all(r["status"] == "passed" for r in report["scenarios"]) and not report["blockers"] else 2
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
