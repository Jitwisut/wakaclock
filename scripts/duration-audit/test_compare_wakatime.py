"""Regression tests for missing-data and comparison semantics."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

# Support both `python3 -m unittest test_compare_wakatime.py` from this directory
# and the repository-root invocation used by CI/local agents.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare_wakatime import _raw_activity_baseline, _seconds, _settle_window, _summary_days


class ComparisonTests(unittest.TestCase):
    def test_settle_window_is_optional_and_bounded(self):
        self.assertEqual(_settle_window(None), 0.0)
        self.assertEqual(_settle_window(" 2.5 "), 2.5)
        with self.assertRaises(ValueError):
            _settle_window("301")
        with self.assertRaises(ValueError):
            _settle_window("not-a-number")

    def test_missing_measurement_is_not_zero(self):
        for value in (None, True, "0", -1, float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                _seconds(value)

    def test_measured_zero_remains_zero(self):
        self.assertEqual(_seconds(0), 0)

    def test_comparison_never_uses_combined_total(self):
        payload = {"days": [{"date": "2026-09-12", "grand_total": {
            "total_seconds": 17000,
            "evidence": {"comparable_seconds": 15600},
        }}]}
        self.assertEqual(_summary_days(payload, comparable=True), {"2026-09-12": 15600})

    def test_old_server_is_unavailable_for_comparable_metric(self):
        with self.assertRaises(ValueError):
            _summary_days({"days": [{"date": "2026-09-12", "grand_total": {
                "total_seconds": 15600,
            }}]}, comparable=True)

    def test_zero_does_not_fall_back_to_other_total(self):
        self.assertEqual(_summary_days({"days": [{"date": "2026-09-12", "total_seconds": 50,
            "grand_total": {"total_seconds": 0}}]}), {"2026-09-12": 0})

    def test_raw_baseline_keeps_empty_day_unavailable_and_counts_gaps(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "hb.jsonl"
            path.write_text(
                "\n".join(
                    json.dumps(row)
                    for row in [
                        {"time": 1_000, "active_seconds": 30},
                        {"time": 1_100, "active_seconds": 0},
                        {"time": 1_500, "delivery_status": "pending"},
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            report = _raw_activity_baseline(path, "1970-01-01", "1970-01-01", "UTC")
        day = report["days"]["1970-01-01"]
        self.assertEqual(day["observed_heartbeats"], 3)
        self.assertEqual(day["measured_heartbeats"], 1)
        self.assertEqual(day["within_client_window_seconds"], 100)
        self.assertEqual(day["timeout_bridge_candidate_seconds"], 400)
        self.assertEqual(report["pending_or_failed_rows_reported_by_export"], 1)
        self.assertEqual(report["status"], "observed")

    def test_raw_baseline_does_not_treat_missing_export_as_zero(self):
        report = _raw_activity_baseline(
            Path("/tmp/does-not-exist-wakaclock-hb.jsonl"),
            "2026-09-12",
            "2026-09-12",
            "Asia/Bangkok",
        )
        self.assertEqual(report, {"status": "unavailable", "reason": "raw_export_missing"})


if __name__ == "__main__":
    unittest.main()
