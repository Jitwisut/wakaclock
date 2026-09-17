import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audit_measurement_repair import audit

class MeasurementRepairTests(unittest.TestCase):
    def setUp(self):
        self.row = {"ai_event_id": "event", "session_id": "session", "actor_type": "ai_verified",
                    "ai_lines_added": 0, "ai_lines_deleted": 0, "time": 10, "active_seconds": 2}
        self.fresh = {"event_id": "event", "session_id": "session", "lines_added": 0, "lines_deleted": None}

    def test_null_correction_is_dry_and_preserves_input(self):
        before = copy.deepcopy(self.row)
        report = audit([self.row], [self.fresh])
        self.assertEqual(report["changes"][0]["after"]["deleted"], None)
        self.assertFalse(report["applied"])
        self.assertEqual(self.row, before)
        self.assertNotIn("session", str(report["changes"]))

    def test_missing_event_is_not_failed_edit_proof(self):
        report = audit([self.row], [])
        self.assertEqual(report["counts"], {"source_unresolved": 1})
        self.assertEqual(report["changes"], [])

    def test_conflicting_or_multi_file_refs_remain_unresolved(self):
        conflict = {**self.fresh, "lines_deleted": 3}
        self.assertEqual(audit([self.row], [self.fresh, conflict])["counts"], {"ambiguous_reference": 1})
        self.assertEqual(audit([self.row, self.row], [self.fresh])["changes"], [])

    def test_session_scope_and_replay(self):
        self.fresh["session_id"] = "another"
        self.assertEqual(audit([self.row], [self.fresh])["changes"], [])
        self.fresh["session_id"] = "session"
        self.row["ai_lines_deleted"] = None
        self.assertEqual(audit([self.row], [self.fresh])["counts"], {"unchanged": 1})

    def test_does_not_promote_human(self):
        self.row["actor_type"] = "human"
        self.assertEqual(audit([self.row], [self.fresh])["counts"], {"non_ai_row": 1})
