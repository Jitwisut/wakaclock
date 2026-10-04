import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import Mock
import zipfile
import hashlib

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime_scenarios import check_capture, check_fixture, interval_reference, snapshot_queue, union_seconds, physical_intervals, check_attribution, verify_run
from editor_profile import package_metadata
from local_lab import API


class RuntimeTests(unittest.TestCase):
    def test_runtime_report_fails_malformed_intervals_without_exposing_private_capture(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            (workspace / 'fixture.txt').write_text('seed\nhuman\n')
            capture = {'heartbeat_id': 'private-id', 'revision': 0, 'actor_type': 'unknown',
                       'plugin': 'vscode', 'entity': str(workspace / 'fixture.txt')}
            reader = Mock()
            reader.rows.return_value = [capture]
            record = {'build_manifest_sha256': 'build', 'scenario': 'human_only',
                      'started_at': '2026-10-01T00:00:00+00:00', 'capture_mode': 'live_editor',
                      'events': [], 'captures': [capture], 'sessions': {}}
            report = verify_run(record, workspace, reader, {'user_id': 'owner'}, {}, 'build')
            self.assertEqual(report['status'], 'passed')
            self.assertNotIn('private-id', json.dumps(report))
            self.assertNotIn(str(workspace), json.dumps(report))
            record['events'] = [{'event': 'human_idle', 'timestamp': 1}]
            report = verify_run(record, workspace, reader, {'user_id': 'owner'}, {}, 'build')
            self.assertEqual(report['status'], 'failed')
            self.assertIn('interval_evidence_invalid', report['mismatches'])
            self.assertIsNone(report['interval_reference']['agent_seconds'])

    def test_ground_truth_rejects_consistent_but_wrong_attribution(self):
        ai = {'actor_type': 'ai_verified', 'ai_agent': 'codex', 'ai_event_id': 'op',
              'is_write': True, 'time': 10}
        human = {'actor_type': 'human', 'is_write': True, 'time': 20}
        unknown = {**human, 'actor_type': 'unknown'}
        self.assertIn('unexpected_ai_attribution', check_attribution('human_only', [ai], [])[0])
        self.assertIn('unexpected_ai_attribution', check_attribution('formatter', [ai], [])[0])
        self.assertIn('agent_operation_labeled_human', check_attribution('ai_only', [{**ai, 'actor_type': 'human'}], [])[0])
        self.assertEqual(check_attribution('human_only', [unknown], []), ([], []))
        self.assertEqual(check_attribution('ai_only', [ai], []), ([], []))
        self.assertIn('both_agents_attribution_required', check_attribution('two_agents', [ai], [])[1])
        events = [{'event': 'agent_stop', 'timestamp': 15}, {'event': 'human_active', 'timestamp': 18}]
        self.assertEqual(check_attribution('human_after_ai', [ai, human], events), ([], []))
        self.assertIn('human_followup_capture_required', check_attribution('human_after_ai', [ai], events)[1])
        self.assertIn('ordered_human_after_agent_markers_required', check_attribution('human_after_ai', [ai, human], [])[1])

    def test_physical_sleep_requires_real_segments_and_rejects_sleep_duration(self):
        events = [{'event': 'sleep', 'timestamp': 10}, {'event': 'wake', 'timestamp': 100}]
        row = {'heartbeat_id': 'h', 'activity_segments': [{'start': 0, 'end': 10, 'source': 'editor_active_v1'}]}
        self.assertEqual(physical_intervals([row], [row], events, 'sleep_wake'), ([], []))
        bad = {**row, 'activity_segments': [{'start': 0, 'end': 100, 'source': 'editor_active_v1'}]}
        self.assertIn('activity_crosses_observed_inactive_gap', physical_intervals([bad], [bad], events, 'sleep_wake')[0])
        self.assertEqual(physical_intervals([], [], events, 'sleep_wake')[1], ['live_editor_intervals_missing'])
        no_segments = {'heartbeat_id': 'h'}
        self.assertIn('canonical_activity_segments_mismatch', physical_intervals([no_segments], [row], events, 'sleep_wake')[0])
    def test_interval_union_overlap_and_missing_measurements(self):
        events = [{'event': event, 'timestamp': at} for event, at in
                  [('human_active', 0), ('agent_start', 10), ('human_idle', 15), ('agent_stop', 30)]]
        self.assertEqual({k: v for k, v in interval_reference(events).items() if k != 'basis'},
                         {'human_seconds': 15, 'agent_seconds': 20, 'combined_seconds': 30, 'overlap_seconds': 5})
        self.assertEqual(union_seconds([(0, 10), (5, 15), (30, 30)]), 15)
        for events in ([], [{'event': 'agent_start', 'timestamp': 1}]):
            value = interval_reference(events)
            self.assertIsNone(value['agent_seconds'])
            self.assertIsNone(value['overlap_seconds'])
        self.assertEqual(union_seconds([(1, 1)]), 0)

    def test_sleep_closes_activity_without_counting_the_sleep_gap(self):
        events = [{'event': event, 'timestamp': at} for event, at in
                  [('human_active', 0), ('sleep', 5), ('wake', 100), ('human_active', 110), ('human_idle', 115)]]
        self.assertEqual(interval_reference(events)['human_seconds'], 10)
        for events in [[{'event': 'human_idle', 'timestamp': 1}],
                       [{'event': 'human_active', 'timestamp': 2}, {'event': 'human_idle', 'timestamp': 1}],
                       [{'event': 'human_active', 'timestamp': float('nan')}]]:
            with self.assertRaises(ValueError):
                interval_reference(events)

    def test_capture_requires_exact_id_session_actor_revision_and_no_duplicate_winners(self):
        row = {'heartbeat_id': 'h', 'session_id': 'session', 'ai_agent': 'codex',
               'actor_type': 'ai_verified', 'identity_source': 'agent_hook', 'identity_status': 'confirmed', 'revision': 2}
        self.assertEqual(check_capture([row, {**row, 'revision': 1}], [row]), [])
        for remote in [[], [row, row], [{**row, 'session_id': 'other'}],
                       [{**row, 'revision': 1}], [{**row, 'actor_type': 'human'}]]:
            self.assertTrue(check_capture([row], remote))
        self.assertEqual(check_capture([], []), ['queue_capture_missing'])

    def test_queue_snapshot_reads_only_lab_destination_and_fixture(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            (home / '.wakaclock').mkdir()
            workspace = home / 'fixture'
            workspace.mkdir()
            with sqlite3.connect(home / '.wakaclock/queue.db') as db:
                db.execute('CREATE TABLE heartbeat_queue(payload TEXT, destination TEXT, retry_count INTEGER DEFAULT 0)')
                for destination, entity in [(API, workspace / 'fixture.txt'), ('https://production.invalid', workspace / 'fixture.txt'), (API, home / 'private.txt')]:
                    db.execute('INSERT INTO heartbeat_queue(payload,destination) VALUES (?,?)', (json.dumps({'entity': str(entity)}), destination))
            self.assertEqual(snapshot_queue(home, workspace), [{'entity': str(workspace / 'fixture.txt'), 'queue_retry_count': 0}])
            (workspace / 'fixture.txt').write_text('seed\nagent\n')
            self.assertTrue(check_fixture(workspace, 'ai_only'))
            (workspace / 'unexpected.txt').write_text('extra')
            self.assertFalse(check_fixture(workspace, 'ai_only'))

    def test_extension_package_requires_matching_collector_bytes_not_only_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'extension.vsix'
            digest = hashlib.sha256(b'collector').hexdigest()
            for binary in (b'collector', b'wrong'):
                with zipfile.ZipFile(path, 'w') as package:
                    package.writestr('extension/package.json', json.dumps({'publisher': 'atoaxis', 'name': 'atoaxis-vscode', 'version': 'test'}))
                    package.writestr('extension/resources/cli-manifest.json', json.dumps({'binary': 'wakaclock', 'sha256': digest}))
                    package.writestr('extension/resources/bin/wakaclock', binary)
                if binary == b'collector':
                    self.assertEqual(package_metadata(path, digest)['version'], 'test')
                else:
                    with self.assertRaises(ValueError):
                        package_metadata(path, digest)


if __name__ == '__main__':
    unittest.main()
