#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_certification import MANDATORY_STAGES, validate_artifact  # noqa: E402


NOW = dt.datetime(2026, 9, 6, tzinfo=dt.timezone.utc)


def artifact(**overrides: object) -> dict[str, object]:
    stages = [{"id": stage, "status": "passed"} for stage in MANDATORY_STAGES]
    value: dict[str, object] = {
        "artifact_kind": "adapter_certification",
        "schema_version": 2,
        "certificate_id": "codex-cli-2026-09-06",
        "status": "verified",
        "review_status": "approved",
        "promotable": True,
        "adapter_id": "codex",
        "client_id": "codex",
        "provider_id": "openai",
        "model_id": "gpt-5.6-sol",
        "tool_version": "0.151.0",
        "producer_version": "0.1.0",
        "runtime": "cli",
        "os": "darwin",
        "arch": "arm64",
        "edit_modes": ["native_single_file"],
        "payload_schema_versions": ["response_item"],
        "contract_version": "producer-v1",
        "fingerprint_version": "caf1",
        "corpus_version": "ground-truth-v1",
        "tested_commit_sha": "a" * 40,
        "build_sha256": "b" * 64,
        "started_at_utc": "2026-09-05T10:00:00Z",
        "completed_at_utc": "2026-09-05T10:10:00Z",
        "expires_at_utc": "2026-10-05T10:10:00Z",
        "evidence_kind": "live",
        "evidence_digest": "c" * 64,
        "stages": stages,
        "scenarios": [{"id": "native-single-file", "status": "passed"}],
        "metrics": {
            "captured": 2,
            "producer_events": 2,
            "broker_accepted": 2,
            "canonical": 1,
            "delivered": 1,
            "duplicates": 1,
            "replayed": 0,
        },
        "blockers": [],
        "limitations": [],
    }
    value.update(overrides)
    return value


class CertificationValidatorTest(unittest.TestCase):
    def test_complete_live_artifact_is_promotable(self) -> None:
        self.assertEqual(validate_artifact(artifact(), now=NOW), [])

    def test_fixture_cannot_promote(self) -> None:
        errors = validate_artifact(artifact(evidence_kind="fixture"), now=NOW)
        self.assertTrue(any("live evidence" in error for error in errors))

    def test_failed_stage_cannot_hide_in_promotable_artifact(self) -> None:
        value = artifact()
        value["stages"] = [{"id": stage, "status": "failed" if stage == "api_delivery" else "passed"} for stage in MANDATORY_STAGES]
        errors = validate_artifact(value, now=NOW)
        self.assertTrue(any("every mandatory stage" in error for error in errors))

    def test_privacy_and_unknown_fields_are_rejected(self) -> None:
        value = artifact()
        value["unexpected"] = True
        value["notes"] = "/Users/alice/project"
        errors = validate_artifact(value, now=NOW)
        self.assertTrue(any("unknown fields" in error for error in errors))
        self.assertTrue(any("path" in error for error in errors))

    def test_expiry_and_missing_tuple_are_rejected(self) -> None:
        value = artifact(expires_at_utc="2026-09-05T10:10:00Z", os=None)
        errors = validate_artifact(value, now=NOW)
        self.assertTrue(any("expired" in error for error in errors))
        self.assertTrue(any("complete runtime tuple" in error for error in errors))

    def test_historical_record_can_be_valid_without_promotion(self) -> None:
        value = artifact(
            artifact_kind="historical_adapter_evidence",
            status="verified",
            review_status="historical",
            promotable=False,
            evidence_kind="historical",
            tool_version=None,
            producer_version=None,
            runtime=None,
            os=None,
            arch=None,
            build_sha256=None,
            tested_commit_sha=None,
            evidence_digest="d" * 64,
            stages=[{"id": "historical_import", "status": "passed"}],
            scenarios=[{"id": "legacy-record", "status": "not_run"}],
            blockers=["runtime tuple was not recorded"],
            limitations=["historical evidence is not promotion input"],
        )
        self.assertEqual(validate_artifact(value, now=NOW), [])

    def test_stale_historical_record_remains_audit_evidence(self) -> None:
        value = artifact(
            artifact_kind="historical_adapter_evidence",
            review_status="historical",
            promotable=False,
            evidence_kind="historical",
            status="verified",
            completed_at_utc="2020-01-01T00:00:00Z",
            started_at_utc="2020-01-01T00:00:00Z",
            expires_at_utc="2020-02-01T00:00:00Z",
            tool_version=None,
            producer_version=None,
            runtime=None,
            os=None,
            arch=None,
            build_sha256=None,
            tested_commit_sha=None,
            evidence_digest="d" * 64,
            stages=[{"id": "historical_import", "status": "passed"}],
            scenarios=[{"id": "legacy-record", "status": "not_run"}],
            blockers=["tuple not recorded"],
            limitations=["audit only"],
        )
        self.assertEqual(validate_artifact(value, now=NOW), [])


if __name__ == "__main__":
    unittest.main()
