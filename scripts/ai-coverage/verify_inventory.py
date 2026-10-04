#!/usr/bin/env python3
"""Check archived evidence integrity and freshness of current certificates.

Passing this check does not certify a runtime. Historical entries remain
non-promoting; --require-live additionally requires approved current evidence.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import sys

from validate_catalog import validate_catalog
from validate_certification import validate_artifact

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_ai_certification import verify_report

EXPECTED_ADAPTERS = {"codex", "claude-code", "kilo-code", "kimi-code-cli", "deep-code"}
TUPLE_FIELDS = ("adapter_id", "client_id", "provider_id", "model_id", "tool_version",
                "producer_version", "runtime", "os", "arch", "edit_modes",
                "payload_schema_versions", "contract_version", "fingerprint_version", "corpus_version")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_inventory(root: Path, require_live=()):
    errors = validate_catalog(root / "catalog-v1.json")
    live = set()
    represented = set()
    archived = {}
    try:
        catalog = json.loads((root / "catalog-v1.json").read_text())
        for entry in catalog["entries"]:
            ref = entry.get("artifact_ref")
            if not isinstance(ref, str):
                errors.append("catalog entry requires artifact_ref")
                continue
            path = (root / ref).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file():
                errors.append("artifact reference missing or outside inventory")
                continue
            artifact = json.loads(path.read_text())
            adapter = artifact["adapter_id"]
            represented.add(adapter)
            errors.extend(validate_artifact(artifact))
            for key in ("status", "review_status", "promotable", "evidence_kind",
                        "expires_at_utc", "build_sha256", "evidence_digest", "certificate_id"):
                expected = artifact.get(key)
                if key == "status" and expected == "unverified":
                    expected = "unsupported"
                if entry.get(key) != expected:
                    errors.append(f"catalog/artifact mismatch: {adapter}:{key}")
            if entry.get("checked_at_utc") != artifact["completed_at_utc"]:
                errors.append(f"catalog/artifact mismatch: {adapter}:checked_at_utc")
            for key in TUPLE_FIELDS:
                expected = artifact.get(key)
                if (artifact["artifact_kind"] == "historical_adapter_evidence"
                        and key in ("edit_modes", "payload_schema_versions") and expected == []):
                    expected = ["historical-unknown"]
                if entry.get("tuple", {}).get(key) != expected:
                    errors.append(f"catalog/artifact tuple mismatch: {adapter}:{key}")
            if artifact["artifact_kind"] == "historical_adapter_evidence":
                if (artifact["review_status"] != "historical"
                        or artifact["evidence_kind"] != "historical"
                        or artifact["promotable"] is not False):
                    errors.append("historical entry cannot represent current readiness")
                archived[artifact.get("legacy_artifact_sha256")] = adapter
            elif (artifact["status"] == "verified" and artifact["promotable"]
                  and artifact["review_status"] == "approved"
                  and artifact["evidence_kind"] == "live"):
                live.add(adapter)

        # The byte-for-byte original must still match the non-promoting import.
        # Validate originals as of their recorded check date only after proving
        # that archived identity. New/unlinked v1 files retain the normal expiry gate.
        found = set()
        for adapter in EXPECTED_ADAPTERS:
            for path in (root / adapter).glob("*.json"):
                raw = json.loads(path.read_text())
                fingerprint = digest(path)
                if raw.get("schema_version") != 1:
                    errors.extend(validate_artifact(raw))
                    continue
                if archived.get(fingerprint) == adapter:
                    found.add(fingerprint)
                    checked = dt.datetime.fromisoformat(raw["checked_at_utc"].replace("Z", "+00:00"))
                    errors.extend(verify_report(raw, now=checked))
                else:
                    errors.extend(verify_report(raw))
                    errors.append(f"unlinked legacy artifact: {adapter}")
        if set(archived) - found:
            errors.append("historical original missing or digest changed")
        if EXPECTED_ADAPTERS - represented:
            errors.append("required adapter missing from inventory")
        for adapter in require_live:
            if adapter not in live:
                errors.append(f"{adapter}: current approved live certification unavailable")
    except (OSError, ValueError, KeyError, TypeError) as error:
        errors.append(f"invalid inventory: {type(error).__name__}")
    return errors, {adapter: "verified" if adapter in live and not errors else "not_certified"
                    for adapter in sorted(EXPECTED_ADAPTERS)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--require-live", nargs="*", choices=sorted(EXPECTED_ADAPTERS), default=[])
    args = parser.parse_args()
    errors, current = verify_inventory(args.root, args.require_live)
    print(json.dumps({"integrity": "failed" if errors else "passed", "current": current,
                      "errors": errors, "runtime_readiness_established": False}))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
