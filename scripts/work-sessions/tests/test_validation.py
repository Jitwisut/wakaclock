import copy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_manifest import source_digest
from observation import campaign_passed, readiness
from receipt_campaign import SCENARIOS, deliver, native_failure_code, run
from receipt_readback import digest_parts, local_usage, loopback_url, measured, receipt_id, session_scope, verify
from runtime_binding import verify_process
from checks import NAMES, validate_report


class ReaderFixture:
    def __init__(self):
        self.user, self.collector = str(uuid.uuid4()), str(uuid.uuid4())
        self.session = session_scope(self.collector, 'codex', 'native-secret')
        self.records = [{'usage_event_id': 'usage-1', 'agent': 'codex', 'collector_id': self.collector,
                         'ai_session_id': self.session, 'input_tokens': 0, 'output_tokens': None}]
        self.facts = [{'usage_event_id': 'usage-1', 'input_tokens': '0', 'output_tokens': None,
                       'cache_read_tokens': None, 'cache_write_tokens': None,
                       'prompt_character_count': None, 'estimated_cost_microusd': None}]
        self.ops = [{'entity': '/private/source.rs', 'event': 'operation-1', 'change_id': '', 'heartbeat': 'hb-1', 'revision': 2}]
        self.rid = receipt_id(self.user, self.collector, 'codex', self.session)
        from receipt_readback import FIELDS
        self.receipt = {'id': self.rid, 'agent': 'codex', 'identity_status': 'scoped', 'usage_events': 1,
                        'usage': {output: measured([int(self.facts[0][field]) if self.facts[0][field] is not None else None]) for output, field in FIELDS.items()},
                        'evidence_count': 1, 'revision_fingerprint': 'a' * 64}
        self.evidence = {'operations': [{'event_id': digest_parts([self.user, self.session, 'operation-1', '/private/source.rs']), 'revision': 2}], 'has_more': False, 'next_cursor': None}

    def rows(self, query, **params):
        assert params['user'] == self.user
        assert params['session'] == self.session
        return self.facts if 'ai_usage_events' in query else self.ops

    def api_get(self, route):
        return self.evidence if '/evidence' in route else self.receipt


