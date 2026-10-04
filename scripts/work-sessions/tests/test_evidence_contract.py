import json
import io
from contextlib import redirect_stdout
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_manifest import file_digest
from checks import validate_report
from evidence_contract import REQUIRED
from observation import finish_record, readiness, rehearsal_blockers
from run_browser_checks import successful
from receipt_readback import digest_parts
from receipt_campaign import SCENARIOS


class EvidenceTests(unittest.TestCase):
    def test_readiness_without_manifest_reports_blocker_without_creating_a_window(self):
        import observation
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = io.StringIO()
            with patch.object(observation, 'ROOT', root), patch.object(sys, 'argv', [
                    'observation.py', 'check-ready', '--codex', 'missing', '--claude', 'missing', '--checks', 'missing']), redirect_stdout(output):
                observation.main()
            self.assertEqual(json.loads(output.getvalue()), {'ready': False,
                             'blockers': ['build_manifest_unavailable'], 'window_started': False})
            self.assertEqual(list(root.iterdir()), [])

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.evidence = self.root / 'evidence'
        self.evidence.mkdir()
        self.report = {'schema_version': 3, 'build_manifest_sha256': 'build', 'checks': {}}
        for gate, names in REQUIRED.items():
            rows = [{'scenario': name, 'status': 'passed', 'mismatches': []} for name in names]
            run = {'schema_version': 3, 'build_manifest_sha256': 'build', 'status': 'passed',
                   'evidence_kind': 'validation_run', 'scenarios': rows, 'mismatches': [],
                   'blockers': [], 'sample_count': 1, 'runner': 'test_runner', 'runner_sha256': 'a' * 64}
            if gate == 'release_checks':
                run['coverage'] = dict.fromkeys(('statements', 'branches', 'functions', 'lines'), 100)
            children = []
            if gate == 'capture_identity':
                for scenario, agent in (('codex_native', 'codex'), ('claude_native', 'claude-code')):
                    native = {**run, 'scenarios': [{'scenario': scenario, 'status': 'passed', 'mismatches': []}],
                              'native_campaign': {'schema_version': 2, 'agent': agent, 'evidence_kind': 'controlled_live',
                              'build_manifest_sha256': 'build', 'blockers': [], 'scenarios': [
                              {'scenario': s, 'status': 'passed', 'mismatches': [], 'stages': dict.fromkeys(
                                  ('native', 'fixture', 'capture', 'delivery', 'receipt', 'replay'), 'passed')} for s in SCENARIOS]}}
                    children.append(self.write(scenario + '.json', native))
                run = {**run, 'scenarios': [r for r in rows if not r['scenario'].endswith('_native')]}
            children.append(self.write(gate + '-run.json', run))
            proof = {**run, 'scenarios': rows, 'evidence_kind': 'validation_gate', 'gate': gate, 'children': children}
            ref = self.write(gate + '.json', proof)
            self.report['checks'][gate] = {'status': 'passed', 'reviewed': True,
                                           'evidence': ref['path'], 'sha256': ref['sha256']}

    def write(self, name, value):
        path = self.evidence / name
        path.write_text(json.dumps(value))
        return {'path': name, 'sha256': file_digest(path)}

    def replace_gate(self, gate, value):
        ref = self.write(gate + '.json', value)
        self.report['checks'][gate]['sha256'] = ref['sha256']

    def test_pass_requires_complete_reviewed_current_build_bundle(self):
        self.assertTrue(validate_report(self.report, 'build', self.root))
        self.assertFalse(validate_report(self.report, 'other', self.root))
        self.report['checks']['owner_scope']['reviewed'] = False
        self.assertFalse(validate_report(self.report, 'build', self.root))

    def test_gate_assembly_with_symlinked_lab_keeps_child_references_relative(self):
        import local_lab
        import evidence_contract
        alias = self.root / 'lab-alias'
        alias.symlink_to(self.root, target_is_directory=True)
        with patch.object(local_lab, 'ROOT', alias), patch('runtime_binding.preflight', return_value='build'), \
                patch.object(sys, 'argv', ['evidence_contract.py', '--gate', 'owner_scope',
                                          '--run', str(self.evidence / 'owner_scope-run.json')]), \
                redirect_stdout(io.StringIO()):
            evidence_contract.main()
        gate = json.loads((self.evidence / 'gates/owner_scope.json').read_text())
        self.assertEqual(gate['children'][0]['path'], 'owner_scope-run.json')
        self.assertEqual(gate['review_status'], 'pending')

    def test_check_writer_accepts_lab_alias_without_exporting_absolute_paths(self):
        import checks
        alias = self.root / 'lab-alias'
        alias.symlink_to(self.root, target_is_directory=True)
        (self.evidence / 'build-manifest.json').write_text('{}')
        with patch.object(checks, 'ROOT', alias), \
                patch.object(sys, 'argv', ['checks.py', '--check', 'owner_scope', '--status', 'blocked',
                                          '--evidence', str(self.evidence / 'owner_scope.json')]), \
                redirect_stdout(io.StringIO()):
            checks.main()
        report = json.loads((self.evidence / 'checks.json').read_text())
        self.assertEqual(report['checks']['owner_scope']['evidence'], 'owner_scope.json')
        self.assertEqual(report['checks']['owner_scope']['status'], 'blocked')

    def test_empty_failed_old_and_missing_scenarios_cannot_pass_with_valid_hash(self):
        gate = 'owner_scope'
        original = json.loads((self.evidence / (gate + '.json')).read_text())
        for value in [{}, {**original, 'status': 'failed'}, {**original, 'build_manifest_sha256': 'old'},
                      {**original, 'scenarios': original['scenarios'][:-1]},
                      {**original, 'mismatches': ['owner_leak']}, {**original, 'children': []}]:
            with self.subTest(value=value):
                self.replace_gate(gate, value)
                self.assertFalse(validate_report(self.report, 'build', self.root))

    def test_child_hash_and_contents_are_both_validated(self):
        gate = 'time_union'
        proof = json.loads((self.evidence / (gate + '.json')).read_text())
        name = gate + '-run.json'
        child = json.loads((self.evidence / name).read_text())
        for changes in [{'status': 'failed'}, {'build_manifest_sha256': 'old'},
                        {'sample_count': 0}, {'scenarios': []}, {'schema_version': 2}]:
            proof['children'] = [self.write(name, {**child, **changes})]
            self.replace_gate(gate, proof)
            self.assertFalse(validate_report(self.report, 'build', self.root))
        proof['children'] = [self.write(name, child)]
        self.replace_gate(gate, proof)
        (self.evidence / name).write_text('{}')
        self.assertFalse(validate_report(self.report, 'build', self.root))

    def test_external_path_duplicate_scenarios_and_coverage_shortfall_rejected(self):
        gate = 'release_checks'
        original = json.loads((self.evidence / (gate + '.json')).read_text())
        for changes in [{'children': [{'path': '../private.json', 'sha256': 'a' * 64}]},
                        {'scenarios': original['scenarios'] * 2},
                        {'coverage': {**original['coverage'], 'branches': 99.99}}]:
            self.replace_gate(gate, {**original, **changes})
            self.assertFalse(validate_report(self.report, 'build', self.root))


