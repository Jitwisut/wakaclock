#!/usr/bin/env python3
"""Import legacy v1 certification records as non-promoting historical evidence.

The importer preserves only metadata that existed in the legacy artifact.  It
does not invent an OS, architecture, runtime, edit mode, corpus, or build
digest.  Every output is explicitly marked ``historical`` and ``promotable``
false, so it cannot become a server-side Verified record.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path
from typing import Any

ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
SHA1_RE = re.compile(r"^[0-9a-f]{40}$")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def optional_text(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip() or value in {"not-recorded", "scaffold", "manifest-only"}:
        return None
    return value.strip()


def safe_id(value: str, field: str) -> str:
    value = value.strip().lower()
    if not ID_RE.fullmatch(value):
        raise ValueError(f"{field} is not a bounded identifier: {value!r}")
    return value


def timestamp(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} is missing")
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError(f"{field} must include timezone")
    return parsed.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def import_record(source: Path, output_root: Path) -> Path:
    raw = source.read_bytes()
    record = json.loads(raw)
    client_id = safe_id(record["client_id"], "client_id")
    checked_at = timestamp(record["checked_at_utc"], "checked_at_utc")
    expires_at = timestamp(record["expires_at_utc"], "expires_at_utc")
    source_name = source.stem
    certificate_id = safe_id(f"{client_id}-historical-{source_name}", "certificate_id")
    tested_commit = record.get("tested_commit_sha")
    if not isinstance(tested_commit, str) or not SHA1_RE.fullmatch(tested_commit):
        tested_commit = None
    old_blockers = [item for item in record.get("blockers", []) if isinstance(item, str)]
    blockers = ["legacy v1 evidence has no complete certification runtime tuple", *old_blockers]
    artifact = {
        "artifact_kind": "historical_adapter_evidence",
        "schema_version": 2,
        "certificate_id": certificate_id,
        "status": record.get("status", "unverified"),
        "review_status": "historical",
        "promotable": False,
        "adapter_id": client_id,
        "client_id": client_id,
        "provider_id": safe_id(record.get("provider_id", "unknown"), "provider_id"),
        "model_id": optional_text(record.get("model_id")),
        "tool_version": optional_text(record.get("client_version")),
        "producer_version": optional_text(record.get("plugin_version")),
        "runtime": None,
        "os": None,
        "arch": None,
        "edit_modes": [],
        "payload_schema_versions": [],
        "contract_version": safe_id(record.get("contract_version", "producer-v1"), "contract_version"),
        "fingerprint_version": safe_id(record.get("fingerprint_version", "caf1"), "fingerprint_version"),
        "corpus_version": None,
        "tested_commit_sha": tested_commit,
        "build_sha256": None,
        "started_at_utc": checked_at,
        "completed_at_utc": checked_at,
        "expires_at_utc": expires_at,
        "evidence_kind": "historical",
        "evidence_digest": digest(source),
        "legacy_artifact_sha256": digest(source),
        "stages": [{"id": "historical_import", "status": "passed"}],
        "scenarios": [{"id": "legacy-record", "status": "not_run"}],
        "metrics": {
            "captured": int(record.get("captured_events", 0)),
            "producer_events": int(record.get("captured_events", 0)),
            "broker_accepted": int(record.get("correlated_events", 0)),
            "canonical": int(record.get("canonical_activities", 0)),
            "delivered": int(record.get("delivered_events", 0)),
            "duplicates": int(record.get("duplicate_events", 0)),
            "replayed": int(record.get("replayed_events", 0)),
        },
        "blockers": blockers,
        "limitations": ["historical v1 record is retained for audit and cannot promote an adapter"],
    }
    output = output_root / f"{client_id}-{source_name}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("certifications/ai-adapters/historical"))
    args = parser.parse_args()
    paths = (
        [args.source]
        if args.source.is_file()
        else sorted(
            path
            for path in args.source.rglob("*.json")
            if path.parent.name != "historical" and path.name != "catalog-v1.json"
        )
    )
    if not paths:
        parser.error(f"no JSON artifacts found under {args.source}")
    for source in paths:
        print(import_record(source, args.output_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
