"""Fail-closed, build-bound validation evidence. Old reports remain historical only."""
import json
import argparse
import re
from pathlib import Path

from build_manifest import file_digest

REQUIRED = {
    'capture_identity': ('codex_native', 'claude_native', 'human_only', 'ai_only',
                         'human_after_ai', 'formatter', 'two_agents', 'live_editor', 'live_hook'),
    'retry_revision': ('offline_retry', 'duplicate', 'restart_resume', 'revision', 'repair_rollback'),
    'time_union': ('timezone', 'deterministic_union', 'idle', 'sleep_wake', 'missing_intervals'),
    'owner_scope': ('owner_mismatch', 'device_agent_isolation', 'cursor', 'scopes'),
    'account_deletion': ('request_worker_purge', 'outcome_history', 'delayed_replay'),
    'production_browser': ('desktop', 'mobile', 'evidence_over_25', 'outcome_withdrawal',
                           'export_snapshot_privacy', 'trust_link'),
    'flag_rollback': ('flag_disabled', 'telemetry_continues', 'restart_persistence'),
    'receipt_limits': ('facts_10000', 'facts_10001', 'operations_10000', 'operations_10001'),
    'release_checks': ('typecheck', 'lint', 'coverage', 'rust', 'python', 'extension',
                       'compatibility', 'production_build'),
}


def run_evidence(build_hash, runner_path, scenarios, sample_count=1, **details):
    """Called by a runner after executing checks, never to promote historical reports."""
    rows = [{'scenario': name, 'status': status, 'mismatches': [] if status == 'passed' else [name + '_not_passed']}
            for name, status in scenarios.items()]
    passed = bool(rows) and all(row['status'] == 'passed' for row in rows)
    return {**details, 'schema_version': 3, 'build_manifest_sha256': build_hash,
            'evidence_kind': 'validation_run', 'runner': Path(runner_path).stem,
            'runner_sha256': file_digest(Path(runner_path)), 'sample_count': sample_count,
            'scenarios': rows, 'status': 'passed' if passed else 'failed',
            'mismatches': [] if passed else ['run_checks_failed'], 'blockers': [],
            'review_status': 'pending', 'promotable': False}


def load_reference(reference, directory):
    if not isinstance(reference, dict) or not isinstance(reference.get('path'), str):
        raise ValueError('invalid_evidence_reference')
    path = (directory / reference['path']).resolve()
    if not path.is_relative_to(directory.resolve()) or not path.is_file():
        raise ValueError('evidence_path_outside_bundle_or_missing')
    if reference.get('sha256') != file_digest(path):
        raise ValueError('evidence_digest_mismatch')
    return path, json.loads(path.read_text())


def validate_node(report, build_hash, directory, ancestors=()):
    if not isinstance(report, dict) or report.get('schema_version') != 3:
        raise ValueError('evidence_schema_unsupported')
    if report.get('build_manifest_sha256') != build_hash:
        raise ValueError('evidence_build_mismatch')
    if report.get('status') != 'passed' or report.get('mismatches') != [] or report.get('blockers') != []:
        raise ValueError('evidence_not_passed')
    if report.get('evidence_kind') not in ('validation_gate', 'validation_run'):
        raise ValueError('evidence_kind_unsupported')
    rows = report.get('scenarios')
    if not isinstance(rows, list) or not rows:
        raise ValueError('evidence_scenarios_missing')
    names = []
    for row in rows:
        if (not isinstance(row, dict) or not isinstance(row.get('scenario'), str)
                or row.get('status') != 'passed' or row.get('mismatches') != []):
            raise ValueError('evidence_scenario_not_passed')
        names.append(row['scenario'])
    if len(set(names)) != len(names):
        raise ValueError('duplicate_evidence_scenario')
    children = report.get('children', [])
    if not isinstance(children, list):
        raise ValueError('invalid_evidence_children')
    child_names = set()
    for reference in children:
        path, child = load_reference(reference, directory)
        if path in ancestors or len(ancestors) >= 16:
            raise ValueError('cyclic_or_excessive_evidence_depth')
        child_names.update(validate_node(child, build_hash, directory, (*ancestors, path)))
    if report['evidence_kind'] == 'validation_gate':
        required = REQUIRED.get(report.get('gate'))
        if required is None or not set(required).issubset(names):
            raise ValueError('mandatory_scenarios_missing')
        if not set(required).issubset(child_names):
            raise ValueError('mandatory_run_evidence_missing')
    else:
        if not isinstance(report.get('runner'), str) or not report['runner']:
            raise ValueError('runner_missing')
        if not isinstance(report.get('runner_sha256'), str) or not re.fullmatch('[0-9a-f]{64}', report['runner_sha256']):
            raise ValueError('runner_digest_missing')
        if type(report.get('sample_count')) is not int or report['sample_count'] < 1:
            raise ValueError('no_executed_samples')
        for scenario, agent in (('codex_native', 'codex'), ('claude_native', 'claude-code')):
            if scenario in names:
                from observation import campaign_passed
                if not campaign_passed(report.get('native_campaign', {}), agent, build_hash):
                    raise ValueError('native_campaign_not_complete')
    if 'coverage' in names:
        coverage = report.get('coverage')
        if not isinstance(coverage, dict) or any(coverage.get(k) != 100 for k in ('statements', 'branches', 'functions', 'lines')):
            raise ValueError('coverage_threshold_not_met')
    return set(names)


def evidence_errors(reference, gate, build_hash, directory):
    try:
        path, report = load_reference(reference, Path(directory))
        if report.get('gate') != gate or report.get('evidence_kind') != 'validation_gate':
            raise ValueError('wrong_gate_evidence')
        validate_node(report, build_hash, Path(directory), (path,))
        return []
    except (ValueError, TypeError, KeyError, OSError, AttributeError) as error:
        return [str(error) if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError)
                else 'invalid_evidence_document']


def main():
    from local_lab import ROOT, private_json
    from runtime_binding import preflight
    parser = argparse.ArgumentParser(description='Assemble a gate from current validated run evidence.')
    parser.add_argument('--gate', choices=REQUIRED, required=True)
    parser.add_argument('--run', type=Path, action='append', required=True)
    args = parser.parse_args()
    build = preflight()
    directory = ROOT / 'evidence'
    children, names = [], set()
    coverage = None
    for path in args.run:
        path = path.resolve()
        if not path.is_relative_to(directory.resolve()):
            raise ValueError('evidence_must_be_local')
        value = json.loads(path.read_text())
        names.update(validate_node(value, build, directory, (path,)))
        children.append({'path': str(path.relative_to(directory)), 'sha256': file_digest(path)})
        if 'coverage' in value:
            coverage = value['coverage']
    if not set(REQUIRED[args.gate]).issubset(names):
        raise ValueError('mandatory_scenarios_missing')
    report = {'schema_version': 3, 'evidence_kind': 'validation_gate', 'gate': args.gate,
              'status': 'passed', 'build_manifest_sha256': build, 'mismatches': [], 'blockers': [],
              'scenarios': [{'scenario': name, 'status': 'passed', 'mismatches': []} for name in REQUIRED[args.gate]],
              'children': children, 'coverage': coverage, 'review_status': 'pending', 'promotable': False}
    validate_node(report, build, directory)
    private_json(directory / 'gates' / (args.gate + '.json'), report)
    print(json.dumps({'gate': args.gate, 'assembled': True, 'review_status': 'pending'}))


if __name__ == '__main__':
    main()
