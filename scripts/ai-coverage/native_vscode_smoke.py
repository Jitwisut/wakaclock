"""Installed VSIX host smoke, called only after native_candidate_smoke isolation."""
from __future__ import annotations

import json
import os
import signal
import subprocess
from pathlib import Path

from native_smoke_common import SmokeError, child


def host_process(args: list[str], env: dict) -> None:
    options = {"start_new_session": True} if os.name != "nt" else {
        "creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    process = subprocess.Popen(args, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **options)
    try:
        stdout, _stderr = process.communicate(timeout=120)
    except subprocess.TimeoutExpired:
        if process.poll() is None:
            if os.name == "nt":
                subprocess.run(["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                               capture_output=True, timeout=15, check=False)
            else:
                os.killpg(process.pid, signal.SIGTERM)
        try:
            process.communicate(timeout=15)
        except subprocess.TimeoutExpired as error:
            raise SmokeError("native_vscode_cleanup_unconfirmed", preserve_work=True) from error
        raise SmokeError("native_vscode_execution_timeout")
    if process.returncode or len(stdout) > 2 * 1024 * 1024:
        raise SmokeError("native_vscode_host_failed")


def run_vscode(executable: Path, vsix: Path, commit: str, manifest: dict,
               work: Path, env: dict) -> dict:
    if not executable.is_file() or executable.suffix.lower() in {".cmd", ".bat"}:
        raise SmokeError("native_vscode_native_executable_required")
    profile = work / "vscode-user-data"
    extensions = work / "vscode-extensions"
    workspace = work / "synthetic-empty-workspace"
    harness = work / "vscode-harness"
    for directory in (profile / "User", extensions, workspace, harness):
        directory.mkdir(parents=True, exist_ok=False)
    # Configure application/global settings BEFORE installed candidate activation.
    settings = {"wakaclock.autoInstallAgentHooks":False, "wakaclock.statusBarEnabled":False,
                "wakaclock.trackDebugSessions":False, "wakaclock.trackBuildTasks":False,
                "wakaclock.trackClipboardActions":False, "wakaclock.presenceAutoJoinEnabled":False,
                "wakaclock.rooTrackingEnabled":False, "wakaclock.debugLogging":False,
                "wakaclock.serverUrl":json.loads((work / "fixture-origin.json").read_text())["origin"],
                "extensions.autoUpdate":False, "extensions.autoCheckUpdates":False,
                "extensions.ignoreRecommendations":True, "update.mode":"none",
                "telemetry.telemetryLevel":"off", "workbench.enableExperiments":False,
                "security.workspace.trust.enabled":False}
    (profile / "User/settings.json").write_text(json.dumps(settings), encoding="utf-8")
    args = [str(executable.resolve()), "--user-data-dir", str(profile), "--extensions-dir", str(extensions),
            "--skip-welcome", "--skip-release-notes", "--disable-workspace-trust"]
    child([*args, "--install-extension", str(vsix.resolve()), "--force"], env=env, timeout=90)
    installed = child([*args, "--list-extensions", "--show-versions"], env=env, timeout=45)
    # The candidate is installed normally. Only the tiny test harness, never the
    # candidate checkout, is supplied as an extensionDevelopmentPath.
    candidate_id = "atoaxis.atoaxis-vscode"
    if not any(line.strip().lower().startswith(candidate_id + "@") for line in installed.splitlines()):
        raise SmokeError("native_vscode_installation_unconfirmed")
    (harness / "package.json").write_text(json.dumps({"name":"atoaxis-native-smoke-harness",
        "publisher":"atoaxis-internal-tests", "version":"0.0.0", "engines":{"vscode":"*"},
        "main":"./harness.js", "activationEvents":["*"]}), encoding="utf-8")
    (harness / "harness.js").write_text("exports.activate = () => {};\n", encoding="utf-8")
    test_file = harness / "installed-vsix.cjs"
    test_file.write_bytes(Path(__file__).with_name("native_vscode_smoke.cjs").read_bytes())
    result_file = work / "vscode-result.json"
    config = {"candidateId":candidate_id, "commit":commit, "target":manifest["target"],
              "binarySha256":manifest["sha256"], "resultFile":str(result_file)}
    config_file = harness / "fixture.json"
    config_file.write_text(json.dumps(config), encoding="utf-8")
    host_env = {**env, "NATIVE_SMOKE_TEST_CONFIG":str(config_file)}
    host_env.pop("ELECTRON_RUN_AS_NODE", None)
    host_process([*args, "--new-window", "--wait", "--extensionDevelopmentPath", str(harness),
                  "--extensionTestsPath", str(test_file), str(workspace)], host_env)
    if not result_file.is_file():
        raise SmokeError("native_vscode_result_missing")
    result = json.loads(result_file.read_text())
    if (result.get("source_commit") != commit or result.get("target") != manifest["target"]
            or result.get("binary_sha256") != manifest["sha256"]
            or any(result.get(key) is not True for key in ("installed", "activated", "commands_registered", "bundled_cli_executed", "custom_override_preserved"))):
        raise SmokeError("native_vscode_result_invalid")
    return {"status":"passed", **result}
