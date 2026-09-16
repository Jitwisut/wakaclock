"""Regression tests for missing-data and comparison semantics."""
import json
import sys
import tempfile
import unittest
from unittest.mock import patch
import io
import urllib.parse
from pathlib import Path

# Support both `python3 -m unittest test_compare_wakatime.py` from this directory
# and the repository-root invocation used by CI/local agents.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare_wakatime import (_raw_activity_baseline, _seconds, _settle_window, _summary_days,
    _calculation_contract, _validate_wakatime_settings, _acceptance, _fetch)


class ComparisonTests(unittest.TestCase):
    def test_remote_request_pins_supported_preferences(self):
        with patch("compare_wakatime.urllib.request.urlopen", return_value=io.BytesIO(b"{}")) as request:
            _fetch("https://wakatime.com", "test-only", "2026-09-01", "2026-09-07", "Asia/Bangkok", timeout_minutes=15)
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(request.call_args.args[0].full_url).query)
        self.assertEqual(query["timeout"], ["15"])
        self.assertEqual(query["writes_only"], ["false"])
        self.assertEqual(query["timezone"], ["Asia/Bangkok"])

    def test_documented_response_need_not_echo_request_preferences(self):
        _validate_wakatime_settings({"data": [{"range": {"timezone": "UTC"},
            "grand_total": {"total_seconds": 60},
            "categories": [{"name": "Coding", "total_seconds": 60}]}]}, "UTC", 15)

    def test_duplicate_dates_and_unpartitioned_categories_are_rejected(self):
        row = {"date": "2026-09-12", "grand_total": {"total_seconds": 60}}
        with self.assertRaises(ValueError):
            _summary_days({"days": [row, row]})
        with self.assertRaises(ValueError):
            _validate_wakatime_settings({"timezone": "UTC", "timeout": 15,
                "writes_only": False, "data": [{**row, "categories": []}]}, "UTC", 15)

    def test_effective_server_settings_are_required(self):
        payload = {"calculation": {"timezone": "UTC", "timeout_seconds": 900,
            "writes_only": False, "scope": "all_projects_all_categories",
            "comparable_metric": "editor_ranges", "calculation_version": "combined_v2"}}
        self.assertEqual(_calculation_contract(payload, "UTC"), 15)
        with self.assertRaises(ValueError):
            _calculation_contract({}, "UTC")
        with self.assertRaises(ValueError):
            _calculation_contract(payload, "Asia/Bangkok")
        payload["calculation"]["timeout_seconds"] = 121
        with self.assertRaises(ValueError):
            _calculation_contract(payload, "UTC")

    def test_remote_scope_and_preferences_must_be_proven(self):
        payload = {"timezone": "UTC", "timeout": 15, "writes_only": False,
            "data": [{"grand_total": {"total_seconds": 60}, "categories": [{"name": "Coding", "total_seconds": 60}]}]}
        _validate_wakatime_settings(payload, "UTC", 15)
        with self.assertRaises(ValueError):
            _validate_wakatime_settings(payload, "UTC", 2)
        payload["data"][0]["categories"].append({"name": "AI Coding", "total_seconds": 10})
        with self.assertRaises(ValueError):
            _validate_wakatime_settings(payload, "UTC", 15)
        with self.assertRaises(ValueError):
            _validate_wakatime_settings({}, "UTC", 15)
        malformed = {"data": [{"range": "not-an-object", "grand_total": {
            "total_seconds": 60}, "categories": [{"name": "Coding", "total_seconds": 60}]}]}
        with self.assertRaises(ValueError):
            _validate_wakatime_settings(malformed, "UTC", 15)

    def test_empty_days_do_not_satisfy_live_observation_window(self):
        days = [{"status": "pass", "wakatime_seconds": 0, "wakaclock_seconds": 0} for _ in range(7)]
        self.assertFalse(_acceptance(days, [])["passed"])
        for day in days:
            day["wakatime_seconds"] = 60
            day["wakaclock_seconds"] = 60
        self.assertTrue(_acceptance(days, [])["passed"])
        days[-1]["status"] = "unavailable"
        self.assertFalse(_acceptance(days, [])["passed"])

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
