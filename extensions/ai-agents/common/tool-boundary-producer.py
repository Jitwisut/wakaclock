#!/usr/bin/env python3
"""Freeze allowlisted tool evidence locally. No CLI or network before fsync.

This projection mirrors tool_snapshot.rs; replay only consumes these fingerprints
and numstat counters, never current source, Git state, command text or output.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import uuid
from datetime import datetime, timezone

# Installed helpers are immutable, installer-owned artifacts. Runtime bytecode
# would invalidate their ownership inventory and block safe upgrades/uninstall.
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("boundary_common", Path(__file__).with_name("activity-producer.py"))
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)
MAX_FILES = 20_000
MAX_METADATA = 8 * 1024 * 1024
EXCLUDED = {".git", ".hg", ".svn", "node_modules", "target", ".next", "dist", "build", "coverage", "vendor", ".cache", ".turbo"}
FIELDS = {"tool_event_id", "agent", "provider", "model", "session_id", "tool", "transport", "workspace_root", "cwd"}


def git(root, *args, optional=False):
    try:
        result = subprocess.run(["git", "-C", str(root), *args], stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=15, check=False)
        if result.returncode == 0:
            return result.stdout
    except (OSError, subprocess.TimeoutExpired):
        pass
    if optional:
        return None
    raise ValueError("tool_boundary_git_failed")


def relative(raw):
    value = raw.decode("utf-8", errors="strict").replace("\\", "/")
    if not value or Path(value).is_absolute() or ".." in Path(value).parts:
        raise ValueError("tool_boundary_path_invalid")
    return value


def fingerprint(path):
    # O_NOFOLLOW closes the final-component race; ancestors must also be safe.
    common.safe_path(path)
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        first = os.fstat(fd)
        if not stat.S_ISREG(first.st_mode):
            raise ValueError("tool_boundary_file_invalid")
        digest, newlines, last, binary = hashlib.sha256(), 0, b"", False
        with os.fdopen(fd, "rb", closefd=False) as stream:
            while chunk := stream.read(65536):
                digest.update(chunk)
                newlines = min(4294967295, newlines + chunk.count(b"\n"))
                binary |= b"\0" in chunk
                last = chunk[-1:]
        final = os.fstat(fd)
        if (first.st_size, first.st_mtime_ns, first.st_ino) != (final.st_size, final.st_mtime_ns, final.st_ino):
            raise ValueError("tool_boundary_file_changed_during_scan")
        return {"size": first.st_size, "modified_ns": max(0, first.st_mtime_ns),
                "content_hash": digest.hexdigest(),
                "line_count": None if binary else min(4294967295, newlines + int(bool(last) and last != b"\n")),
                "tracked": False, "dirty_before": False}
    finally:
        os.close(fd)


def capture(input, observed, previous=None):
    observed_root = input.get("workspace_root") or input.get("cwd")
    if not observed_root:
        raise ValueError("tool_boundary_workspace_missing")
    requested = Path(observed_root)
    if not requested.is_absolute():
        requested = Path.cwd() / requested
    common.safe_path(requested)
    if not requested.is_dir():
        raise ValueError("tool_boundary_workspace_missing")
    if previous is not None:
        root = Path(previous["workspace_root"])
        discovered = b"existing-git" if previous["git_backed"] else None
    else:
        discovered = git(requested, "rev-parse", "--show-toplevel", optional=True)
        root = Path(discovered.decode().strip()) if discovered else requested
    common.safe_path(root)
    index, dirty = {}, set()
    if discovered:
        for record in git(root, "ls-files", "-s", "-z").split(b"\0"):
            if record:
                header, name = record.split(b"\t", 1)
                index[relative(name)] = header.split()[1].decode("ascii")
        records = [r for r in git(root, "status", "--porcelain=v1", "-z", "--untracked-files=normal").split(b"\0") if r]
        i = 0
        while i < len(records):
            record = records[i]
            if len(record) >= 4:
                dirty.add(relative(record[3:]))
                if b"R" in record[:2] or b"C" in record[:2]:
                    i += 1
                    if i < len(records):
                        dirty.add(relative(records[i]))
            i += 1
        candidates = sorted({relative(r) for r in git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z").split(b"\0") if r})
    else:
        candidates = []
        for directory, dirs, files in os.walk(root, followlinks=False, onerror=lambda _: (_ for _ in ()).throw(ValueError("tool_boundary_scan_failed"))):
            dirs[:] = [d for d in dirs if d not in EXCLUDED and not (Path(directory) / d).is_symlink()]
            for name in files:
                path = Path(directory) / name
                if not path.is_symlink() and path.is_file():
                    candidates.append(str(path.relative_to(root)).replace("\\", "/"))
                    if len(candidates) > MAX_FILES:
                        raise ValueError("tool_boundary_file_limit")
        candidates.sort()
    if len(candidates) > MAX_FILES:
        raise ValueError("tool_boundary_file_limit")
    files = {}
    for name in candidates:
        path = root / name
        # Skip symlinks just as the legacy Rust projection does, but never read
        # through a symlinked ancestor discovered in a tracked Git path.
        if path.is_symlink():
            continue
        common.safe_path(path)
        if not path.is_file():
            continue
        tracked, changed = name in index, name in dirty
        if discovered and tracked and not changed:
            value = {"size": 0, "modified_ns": 0, "content_hash": index[name], "line_count": None, "tracked": True, "dirty_before": False}
        else:
            value = fingerprint(path)
            if discovered:
                hashes = git(root, "hash-object", "--", name).decode("ascii").splitlines()
                if len(hashes) != 1:
                    raise ValueError("tool_boundary_git_hash_invalid")
                # Reject a file changing between byte counting and Git hashing.
                second = fingerprint(path)
                if second != value:
                    raise ValueError("tool_boundary_file_changed_during_scan")
                value["content_hash"] = hashes[0]
            value["tracked"], value["dirty_before"] = tracked, changed
        files[name] = value
    return {"tool_event_id": input["tool_event_id"], "agent": input["agent"],
            "provider": input.get("provider"), "model": input.get("model"),
            "session_id": input.get("session_id"), "tool": input.get("tool"),
            "transport": input.get("transport"), "workspace_root": str(root),
            "started_at": observed, "files": files, "git_backed": bool(discovered)}


def freeze_numstat(snapshot):
    if not snapshot["git_backed"]:
        return {}
    # Match the legacy per-path numstat semantics (including deleted/renamed
    # paths), but run only at the real after boundary. Invalid/failed counters
    # remain unavailable; no source/diff is ever stored.
    root = Path(snapshot["workspace_root"])
    names = git(root, "diff", "--name-only", "-z", "HEAD", optional=True)
    if names is None:
        return {}
    paths = {relative(row) for row in names.split(b"\0") if row}
    if len(paths) > MAX_FILES:
        raise ValueError("tool_boundary_file_limit")
    counters = {}
    for name in sorted(paths):
        raw = git(root, "diff", "--numstat", "HEAD", "--", name, optional=True)
        if not raw:
            continue
        parts = raw.splitlines()[0].split(b"\t")
        if len(parts) < 2:
            continue
        def number(value):
            return int(value) if value.isdigit() and int(value) <= 4294967295 else None
        counters[name] = {"added": number(parts[0]), "deleted": number(parts[1])}
    return counters


def retain(phase, input, surface, home):
    if phase not in ("before", "after", "abort") or not isinstance(input, dict) or set(input) - FIELDS:
        raise ValueError("tool_boundary_contract_invalid")
    if any(v is not None and (not isinstance(v, str) or len(v) > 4096 or v.startswith(("{", "[")) or any(ord(c) < 32 for c in v)) for v in input.values()):
        raise ValueError("tool_boundary_metadata_invalid")
    if not input.get("tool_event_id") or not input.get("agent") or surface not in ("cli", "ide", "desktop", "inline", "unknown"):
        raise ValueError("tool_boundary_identity_invalid")
    adapter = input["agent"]
    if any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in adapter):
        raise ValueError("tool_boundary_identity_invalid")
    base = common.safe_path(home / ".wakaclock")
    runtime = common.safe_path(base / "runtime-desired.json")
    if runtime.exists():
        state = json.loads(runtime.read_text())
        if state.get("schema_version") != 1 or not isinstance(state.get("desired"), dict):
            raise ValueError("producer_runtime_unconfirmed")
        if state["desired"].get("capture") is False:
            return None
    # Read the installer/cached proof only. An unavailable or different CLI must
    # not attach an observation to whichever account is online at replay time.
    binding = common.safe_path(base / "native-producer-bindings" / (adapter + "-" + surface + ".json"))
    scope = "unconfirmed"
    if binding.exists():
        value = json.loads(binding.read_text()).get("scope_id", "")
        if len(value) != 64 or any(c not in "0123456789abcdef" for c in value):
            raise ValueError("producer_scope_unconfirmed")
        scope = value
    identity = json.dumps([scope, adapter, surface, input.get("session_id") or None, input["tool_event_id"]], separators=(",", ":"), ensure_ascii=False).encode()
    cache_dir = common.safe_path(base / "tool-boundary-evidence" / scope)
    cache = common.safe_path(cache_dir / (hashlib.sha256(identity).hexdigest() + ".before.json"))
    previous = None
    if phase == "after" and cache.exists():
        if cache.stat().st_size > MAX_METADATA + 65536:
            raise ValueError("tool_boundary_cached_evidence_conflict")
        stored = json.loads(cache.read_text())
        encoded = json.dumps(stored["metadata"], sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()
        if stored.get("scope_id") != scope or stored.get("adapter_id") != adapter or stored.get("execution_surface") != surface or hashlib.sha256(encoded).hexdigest() != stored.get("payload_hash") or stored["metadata"].get("phase") != "before" or stored["metadata"]["input"].get("tool_event_id") != input["tool_event_id"] or stored["metadata"]["input"].get("session_id") != input.get("session_id"):
            raise ValueError("tool_boundary_cached_evidence_conflict")
        previous = stored["metadata"].get("snapshot")
    observed = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    snapshot, counters, error = None, {}, None
    try:
        if phase != "abort":
            snapshot = capture(input, observed, previous)
            if phase == "after":
                counters = freeze_numstat(snapshot)
    except (OSError, ValueError, UnicodeError):
        snapshot, counters, error = None, {}, "tool_boundary_measurement_unavailable"
    metadata = {"boundary_version": 1, "phase": phase, "input": input,
                "snapshot": snapshot, "numstat": counters, "measurement_error": error}
    encoded = json.dumps(metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()
    if len(encoded) > MAX_METADATA:
        # Keep the observation with explicit failed measurement, never truncate
        # a successful file map (which would manufacture deleted files).
        metadata.update(snapshot=None, numstat={}, measurement_error="tool_boundary_metadata_limit")
        encoded = json.dumps(metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    record = {"schema_version": 2, "scope_id": scope, "adapter_id": adapter,
              "execution_surface": surface, "observation_id": str(uuid.uuid4()),
              "observed_at": observed, "kind": "tool_boundary",
              "payload_hash": hashlib.sha256(encoded).hexdigest(), "metadata": metadata}
    directory = common.safe_path(base / "native-producer-spool" / scope)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    for parent in (directory.parent, base, home):
        common.sync_dir(parent)
    file = directory / (record["observation_id"] + ".json")
    # Atomic visibility: the worker never sees the file until its bytes have
    # reached disk. A failed rename/fsync is capture failure, not acceptance.
    stage = directory / (record["observation_id"] + ".boundary-stage")
    common.durable_file(stage, json.dumps(record, separators=(",", ":"), ensure_ascii=False).encode())
    os.replace(stage, file)
    common.sync_dir(directory)
    if phase == "before":
        cache_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        common.sync_dir(cache_dir.parent)
        common.sync_dir(base)
        # Before evidence is retained independently of spool ACK/removal; the
        # real after-hook needs its original root/mode, never a replay lookup.
        if not cache.exists():
            stage = cache_dir / (str(uuid.uuid4()) + ".before-stage")
            common.durable_file(stage, json.dumps(record, separators=(",", ":"), ensure_ascii=False).encode())
            # Hard-link is an atomic no-replace publish on both supported OSes.
            # A concurrent before/reused ID cannot silently replace the winner.
            try:
                os.link(stage, cache)
                common.sync_dir(cache_dir)
            except FileExistsError:
                pass
            finally:
                stage.unlink()
                common.sync_dir(cache_dir)
    return file, record


def run(phase, input, cli, surface, home):
    retained = retain(phase, input, surface, home)
    if retained is None:
        return "paused_by_user"
    _, record = retained
    if record["scope_id"] == "unconfirmed":
        return "producer_owner_unconfirmed"
    try:
        # Legacy CLI stays parked; exit 0 alone is never an acknowledgement.
        proof = subprocess.run([cli, "journal-scope"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=8, check=False)
        capabilities = json.loads(proof.stdout).get("capabilities", []) if proof.returncode == 0 and len(proof.stdout) < 16384 else []
        if "tool_boundary_durable_v1" not in capabilities:
            return "producer_cli_upgrade_required"
        result = subprocess.run([cli, "ai", "producer-batch", "--json"], input=json.dumps({"schema_version": 2, "records": [record]}, separators=(",", ":"), ensure_ascii=False).encode(), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=8, check=False)
        ack = json.loads(result.stdout) if result.returncode == 0 and len(result.stdout) < 16384 else {}
        result = next(iter(ack.get("results", [])), {})
        if result.get("status") in ("accepted", "duplicate") and result.get("durable") is True and result.get("id") == record["observation_id"] and result.get("payload_hash") == record["payload_hash"]:
            return "cli_durable_observed"
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return "handoff_pending"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=("before", "after", "abort"), required=True)
    parser.add_argument("--cli", required=True)
    parser.add_argument("--surface", default="cli")
    args = parser.parse_args()
    try:
        raw = sys.stdin.buffer.read(65537)
        if len(raw) > 65536:
            raise ValueError("producer_payload_too_large")
        status = run(args.phase, json.loads(raw), args.cli, args.surface, Path(os.environ.get("ATOAXIS_PRODUCER_HOME", str(Path.home()))))
        if status not in ("cli_durable_observed", "paused_by_user"):
            print("AtoAxis: " + status, file=sys.stderr)
    except Exception:
        print("AtoAxis: producer_capture_failure", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
