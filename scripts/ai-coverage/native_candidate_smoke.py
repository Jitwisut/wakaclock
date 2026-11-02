#!/usr/bin/env python3
"""Opt-in artifact smoke on a fresh GitHub-hosted native runner; never a release.

This installs real per-user services. It refuses an existing runtime/profile or
service, never rewrites HOME, and never uses a real account. Native/provider
certification remains separate. Missing baseline/VS Code is pending, not passed.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import platform
import shutil
import sqlite3
import subprocess
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from internal_candidate_preflight import HOSTS, architecture
from package_internal_candidate import inspect_members
from native_smoke_common import SmokeError, child


LABELS = ("com.atoaxis.wakaclock.capture", "com.atoaxis.wakaclock.delivery")
COMPONENTS = ("capture", "delivery")
PROVIDER_ROOTS = (".codex", ".claude", ".gemini", ".kimi", ".kilo", ".cursor", ".cline",
                  ".roo", ".windsurf", ".antigravity", ".opencode", ".config/opencode",
                  "Library/Application Support/Code", "Library/Application Support/Cursor",
                  "AppData/Roaming/Code", "AppData/Roaming/Cursor")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def services() -> set[str]:
    if platform.system() == "Darwin":
        rows = child(["launchctl", "list"]).splitlines()
        return {row.split()[-1] for row in rows if row.split()}
    command = "$ErrorActionPreference='Stop'; @(Get-ScheduledTask | Where-Object {$_.TaskName -like 'com.atoaxis.wakaclock.*'} | Select-Object -ExpandProperty TaskName) | ConvertTo-Json -Compress"
    value = json.loads(child(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command]) or "[]")
    if value is not None and not isinstance(value, (str, list)):
        raise SmokeError("native_service_inventory_invalid")
    if isinstance(value, list) and any(not isinstance(v, str) for v in value):
        raise SmokeError("native_service_inventory_invalid")
    return {value} if isinstance(value, str) else set(value or [])


def require_fresh_runner(target: str, home: Path, environment: dict) -> None:
    expected = HOSTS.get(target)
    if expected is None or (platform.system(), architecture(platform.machine())) != expected[:2]:
        raise SmokeError("native_smoke_host_mismatch")
    if environment.get("GITHUB_ACTIONS") != "true" or environment.get("RUNNER_ENVIRONMENT") != "github-hosted":
        raise SmokeError("native_smoke_requires_disposable_github_host")
    if not home.is_absolute() or home.is_symlink() or home.resolve() != home:
        raise SmokeError("native_smoke_home_unconfirmed")
    if (home / ".wakaclock").exists() or any((home / p).exists() for p in PROVIDER_ROOTS):
        raise SmokeError("native_smoke_requires_fresh_profile")
    if any(name.startswith(("WAKACLOCK_", "WAKATIME_", "ATOAXIS_")) for name in environment):
        raise SmokeError("native_smoke_existing_application_environment")
    existing = services()
    if any(name in existing or any(item.startswith(name + "-") for item in existing) for name in LABELS):
        raise SmokeError("native_smoke_existing_service")
    if platform.system() == "Darwin":
        if any((home / "Library/LaunchAgents" / (name + ".plist")).exists() for name in LABELS):
            raise SmokeError("native_smoke_existing_manifest")
        uid = child(["id", "-u"]).strip()
        if not uid.isdigit():
            raise SmokeError("native_smoke_service_identity_unconfirmed")
        disabled = child(["launchctl", "print-disabled", "gui/" + uid])
        if any(('"' + name + '"') in disabled for name in LABELS):
            raise SmokeError("native_smoke_existing_service_override")
        # launchd does not inherit the caller's sanitized environment. Refuse
        # application overrides already set in that per-user service manager.
        for name in ("WAKACLOCK_SERVER_URL", "WAKACLOCK_API_KEY"):
            result = subprocess.run(["launchctl", "getenv", name], capture_output=True, timeout=10)
            if result.stdout.strip():
                raise SmokeError("native_smoke_existing_service_environment")


def environment_for_fixture() -> dict[str, str]:
    allowed = {"PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "HOME", "USERPROFILE",
               "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "TZ",
               "DISPLAY", "USER", "LOGNAME"}
    # Do not forward CI/provider/GitHub/cloud credentials into the fixture or
    # VS Code host. This is an allowlist, not a guess at every secret's name.
    result = {key: value for key, value in os.environ.items() if key.upper() in allowed}
    result["NO_PROXY"] = "*"
    result["no_proxy"] = "*"
    # HOME/USERPROFILE are copied unchanged, never redirected to simulate native
    # service behavior. Fresh host/profile ownership is checked before mutation.
    return result


def extract_runtime(members: dict[str, bytes], manifest: dict, destination: Path) -> Path:
    destination.mkdir(parents=True, exist_ok=False)
    for name, data in members.items():
        if name.startswith("extension/resources/"):
            relative = name.removeprefix("extension/")
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    binary = destination / "resources/bin" / manifest["binary"]
    binary.chmod(0o700)
    if sha(binary.read_bytes()) != manifest["sha256"]:
        raise SmokeError("native_smoke_extracted_hash_mismatch")
    return binary


class FixtureServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, key: str):
        super().__init__(("127.0.0.1", 0), FixtureHandler)
        self.key = key
        self.requests = 0
        self.heartbeat_attempts = 0
        self.heartbeat_id = None
        self.invalid = False


class FixtureHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        self.handle_fixture()

    def do_POST(self):
        self.handle_fixture()

    def handle_fixture(self):
        server = self.server
        auth = self.headers.get("Authorization", "")
        allowed = {"Bearer " + server.key,
                   "Basic " + base64.b64encode((server.key + ":").encode()).decode()}
        if auth not in allowed:
            server.invalid = True
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            server.invalid = True
            self.send_error(400)
            return
        if size > 1024 * 1024 or size < 0:
            server.invalid = True
            self.send_error(413)
            return
        body = self.rfile.read(size)
        if body:
            try:
                value = json.loads(body)
                def validate(node):
                    if isinstance(node, dict):
                        for key, item in node.items():
                            if key.lower() in {"prompt", "response", "content", "diff", "clipboard", "api_key", "authorization"}:
                                raise ValueError("forbidden content")
                            validate(item)
                    elif isinstance(node, list):
                        for item in node:
                            validate(item)
                validate(value)
                if self.path.split("?")[0] in {"/api/v1/heartbeats", "/api/v1/heartbeats.bulk"}:
                    def identities(node):
                        if isinstance(node, dict):
                            return ([node["heartbeat_id"]] if "heartbeat_id" in node else []) + [v for item in node.values() for v in identities(item)]
                        if isinstance(node, list):
                            return [v for item in node for v in identities(item)]
                        return []
                    if self.command != "POST" or identities(value) != [server.heartbeat_id]:
                        server.invalid = True
                    else:
                        server.heartbeat_attempts += 1
            except (ValueError, RecursionError):
                server.invalid = True
        server.requests += 1
        self.send_response(503)
        self.send_header("Retry-After", "60")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"error":"isolated_native_smoke_retry"}')


def queue_observation(runtime: Path, heartbeat_id: str) -> tuple[str, str]:
    # Read with SQLite, including WAL, rather than hashing/copying the main file.
    with sqlite3.connect((runtime / "queue.db").as_uri() + "?mode=ro", uri=True) as db:
        payloads = db.execute("SELECT payload FROM heartbeat_queue WHERE heartbeat_id=?", (heartbeat_id,)).fetchall()
        receipts = db.execute("SELECT input_hash FROM editor_handoff_receipts WHERE heartbeat_id=?", (heartbeat_id,)).fetchall()
        total = db.execute("SELECT count(*) FROM heartbeat_queue").fetchone()[0]
    if total != 1 or len(payloads) != 1 or len(receipts) != 1:
        raise SmokeError("native_smoke_pending_or_receipt_missing_or_duplicated")
    return sha(payloads[0][0].encode()), receipts[0][0]


def pointer_hash(runtime: Path, component: str) -> str:
    pointer = json.loads((runtime / "services" / (component + ".json")).read_text())
    active = Path(pointer["active"])
    if not active.resolve().is_relative_to((runtime / "services").resolve()):
        raise SmokeError("native_smoke_pointer_outside_owned_runtime")
    value = sha(active.read_bytes())
    if value != pointer["sha256"]:
        raise SmokeError("native_smoke_installed_hash_mismatch")
    return value


def pause_observed(cli, binary: Path, component: str) -> None:
    began = datetime.now(timezone.utc).timestamp()
    cli(binary, ["runtime", "pause", "--component", component, "--json"])
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        status = cli(binary, ["runtime", "status", "--json"])
        state = status.get(component, {}).get("state") or {}
        try:
            checked = datetime.fromisoformat(state.get("checked_at", "").replace("Z", "+00:00")).timestamp()
        except (ValueError, TypeError):
            checked = 0
        if (status.get("desired", {}).get("desired", {}).get(component) is False
                and status.get(component, {}).get("paused_by_user") is True
                and state.get("status") == "paused_by_user" and checked >= began):
            return
        time.sleep(0.2)
    raise SmokeError("native_smoke_pause_observation_missing")


def cleanup_services(cli, binary: Path, components: list[str]) -> set[str]:
    failures = set()
    for component in reversed(components):
        try:
            cli(binary, ["runtime", "pause", "--component", component, "--json"])
        except Exception:
            failures.add("pause")
        try:
            cli(binary, ["runtime", "uninstall", "--component", component])
        except Exception:
            failures.add("uninstall")
    return failures


def run_smoke(vsix: Path, commit: str, output: Path, *, previous_vsix: Path | None = None,
              previous_commit: str | None = None, vscode: Path | None = None) -> dict:
    evidence, members = inspect_members(vsix, commit)
    manifest = evidence["manifest"]
    home = Path.home()
    require_fresh_runner(manifest["target"], home, os.environ)
    baseline = None
    if previous_vsix is not None:
        if previous_commit is None:
            raise SmokeError("native_smoke_baseline_commit_required")
        old_evidence, old_members = inspect_members(previous_vsix, previous_commit)
        if old_evidence["manifest"]["target"] != manifest["target"]:
            raise SmokeError("native_smoke_baseline_target_mismatch")
        if previous_commit != commit and old_evidence["manifest"]["sha256"] != manifest["sha256"]:
            baseline = (old_evidence["manifest"], old_members)
    work = Path(tempfile.mkdtemp(prefix="atoaxis-native-ทดสอบ path-", dir=os.environ["RUNNER_TEMP"]))
    runtime = home / ".wakaclock"
    claimed = False
    touched: list[str] = []
    server = None
    cleanup_confirmed = False
    preserve_work = False
    report = {"schema_version":1, "source_commit":commit, "target":manifest["target"],
              "binary_sha256":manifest["sha256"], "vsix_sha256":sha(vsix.read_bytes()),
              "scope":"artifact_native_lifecycle", "checks":{}, "native_certification":"pending",
              "live_adapter_certification":"pending", "production_ready":False}
    env = environment_for_fixture()
    def cli(binary, args, payload=None):
        return json.loads(child([str(binary), *args], env=env,
                                stdin=json.dumps(payload) if payload is not None else None))
    try:
        binary = extract_runtime(members, manifest, work / "candidate")
        old_binary = extract_runtime(baseline[1], baseline[0], work / "previous") if baseline else binary
        runtime.mkdir(mode=0o700)  # Atomic claim, never reuse a user's directory.
        claimed = True
        fixture_key = "waka_" + str(uuid.uuid4())
        server = FixtureServer(fixture_key)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        (work / "fixture-origin.json").write_text(json.dumps({"origin":f"http://127.0.0.1:{server.server_port}"}))
        config = f'user_id = "{uuid.uuid4()}"\nserver_url = "http://127.0.0.1:{server.server_port}"\napi_key = "{fixture_key}"\n'
        with (runtime / "config.toml").open("x", encoding="utf-8") as config_file:
            config_file.write(config)
            config_file.flush()
            os.fsync(config_file.fileno())
        (runtime / "config.toml").chmod(0o600)
        cli(binary, ["runtime", "pause", "--component", "all", "--json"])
        scope = cli(binary, ["journal-scope"])
        if not scope.get("owner_confirmed"):
            raise SmokeError("native_smoke_fixture_identity_unconfirmed")
        heartbeat_id = str(uuid.uuid4())
        server.heartbeat_id = heartbeat_id
        item = {"entity":str(work / "synthetic-fixture.txt"), "project":"internal-native-smoke",
                "time":time.time(), "heartbeat_id":heartbeat_id, "active_seconds":0.0}
        ack = cli(binary, ["heartbeat-batch"], {"schema_version":1, "scope_id":scope["scope_id"], "items":[item]})
        if ack.get("results") != [{"heartbeat_id":heartbeat_id, "status":"accepted", "error_code":None}]:
            raise SmokeError("native_smoke_durable_fixture_ack_missing")
        retained = queue_observation(runtime, heartbeat_id)
        def preserve():
            if queue_observation(runtime, heartbeat_id) != retained:
                raise SmokeError("native_smoke_queue_identity_or_payload_changed")
        for component in COMPONENTS:
            touched.append(component)
            cli(old_binary, ["runtime", "install", "--component", component])
            expected = baseline[0]["sha256"] if baseline else manifest["sha256"]
            if pointer_hash(runtime, component) != expected:
                raise SmokeError("native_smoke_install_selection_mismatch")
            cli(old_binary, ["runtime", "install", "--component", component])
            preserve()
        report["checks"]["install_idempotent"] = {"status":"passed"}
        if baseline:
            for component in COMPONENTS:
                cli(binary, ["runtime", "upgrade", "--component", component])
                if pointer_hash(runtime, component) != manifest["sha256"]:
                    raise SmokeError("native_smoke_upgrade_selection_mismatch")
                preserve()
                cli(binary, ["runtime", "rollback", "--component", component])
                if pointer_hash(runtime, component) != baseline[0]["sha256"]:
                    raise SmokeError("native_smoke_rollback_selection_mismatch")
                preserve()
                cli(binary, ["runtime", "upgrade", "--component", component])
            report["checks"]["upgrade_rollback"] = {"status":"passed", "previous_commit":previous_commit,
                "previous_binary_sha256":baseline[0]["sha256"], "installed_binary_sha256":manifest["sha256"]}
        else:
            report["checks"]["upgrade_rollback"] = {"status":"pending", "reason":"distinct_verified_previous_artifact_required"}
        status = cli(binary, ["runtime", "status", "--json"])
        if any(status["desired"]["desired"].get(c) is not False for c in (*COMPONENTS, "backend-local")):
            raise SmokeError("native_smoke_pause_not_persistent")
        for component in COMPONENTS:
            cli(binary, ["runtime", "resume", "--component", component, "--json"])
            resumed = cli(binary, ["runtime", "status", "--json"])
            if (resumed["desired"]["desired"].get(component) is not True or not resumed[component]["running"]
                    or resumed[component]["state"]["binary_sha256"] != pointer_hash(runtime, component)):
                raise SmokeError("native_smoke_resume_unconfirmed")
            if component == "delivery":
                deadline = time.monotonic() + 25
                while server.heartbeat_attempts == 0 and time.monotonic() < deadline:
                    time.sleep(0.1)
                if server.heartbeat_attempts == 0:
                    raise SmokeError("native_smoke_loopback_delivery_unobserved")
            pause_observed(cli, binary, component)
        preserve()
        report["checks"]["status_persistent_pause_resume"] = {"status":"passed"}
        if vscode is None:
            report["checks"]["vsix_install_activation"] = {"status":"pending", "reason":"native_vscode_executable_required"}
        else:
            from native_vscode_smoke import run_vscode
            try:
                report["checks"]["vsix_install_activation"] = run_vscode(vscode, vsix, commit, manifest, work, env)
            except Exception:
                preserve_work = True
                raise
            preserve()
        if server.invalid:
            raise SmokeError("native_smoke_unexpected_outbound_metadata")
        report["checks"]["queue_receipts_preserved"] = {"status":"passed", "fixture_records":1,
            "payload_sha256":retained[0], "input_sha256":retained[1], "server_acceptance":"not_tested_503_fixture"}
    except (Exception, KeyboardInterrupt) as error:
        report["failure"] = str(error) if isinstance(error, SmokeError) else "native_smoke_evidence_invalid"
        preserve_work = preserve_work or (isinstance(error, SmokeError) and error.preserve_work)
    finally:
        if claimed:
            try:
                # Do not delete runtime data. Only owned services from this fresh
                # claim are stopped/unregistered, before the loopback stub closes.
                cleanup_failures = cleanup_services(cli, binary, touched)
                remaining = services()
                if "uninstall" in cleanup_failures or any(name in remaining or any(v.startswith(name + "-") for v in remaining) for name in LABELS):
                    raise SmokeError("native_smoke_service_cleanup_unconfirmed")
                if "preserve" in locals():
                    preserve()
                cleanup_confirmed = True
                if "pause" in cleanup_failures:
                    report.setdefault("failure", "native_smoke_cleanup_pause_failed")
                report["checks"]["uninstall_preserves_queue"] = {"status":"passed"} if "preserve" in locals() else {
                    "status":"pending", "reason":"no_durable_fixture_accepted"}
            except Exception:
                report["failure"] = "native_smoke_cleanup_or_retention_unconfirmed"
        if server is not None:
            server.shutdown()
            server.server_close()
        if not preserve_work and (cleanup_confirmed or not claimed):
            shutil.rmtree(work)
        report["temporary_work_preserved"] = bool(preserve_work or (claimed and not cleanup_confirmed))
        report["status"] = "failed" if "failure" in report else (
            "passed" if all(v["status"] == "passed" for v in report["checks"].values()) else "pending")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, sort_keys=True, indent=2) + "\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vsix", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--previous-vsix", type=Path)
    parser.add_argument("--previous-commit")
    parser.add_argument("--vscode", type=Path)
    args = parser.parse_args()
    try:
        report = run_smoke(args.vsix, args.commit, args.output, previous_vsix=args.previous_vsix,
                           previous_commit=args.previous_commit, vscode=args.vscode)
        print(json.dumps({"status":report["status"], "scope":report["scope"]}))
        raise SystemExit(1 if report["status"] == "failed" else 0)
    except (SmokeError, ValueError, OSError):
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({"schema_version":1, "source_commit":args.commit,
            "status":"failed", "failure":"native_smoke_preflight_unconfirmed", "production_ready":False}) + "\n")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
