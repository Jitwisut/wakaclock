#!/usr/bin/env python3
"""Metadata-only native hook spool. Provider stdout is neutral, never a durable ACK."""
import argparse
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid
sys.dont_write_bytecode = True
from datetime import datetime, timezone

FIELDS = {
    "claude-code": ("hook_event_name", "session_id", "cwd", "tool_use_id", "timestamp"),
    "copilot": ("hook_event_name", "session_id", "cwd", "tool_use_id", "timestamp"),
    "gemini-cli": ("hook_event_name", "session_id", "cwd", "timestamp"),
    "cursor": ("hook_event_name", "conversation_id", "generation_id", "timestamp"),
    "cline": ("hookName", "taskId", "timestamp"),
    "kimi-code-cli": ("hook_event_name", "session_id", "cwd", "tool_call_id", "timestamp"),
    "kilo-code": ("hook_event_name", "sessionID", "callID", "directory", "timestamp"),
    "antigravity": ("hook_event_name", "conversationId", "timestamp"),
    "opencode": ("hook_event_name", "sessionID", "callID", "directory", "timestamp"),
}

def safe_path(path):
    # Allow macOS's fixed system aliases, never producer-controlled redirects.
    for parent in [path, *path.parents]:
        if parent.is_symlink() and not (sys.platform == "darwin" and str(parent) in ("/var", "/tmp", "/etc") and str(parent.resolve()) == "/private" + str(parent)):
            raise ValueError("producer_symlink_refused")
    return path


