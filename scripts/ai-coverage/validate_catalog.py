#!/usr/bin/env python3
"""Validate a certification catalog and all referenced v2 records."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

from validate_certification import validate_artifact

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_catalog(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        catalog: Any = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"invalid JSON: {error}"]
    if not isinstance(catalog, dict):
        return ["catalog must be a JSON object"]
    if catalog.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    entries = catalog.get("entries")
    if not isinstance(entries, list):
        return errors + ["entries must be a list"]
    ids: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append("entry must be an object")
            continue
        certificate_id = entry.get("certificate_id")
        if not isinstance(certificate_id, str) or certificate_id in ids:
            errors.append(f"duplicate or invalid certificate_id: {certificate_id!r}")
        elif certificate_id:
            ids.add(certificate_id)
        if entry.get("promotable") is True:
            if entry.get("review_status") != "approved" or entry.get("evidence_kind") != "live":
                errors.append(f"promotable entry is not approved live: {certificate_id}")
        artifact_ref = entry.get("artifact_ref")
        if artifact_ref is None:
            continue
        if not isinstance(artifact_ref, str) or artifact_ref.startswith(("/", "\\")) or ".." in Path(artifact_ref).parts:
            errors.append(f"unsafe artifact_ref: {certificate_id}")
            continue
        artifact_path = path.parent / artifact_ref
        if not artifact_path.is_file():
            errors.append(f"missing artifact_ref: {artifact_ref}")
            continue
        artifact_errors = validate_artifact(json.loads(artifact_path.read_text(encoding="utf-8")))
        errors.extend(f"{certificate_id}: {error}" for error in artifact_errors)
        expected_digest = entry.get("artifact_sha256")
        if not isinstance(expected_digest, str) or not SHA256_RE.fullmatch(expected_digest):
            errors.append(f"{certificate_id}: artifact_sha256 is invalid")
        elif digest(artifact_path) != expected_digest:
            errors.append(f"{certificate_id}: artifact_sha256 does not match artifact_ref")
    for revocation in catalog.get("revocations", []):
        if not isinstance(revocation, dict) or revocation.get("certificate_id") not in ids:
            errors.append("revocation references an unknown certificate")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    errors = validate_catalog(args.path)
    if errors:
        print("FAILED", file=sys.stderr)
        print("\n".join(f"  - {error}" for error in errors), file=sys.stderr)
        return 1
    print(f"{args.path}: passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