class ValidationTests(unittest.TestCase):
    def test_delivery_drains_backoff_without_model_retry_and_stops_on_auth_or_conflict(self):
        deferred = subprocess.CompletedProcess(['collector'], 0, json.dumps({
            'sent': False, 'deferred_reason': 'backoff', 'last_error': None}), '')
        sent = subprocess.CompletedProcess(['collector'], 0, '{"sent":true}', '')
        with patch('receipt_campaign.process', side_effect=[deferred, sent]) as call, patch('receipt_campaign.time.sleep'):
            self.assertEqual(deliver(['collector', 'sync'], Path('/tmp'), {}), (True, 2))
            self.assertEqual(call.call_count, 2)
            self.assertTrue(all(args.args[0] == ['collector', 'sync'] for args in call.call_args_list))
        for status in ({'deferred_reason': 'auth'}, {'deferred_reason': 'backoff', 'unresolved_conflicts': 1}):
            result = subprocess.CompletedProcess(['collector'], 0, json.dumps(status), '')
            with patch('receipt_campaign.process', return_value=result) as call:
                self.assertEqual(deliver(['collector','sync'],Path('/tmp'),{}), (False,1))
                self.assertEqual(call.call_count,1)

    def test_process_binding_rejects_stale_pid_old_build_and_disabled_receipts(self):
        data = {'server_sha256': 'binary'}
        row = {'service': 'api', 'pid': 12, 'process_identity': 'started',
               'build_manifest_sha256': 'build', 'artifact_sha256': 'binary', 'receipts_enabled': True}
        with patch('runtime_binding.process_identity', return_value='started'):
            verify_process(row, 'api', data, 'build')
            for changes in [{'stopped': True}, {'build_manifest_sha256': 'old'}, {'artifact_sha256': 'old'}, {'receipts_enabled': False}]:
                with self.assertRaises(ValueError):
                    verify_process({**row, **changes}, 'api', data, 'build')
        with patch('runtime_binding.process_identity', return_value='reused_pid'):
            with self.assertRaises(ValueError):
                verify_process(row, 'api', data, 'build')

    def test_checks_require_review_and_unchanged_evidence_for_same_build(self):
        from build_manifest import file_digest
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'evidence').mkdir()
            evidence = root / 'evidence/result.json'
            evidence.write_text('{}')
            report = {'schema_version': 2, 'build_manifest_sha256': 'build', 'checks': {
                name: {'status': 'passed', 'reviewed': True, 'evidence': 'result.json', 'sha256': file_digest(evidence)} for name in NAMES}}
            self.assertFalse(validate_report(report, 'build', root))
            self.assertFalse(validate_report(report, 'old', root))
            report['checks']['capture_identity']['reviewed'] = False
            self.assertFalse(validate_report(report, 'build', root))
            report['checks']['capture_identity']['reviewed'] = True
            evidence.write_text('{"changed":true}')
            self.assertFalse(validate_report(report, 'build', root))

    def test_missing_expected_native_operation_cannot_pass_readback(self):
        fixture = ReaderFixture()
        report = verify(fixture, fixture.user, fixture.records, {'operation-1', 'missing-operation'})
        self.assertIn('operation_capture_identity_mismatch', report['mismatches'])
        self.assertEqual(report['status'], 'failed')
    def test_vendor_failures_keep_only_classified_metadata(self):
        for output, expected in [
            ('{"error":{"codex_error_info":"usage_limit_exceeded"}}', 'native_usage_limit_exceeded'),
            ('You’ve hit your usage limit. private@example.com', 'native_usage_limit_exceeded'),
            ('Not logged in · Please run /login', 'native_authentication_failed'),
            ('unexpected private output', 'native_execution_failed'),
        ]:
            result = subprocess.CompletedProcess(['agent'], 1, output, '')
            self.assertEqual(native_failure_code(result), expected)

    def test_requires_loopback_origin_without_credentials(self):
        self.assertEqual(loopback_url('http://127.0.0.1:18080'), 'http://127.0.0.1:18080')
        for url in ['https://api.atoaxis.com', 'http://localhost:18080', 'http://secret@127.0.0.1', 'http://127.0.0.1/api']:
            with self.assertRaises(ValueError):
                loopback_url(url)

    def test_scoping_separates_agents_and_devices(self):
        self.assertNotEqual(session_scope('a', 'codex', 'n'), session_scope('b', 'codex', 'n'))
        self.assertNotEqual(session_scope('a', 'codex', 'n'), session_scope('a', 'claude-code', 'n'))

    def test_local_records_are_exact_scoped_and_legacy_is_excluded(self):
        fixture = ReaderFixture()
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            (home / '.wakaclock').mkdir()
            with sqlite3.connect(home / '.wakaclock/ai-attribution.sqlite3') as db:
                db.execute('CREATE TABLE delivered_usage(record_json TEXT)')
                for row in [fixture.records[0], {**fixture.records[0], 'collector_id': None}, {**fixture.records[0], 'ai_session_id': 'another'}]:
                    db.execute('INSERT INTO delivered_usage VALUES (?)', (json.dumps(row),))
            self.assertEqual(local_usage(home, 'codex', 'native-secret'), fixture.records)

    def test_exact_readback_checks_values_revisions_and_privacy(self):
        fixture = ReaderFixture()
        report = verify(fixture, fixture.user, fixture.records, {'operation-1'})
        self.assertEqual(report['status'], 'passed')
        self.assertNotIn('/private/', json.dumps(report))
        self.assertNotIn('native-secret', json.dumps(report))
        fixture.receipt['usage']['output_tokens']['value'] = 0
        fixture.evidence['operations'][0]['revision'] = 1
        report = verify(fixture, fixture.user, fixture.records)
        self.assertIn('output_tokens_mismatch', report['mismatches'])
        self.assertIn('canonical_evidence_mismatch', report['mismatches'])

    def test_extra_or_missing_usage_does_not_pass(self):
        fixture = ReaderFixture()
        fixture.facts.append({**fixture.facts[0], 'usage_event_id': 'other-session-event'})
        self.assertIn('usage_identity_or_count_mismatch', verify(fixture, fixture.user, fixture.records)['mismatches'])
        self.assertEqual(verify(fixture, fixture.user, [])['status'], 'failed')

    def test_mixed_identity_rejected_before_network(self):
        fixture = ReaderFixture()
        rows = [fixture.records[0], {**fixture.records[0], 'collector_id': str(uuid.uuid4())}]
        self.assertEqual(verify(None, fixture.user, rows)['mismatches'], ['mixed_local_session_identity'])

    def test_campaign_without_execute_never_runs_a_model(self):
        self.assertEqual(run('codex')['blockers'], ['campaign_not_enabled'])
        self.assertEqual(run('claude-code')['scenarios'], [])

    def test_smoke_campaign_cannot_start_seven_day_window(self):
        report = {'schema_version': 2, 'agent': 'codex', 'evidence_kind': 'controlled_live', 'build_manifest_sha256': 'build',
                  'scenarios': [{'scenario': s, 'status': 'passed', 'mismatches': [],
                  'stages': dict.fromkeys(('native', 'fixture', 'capture', 'delivery', 'receipt', 'replay'), 'passed')} for s in SCENARIOS]}
        self.assertTrue(campaign_passed(report, 'codex', 'build'))
        self.assertFalse(campaign_passed(report, 'claude-code', 'build'))
        self.assertFalse(campaign_passed(report, 'codex', 'other'))
        report['scenarios'].pop()
        self.assertFalse(campaign_passed(report, 'codex', 'build'))

    def test_duplicate_campaign_scenario_fails_without_model_retry(self):
        self.assertEqual(run('codex', selected=['single-file', 'single-file'])['blockers'],
                         ['campaign_preflight_failed'])

    def test_readiness_excludes_campaigns_duplicates_old_builds_and_unreviewed(self):
        current = datetime(2026, 9, 29, tzinfo=timezone.utc)
        start = current - timedelta(days=8)
        window = {'started_at': start.isoformat(), 'build_manifest_sha256': 'build'}
        row = {'agent': 'codex', 'evidence_kind': 'daily_work', 'reviewed': True,
               'build_manifest_sha256': 'build', 'receipt_id': 'session', 'started_at': start.isoformat(),
               'ground_truth_before_readback': True, 'mismatches': [], 'finished_at': current.isoformat()}
        report = readiness([row, row, {**row, 'receipt_id': 'synthetic', 'evidence_kind': 'controlled_live'},
                            {**row, 'receipt_id': 'old', 'build_manifest_sha256': 'old'},
                            {**row, 'receipt_id': 'unreviewed', 'reviewed': False}], window, 'build', current)
        self.assertEqual(report['reviewed_daily_sessions']['codex'], 1)
        self.assertFalse(report['ready_for_pilot_review'])
        self.assertFalse(readiness([], None, 'build', current)['promotable'])

    def test_seven_days_and_both_agents_required(self):
        current = datetime(2026, 9, 29, tzinfo=timezone.utc)
        start = current - timedelta(days=7)
        window = {'started_at': start.isoformat(), 'build_manifest_sha256': 'build'}
        rows = [{'agent': agent, 'evidence_kind': 'daily_work', 'reviewed': True, 'build_manifest_sha256': 'build',
                 'receipt_id': f'{agent}-{i}', 'started_at': start.isoformat(), 'ground_truth_before_readback': True, 'finished_at': current.isoformat()}
                for agent in ('codex', 'claude-code') for i in range(10)]
        self.assertTrue(readiness(rows, window, 'build', current)['ready_for_pilot_review'])
        self.assertFalse(readiness(rows, window, 'build', current - timedelta(seconds=1))['ready_for_pilot_review'])

    def test_source_hash_includes_new_files_and_deletions(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            subprocess.run(['git', 'init', '-q', str(repo)], check=True)
            (repo / 'tracked.txt').write_text('one')
            subprocess.run(['git', 'add', 'tracked.txt'], cwd=repo, check=True)
            before = source_digest(repo)
            (repo / 'new.txt').write_text('two')
            self.assertNotEqual(before, source_digest(repo))
            changed = source_digest(repo)
            (repo / 'tracked.txt').unlink()
            self.assertNotEqual(changed, source_digest(repo))


if __name__ == '__main__':
    unittest.main()