def sync_dir(directory):
    if os.name != "nt":
        fd = os.open(directory, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def durable_file(path, data):
    safe_path(path)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb", closefd=False) as output:
            output.write(data)
            output.flush()
            os.fsync(fd)
    finally:
        os.close(fd)
    sync_dir(path.parent)


def sanitize(adapter, raw):
    if adapter not in FIELDS or not isinstance(raw, dict):
        raise ValueError("producer_contract_unknown")
    metadata = {}
    for key in FIELDS[adapter]:
        if key in raw:
            if not isinstance(raw[key], str) or len(raw[key]) > 4096:
                raise ValueError("producer_metadata_invalid")
            metadata[key] = raw[key]
    for key in ("workspace_roots", "workspaceRoots"):
        if key in raw and adapter in ("cursor", "cline"):
            if not isinstance(raw[key], list) or any(not isinstance(v, str) or len(v) > 4096 for v in raw[key]):
                raise ValueError("producer_metadata_invalid")
            metadata[key] = raw[key]
    if adapter == "cline" and isinstance(raw.get("postToolUse"), dict) and isinstance(raw["postToolUse"].get("success"), bool):
        metadata["postToolUse"] = {"success": raw["postToolUse"]["success"]}
    if adapter == "antigravity":
        if "workspacePaths" in raw:
            roots = raw["workspacePaths"]
            if not isinstance(roots, list) or any(not isinstance(v, str) or len(v) > 4096 for v in roots): raise ValueError("producer_metadata_invalid")
            metadata["workspacePaths"] = roots
        for key in ("stepIdx", "invocationNum", "executionNum"):
            if key in raw:
                if type(raw[key]) is not int or not 0 <= raw[key] <= 9007199254740991: raise ValueError("producer_metadata_invalid")
                metadata[key] = raw[key]
        if "fullyIdle" in raw:
            if not isinstance(raw["fullyIdle"], bool): raise ValueError("producer_metadata_invalid")
            metadata["fullyIdle"] = raw["fullyIdle"]
        metadata["failed"] = bool(raw.get("error"))
    if adapter == "cline" and isinstance(metadata.get("timestamp"),str) and metadata["timestamp"].isdigit():
        # Cline v4 sends milliseconds since epoch as a string. Preserve that
        # instant, and let context use it instead of today's branch on replay.
        metadata["timestamp"] = datetime.fromtimestamp(int(metadata["timestamp"])/1000,timezone.utc).isoformat().replace("+00:00","Z")
    return metadata


def retain(profile, raw, home):
    if profile.get("schema_version") != 1 or profile.get("adapter_id") not in FIELDS or profile.get("execution_surface") not in ("cli", "ide", "desktop", "inline"):
        raise ValueError("producer_profile_invalid")
    scope = profile.get("scope_id", "")
    if len(scope) != 64 or any(c not in "0123456789abcdef" for c in scope):
        raise ValueError("producer_scope_unconfirmed")
    runtime_path = safe_path(home / ".wakaclock/runtime-desired.json")
    if runtime_path.exists():
        runtime = json.loads(runtime_path.read_text())
        if runtime.get("schema_version") != 1 or not isinstance(runtime.get("desired"), dict):
            raise ValueError("producer_runtime_unconfirmed")
        if runtime["desired"].get("capture") is False:
            return None
    metadata = sanitize(profile["adapter_id"], raw)
    observed = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    # Native timestamp is immutable on retries; a missing timestamp is observed
    # once before disk acceptance, never reconstructed during replay.
    identity = str(uuid.uuid4())
    record = {"schema_version": 1, "scope_id": scope, "adapter_id": profile["adapter_id"],
              "execution_surface": profile["execution_surface"], "observation_id": identity,
              "observed_at": observed, "metadata": metadata}
    encoded = json.dumps(record, separators=(",", ":")).encode()
    directory = safe_path(home / ".wakaclock/native-producer-spool" / scope)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    safe_path(directory)
    # Persist newly created scope/root directory entries as well as file bytes.
    for parent in (directory.parent, directory.parent.parent, home):
        sync_dir(parent)
    file = directory / (identity + ".json")
    spec = importlib.util.spec_from_file_location('context_producer', Path(__file__).with_name('context-producer.py'))
    context = importlib.util.module_from_spec(spec); spec.loader.exec_module(context)
    context.retain(record, metadata, home, __import__("types").SimpleNamespace(safe_path=safe_path, durable_file=durable_file, sync_dir=sync_dir))
    durable_file(file, encoded)
    return file, record


def run(profile, raw, home):
    retained = retain(profile, raw, home)
    if retained is None:
        return "paused_by_user"
    file, record = retained
    try:
        result = subprocess.run([profile["cli_path"], "ai", "activity-hook", "--adapter", profile["adapter_id"],
                                 "--surface", profile["execution_surface"], "--scope-id", profile["scope_id"],
                                 "--observation-id", record["observation_id"], "--observed-at", record["observed_at"]],
                                input=json.dumps(record["metadata"]).encode(), stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=8, check=False)
        if len(result.stdout) > 16384:
            return "handoff_pending"
        ack = json.loads(result.stdout).get("acknowledgement", {})
        # The collector validates/replays the exact retained identity. Immediate
        # stdout alone cannot safely prove marker equivalence here, so it never
        # deletes the spool; its durable inbox receipt is checked by the worker.
        if result.returncode == 0 and ack.get("durable") is True and ack.get("status") in ("accepted", "duplicate"):
            return "handoff_observed"
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return "handoff_pending"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True)
    parser.add_argument("--event", choices=["PostToolUse", "PostInvocation", "Stop"])
    args = parser.parse_args()
    adapter = None
    try:
        profile = json.loads(safe_path(Path(args.profile)).read_text())
        adapter = profile.get("adapter_id")
        raw = sys.stdin.buffer.read(2 * 1024 * 1024 + 1)
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError("producer_input_too_large")
        payload = json.loads(raw)
        if args.event:
            if adapter != "antigravity": raise ValueError("producer_event_override_refused")
            payload["hook_event_name"] = args.event
        status = run(profile, payload, Path.home())
        if status == "handoff_pending":
            print("AtoAxis: activity_handoff_pending", file=sys.stderr)
    except Exception:
        print("AtoAxis: activity_capture_unconfirmed", file=sys.stderr)
    print(json.dumps({"cancel": False} if adapter == "cline" else {}))

if __name__ == "__main__":
    main()
