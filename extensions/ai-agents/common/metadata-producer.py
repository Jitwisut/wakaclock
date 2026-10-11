#!/usr/bin/env python3
"""Shared legacy bridge: allowlisted metadata is retained before CLI invocation."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid
sys.dont_write_bytecode = True
from datetime import datetime, timezone

spec = importlib.util.spec_from_file_location("activity_producer", Path(__file__).with_name("activity-producer.py"))
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)
FILE_FIELDS = {"schema_version", "producer_version", "event_type", "event_id", "occurred_at", "entity", "project_root", "change_kind", "previous_entity", "agent", "provider", "model", "session_id", "source", "confidence", "lines_added", "lines_deleted", "active_seconds", "transport", "tool", "tool_event_id", "editor", "producer_surface", "content_fingerprint"}
SESSION_FIELDS = {"session_id", "agent", "provider", "model", "cwd", "source", "occurred_at"}
TOOL_FIELDS = {"tool_event_id", "agent", "provider", "model", "session_id", "tool", "transport", "workspace_root", "cwd"}
KINDS = ("file_mutation", "session_start", "session_end", "tool_before", "tool_after", "tool_abort")

def retain(kind, metadata, cli, surface, home, scope_hint=None):
    observed = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    allowed = FILE_FIELDS if kind == "file_mutation" else SESSION_FIELDS if kind.startswith("session_") else TOOL_FIELDS
    if kind not in KINDS or not isinstance(metadata, dict) or any(k not in allowed or not (v is None or type(v) in (str, int, float)) or isinstance(v, str) and (len(v) > 4096 or v.startswith(("{", "["))) for k,v in metadata.items()):
        raise ValueError("producer_metadata_invalid")
    metadata = dict(metadata)
    if kind.startswith("session_") and metadata.get("occurred_at") is None: metadata["occurred_at"] = observed
    adapter = metadata.get("agent")
    if not isinstance(adapter, str) or not adapter or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in adapter) or surface not in ("cli", "ide", "desktop", "inline", "unknown"):
        raise ValueError("producer_identity_invalid")
    base = common.safe_path(home / ".wakaclock")
    runtime_path = common.safe_path(base / "runtime-desired.json")
    if runtime_path.exists():
        state = json.loads(runtime_path.read_text())
        if state.get("schema_version") != 1 or not isinstance(state.get("desired"), dict): raise ValueError("producer_runtime_unconfirmed")
        if state["desired"].get("capture") is False: return None
    context_spec = importlib.util.spec_from_file_location('context_producer', Path(__file__).with_name('context-producer.py'))
    context = importlib.util.module_from_spec(context_spec); context_spec.loader.exec_module(context)
    frozen_context = context.freeze(adapter,metadata,metadata.get('occurred_at') or observed)
    bindings = common.safe_path(base / "native-producer-bindings")
    bindings.mkdir(parents=True, exist_ok=True, mode=0o700)
    binding = common.safe_path(bindings / (adapter + "-" + surface + ".json"))
    scope = None
    fixed = False
    if binding.exists():
        cached = json.loads(binding.read_text())
        value = cached.get("scope_id", "")
        if len(value) != 64 or any(c not in "0123456789abcdef" for c in value):
            raise ValueError("producer_scope_unconfirmed")
        scope, fixed = value, cached.get("owner_fixed") is True
    if not fixed:
        try:
            result = subprocess.run([cli, "journal-scope"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=8, check=False)
            proof = json.loads(result.stdout) if result.returncode == 0 and len(result.stdout) < 16384 else {}
            value = proof.get("scope_id", "")
            if proof.get("schema_version") == 1 and proof.get("owner_confirmed") is True and len(value) == 64 and all(c in "0123456789abcdef" for c in value):
                scope = value
                stage = bindings / (str(uuid.uuid4()) + ".metadata")
                common.durable_file(stage, json.dumps({"scope_id":scope}).encode())
                os.replace(stage, binding)
                common.sync_dir(bindings)
        except (OSError, ValueError, subprocess.TimeoutExpired): pass
    # An installer-owned profile always retains its original verified owner.
    # A changed CLI account must not silently reassign an old installed producer.
    if scope_hint is not None:
        if not isinstance(scope_hint, str) or len(scope_hint) != 64 or any(c not in "0123456789abcdef" for c in scope_hint): raise ValueError("producer_scope_unconfirmed")
        scope = scope_hint
    encoded = json.dumps(metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()
    record = {"schema_version":2,"scope_id":scope or "unconfirmed","adapter_id":adapter,"execution_surface":surface,"observation_id":str(uuid.uuid4()),"observed_at":observed,"kind":kind,"payload_hash":hashlib.sha256(encoded).hexdigest(),"metadata":metadata}
    root = common.safe_path(base / "native-producer-spool" / record["scope_id"])
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    for parent in (root.parent, base, home): common.sync_dir(parent)
    file = root / (record["observation_id"] + ".json")
    context.retain(record, metadata, home, common, frozen_context)
    common.durable_file(file, json.dumps(record, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode())
    return file, record

def run(kind, metadata, cli, surface, home):
    retained = retain(kind, metadata, cli, surface, home)
    if retained is None: return "paused_by_user"
    _, record = retained
    if record["scope_id"] == "unconfirmed": return "producer_owner_unconfirmed"
    try:
        result = subprocess.run([cli,"ai","producer-batch","--json"], input=json.dumps({"schema_version":2,"records":[record]},ensure_ascii=False,separators=(",",":")).encode(), stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=8,check=False)
        ack = json.loads(result.stdout) if result.returncode == 0 and len(result.stdout) < 16384 else {}
        proof = next(iter(ack.get("results", [])), {})
        if proof.get("status") in ("accepted","duplicate") and proof.get("durable") is True and proof.get("id") == record["observation_id"] and proof.get("payload_hash") == record["payload_hash"]: return "cli_durable_observed"
    except (OSError, ValueError, subprocess.TimeoutExpired): pass
    # Only the collector may remove the immutable observation after reconciliation.
    return "handoff_pending"

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--kind",choices=KINDS,required=True); parser.add_argument("--cli",required=True); parser.add_argument("--surface",default="cli")
    args=parser.parse_args()
    try:
        raw=sys.stdin.buffer.read(65537)
        if len(raw)>65536: raise ValueError("producer_payload_too_large")
        status=run(args.kind,json.loads(raw),args.cli,args.surface,Path(os.environ.get("ATOAXIS_PRODUCER_HOME", str(Path.home()))))
        if status not in ("cli_durable_observed","paused_by_user"): print("AtoAxis: " + status,file=sys.stderr)
    except Exception:
        print("AtoAxis: producer_capture_failure",file=sys.stderr); return 1
    return 0
if __name__=="__main__": sys.exit(main())