class ObservationTests(unittest.TestCase):
    def test_skipped_empty_retried_or_failed_browser_runs_cannot_pass(self):
        passed = {'status': 'expected', 'expectedStatus': 'passed', 'results': [{'status': 'passed'}]}
        report = {'suites': [{'specs': [{'tests': [passed, passed]}]}]}
        self.assertTrue(successful(report))
        for rows in [[], [passed], [passed, {**passed, 'status': 'skipped'}],
                     [passed, {**passed, 'results': [{'status': 'failed'}, {'status': 'passed'}]}]]:
            self.assertFalse(successful({'suites': [{'specs': [{'tests': rows}]}]}))

    def test_both_reviewed_rehearsals_must_match_current_build_and_account(self):
        rows = [{**self.finish(), 'agent': agent, 'evidence_kind': 'rehearsal'} for agent in ('codex', 'claude-code')]
        self.assertEqual(rehearsal_blockers(rows, 'build', 'owner'), [])
        self.assertEqual(len(rehearsal_blockers(rows, 'build', 'other')), 2)
        self.assertEqual(len(rehearsal_blockers(rows, 'old', 'owner')), 2)
        rows[0]['mismatches'] = ['missing_operation']
        self.assertEqual(rehearsal_blockers(rows, 'build', 'owner'), ['codex:daily_rehearsal_incomplete'])

    def setUp(self):
        self.current = datetime(2026, 10, 1, tzinfo=timezone.utc)
        self.record = {'agent': 'codex', 'started_at': (self.current - timedelta(seconds=10)).isoformat(),
                       'owner_reference': digest_parts(['observation-owner', 'owner']),
                       'build_manifest_sha256': 'build'}
        self.receipt = {'id': 'receipt', 'agent': 'codex', 'observed_window': {'start': self.current.timestamp() - 5},
                        'revision_fingerprint': 'revision', 'diagnostics': {'max_ingestion_lag_seconds': None},
                        'usage': {'input_tokens': {'coverage': {'status': 'unavailable'}}}}

    def finish(self, record=None, receipt=None, owner='owner', build='build'):
        return finish_record(record or self.record, receipt or self.receipt, 'receipt', owner, build,
                             True, [], self.current)

    def test_finish_pins_owner_agent_build_reference_and_new_session_timing(self):
        self.assertTrue(self.finish()['ground_truth_before_readback'])
        for kwargs in [{'owner': 'other'}, {'build': 'old'},
                       {'receipt': {**self.receipt, 'agent': 'claude-code'}},
                       {'receipt': {**self.receipt, 'id': 'other'}},
                       {'receipt': {**self.receipt, 'observed_window': {'start': self.current.timestamp() - 20}}},
                       {'receipt': {**self.receipt, 'observed_window': {'start': self.current.timestamp() + 1}}},
                       {'record': self.finish()}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.finish(**kwargs)

    def test_rehearsal_unfinished_and_resumed_sessions_do_not_inflate_counts(self):
        window = {'started_at': (self.current - timedelta(days=8)).isoformat(), 'build_manifest_sha256': 'build'}
        row = {**self.finish(), 'evidence_kind': 'daily_work'}
        rows = [row, row, {**row, 'evidence_kind': 'rehearsal', 'receipt_id': 'rehearsal'},
                {**row, 'finished_at': None, 'receipt_id': 'unfinished'}]
        self.assertEqual(readiness(rows, window, 'build', self.current)['reviewed_daily_sessions']['codex'], 1)


if __name__ == '__main__':
    unittest.main()
