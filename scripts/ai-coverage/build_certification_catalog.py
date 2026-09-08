#!/usr/bin/env python3
"""Build the reviewed, server-readable certification catalog.

Historical imports are deliberately represented as non-promoting entries.  A
future live run may add a complete ``approved`` entry only after a reviewer has
checked the v2 artifact and its exact runtime tuple.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def entry(path: Path, record: dict[str, Any]) -> dict[str, Any]:
    unknown = "historical-unknown"
    return {
        "certificate_id": record["certificate_id"],
        # The v1 artifact used `unverified`; the typed runtime enum calls the
        # same fail-closed state `unsupported`.  Keep that conversion explicit
        # in the historical catalog rather than silently widening the enum.
        "status": "unsupported" if record["status"] == "unverified" else record["status"],
        "review_status": "historical",
        "promotable": False,
        "tuple": {
            "adapter_id": record["adapter_id"],
            "client_id": record["client_id"],
            "provider_id": record["provider_id"],
            "model_id": record.get("model_id"),
            "tool_version": record.get("tool_version"),
            "producer_version": record.get("producer_version"),
            "runtime": None,
            "os": None,
            "arch": None,
            "edit_modes": [unknown],
            "payload_schema_versions": [unknown],
            "contract_version": record["contract_version"],
            "fingerprint_version": record["fingerprint_version"],
            "corpus_version": None,
        },
        "evidence_kind": "historical",
        "checked_at_utc": record["completed_at_utc"],
        "expires_at_utc": record["expires_at_utc"],
        "artifact_sha256": digest(path),
        "evidence_digest": record.get("evidence_digest"),
        "build_sha256": None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--catalog-version", default="2026-09-06.1")
    args = parser.parse_args()
    paths = [args.source] if args.source.is_file() else sorted(args.source.glob("*.json"))
    entries = []
    for path in paths:
        record = json.loads(path.read_text(encoding="utf-8"))
        entries.append(entry(path, record))
    catalog = {
        "schema_version": 1,
        "catalog_version": args.catalog_version,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "entries": entries,
        "revocations": [],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
