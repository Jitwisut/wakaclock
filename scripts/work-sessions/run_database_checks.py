#!/usr/bin/env python3
"""Run ignored integration checks only against the isolated receipt lab."""
import json
import re
import subprocess
import time
from datetime import datetime, timezone
from local_lab import ROOT, REPO, env, private_json
from build_manifest import source_digest
from runtime_binding import preflight
from evidence_contract import run_evidence


def main():
    build = preflight()
    values = env()
    values.update({'CLICKHOUSE_TEST_URL': values['CLICKHOUSE_URL'],
                   'CLICKHOUSE_TEST_USER': values['CLICKHOUSE_USER'],
                   'CLICKHOUSE_TEST_PASSWORD': values['CLICKHOUSE_PASSWORD'],
                   'POSTGRES_TEST_URL': values['POSTGRES_URL']})
    tests = (
        'timezone_queries_share_half_open_bounds_and_local_daily_buckets',
        'agents_query_deserializes_nullable_identity_status',
        'receipt_live_databases_isolate_sessions_replay_revisions_and_outcomes',
        'handlers::v2::work_sessions::tests::cursor_is_owner_filter_and_expiry_bound',
    )
    report = {'schema_version': 2, 'source_snapshot_sha256': source_digest(),
              'generated_at': datetime.now(timezone.utc).isoformat(), 'tests': []}
    for test in tests:
        began = time.monotonic()
        log_path = ROOT / (test + '.log')
        with log_path.open('w') as log:
            result = subprocess.run(['cargo', 'test', '--locked', '--offline', '--manifest-path',
                                     'backend/api/Cargo.toml', '-p', 'wakaclock-server', '--lib',
                                     test, '--', *(['--ignored'] if test != tests[3] else []), '--test-threads=1', '--nocapture'], cwd=REPO,
                                    env=values, stdout=log, stderr=subprocess.STDOUT)
        log_path.chmod(0o600)
        # A mistyped filter executes zero tests: never count that as a pass.
        output = log_path.read_text()
        passed = result.returncode == 0 and '1 passed;' in output
        report['tests'].append({'name': test, 'status': 'passed' if passed else 'failed',
                                'duration_seconds': round(time.monotonic() - began, 3),
                                'query_duration_ms': {k: int(v) for k, v in re.findall(
                                    r'(receipt_\w+_limit_query_ms)=(\d+)', output)}})
        print(json.dumps(report['tests'][-1]), flush=True)
    report['status'] = 'passed' if all(row['status'] == 'passed' for row in report['tests']) else 'failed'
    if preflight() != build:
        raise ValueError('build_changed_during_database_checks')
    statuses = {row['name']: row['status'] for row in report['tests']}
    receipt_status = statuses[tests[2]]
    scenarios = dict.fromkeys(('device_agent_isolation', 'revision', 'duplicate', 'scopes',
                              'deterministic_union', 'missing_intervals', 'facts_10000',
                              'facts_10001', 'operations_10000', 'operations_10001'), receipt_status)
    scenarios['timezone'] = statuses[tests[0]]
    scenarios['cursor'] = statuses[tests[3]]
    evidence = run_evidence(build, __file__, scenarios, sample_count=len(tests),
                            tests=report['tests'], source_snapshot_sha256=report['source_snapshot_sha256'])
    private_json(ROOT / 'evidence/database-checks.json', evidence)
    raise SystemExit(0 if report['status'] == 'passed' else 1)


if __name__ == '__main__':
    main()
