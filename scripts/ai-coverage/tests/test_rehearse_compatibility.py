#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rehearse_compatibility import rehearse  # noqa: E402


MATRIX = Path(__file__).resolve().parents[1] / "compatibility-matrix-v1.json"


class CompatibilityRehearsalTest(unittest.TestCase):
    def test_checked_in_matrix_is_blocked_without_previous_release_digest(self) -> None:
        report = rehearse(json.loads(MATRIX.read_text(encoding="utf-8")))
        self.assertEqual(report["status"], "blocked")
        self.assertEqual(report["summary"], {"passed": 12, "failed": 0, "blocked": 6})
        self.assertTrue(all("payload" not in case for case in report["cases"]))

    def test_local_downlevel_drops_only_topology_and_rejects_content(self) -> None:
        matrix = {
            "schema_version": 1,
            "matrix_id": "unit",
            "previous_baseline": {"commit": "a" * 40, "build_sha256": "b" * 64},
            "cases": [
                json.loads(json.dumps(json.loads(MATRIX.read_text(encoding="utf-8"))["cases"][3]))
            ],
        }
        report = rehearse(matrix)
        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["cases"][0]["reason"], "topology_stripped_content_rejected")

    def test_duplicate_case_ids_fail_closed(self) -> None:
        matrix = {"schema_version": 1, "matrix_id": "bad", "previous_baseline": {}, "cases": [
            {"id": "same", "boundary": "A", "mode": "synthetic", "operation": "dedup", "event_ids": [], "expected": "accepted_then_duplicate"},
            {"id": "same", "boundary": "A", "mode": "synthetic", "operation": "dedup", "event_ids": [], "expected": "accepted_then_duplicate"},
        ]}
        report = rehearse(matrix)
        self.assertEqual(report["status"], "failed")
        self.assertIn("duplicate", report["errors"][0])

    def test_report_writer_never_echoes_fixture_payload(self) -> None:
        matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
        report = rehearse(matrix)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.json"
            output.write_text(json.dumps(report), encoding="utf-8")
            rendered = output.read_text(encoding="utf-8")
            self.assertNotIn("must never be accepted", rendered)
            self.assertNotIn("/workspace/src/lib.rs", rendered)


if __name__ == "__main__":
    unittest.main()
