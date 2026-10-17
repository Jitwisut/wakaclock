#!/usr/bin/env python3
"""Native macOS PostgreSQL workflow regression, synthetic metadata, no app config.

Never accepts a production database URL. Keeps local logs; stops the owned instance
on every exit. Simulated old snapshots are not Cloud/provider certification.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
BIN = Path('/opt/homebrew/opt/postgresql@16/bin')
TMP = Path('/private/tmp') / f'atoaxis-actions-{uuid.uuid4().hex}'
OUT = ROOT / 'output/team-closure-2026-10-13' / TMP.name
PORT = '56440'


def run(args, label, env=None):
    result = subprocess.run([str(x) for x in args], cwd=ROOT, env=env, capture_output=True)
    (OUT / f'{label}.log').write_bytes(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(f'isolated fixture failed: {label}; see synthetic local log')
    return result.stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target-dir', help='isolated Cargo build cache')
    args = parser.parse_args()
    cargo_target = ['--target-dir', args.target_dir] if args.target_dir else []
    assert BIN.is_dir(), 'native Homebrew PostgreSQL 16 required'
    TMP.mkdir(mode=0o700)
    OUT.mkdir(parents=True)
    data = TMP / 'pg'
    try:
        run([BIN/'initdb', '-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'], 'init')
        run([BIN/'pg_ctl', '-D', data, '-l', TMP/'pg.log', '-o', f'-h 127.0.0.1 -p {PORT} -k {TMP}', 'start'], 'start')
        run([BIN/'createdb', '-h', '127.0.0.1', '-p', PORT, '-U', 'postgres', 'atoaxis_team_test'], 'database')
        env = {**os.environ, 'POSTGRES_TEST_URL': f'postgresql://postgres@127.0.0.1:{PORT}/atoaxis_team_test'}
        for key in ('COPILOT_DRILL_STAGE', 'COPILOT_DRILL_LEDGER', 'COPILOT_REPORT_BENCHMARK'):
            env.pop(key, None)
        for name in ('improvement_action_cas', 'weekly_copilot_bundle', 'weekly_registry_revocation_cleanup_and_restore'):
            result = run(['cargo', 'test', '--manifest-path', 'backend/api/Cargo.toml', '-p',
                          'wakaclock-server', '--lib', name, *cargo_target, '--', '--ignored', '--nocapture',
                          '--test-threads=1'], name, env)
            assert b'1 passed' in result, 'regression did not execute'
        files = [
            'backend/api/migrations/postgres/039_team_improvement_actions.sql',
            'backend/api/migrations/postgres/040_account_deletion_team_proof.sql',
            'backend/api/src/repository/team_actions.rs',
            'backend/api/src/repository/team_actions_tests.rs',
            'backend/api/src/services/team_actions.rs',
            'backend/api/src/services/team_insights.rs',
            'backend/api/src/services/team_weekly_summary.rs',
            'backend/api/src/handlers/v2/team_weekly_summary.rs',
            'backend/api/src/services/account_deletion.rs',
            'backend/api/src/repository/copilot_reports_tests.rs',
            'backend/api/src/repository/team_trust.rs',
        ]
        evidence = {
            'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(),
            'base_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip(),
            'source_scope': 'uncommitted worktree', 'fixture': 'synthetic_metadata_only',
            'source_sha256': {f: hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files},
            'migration_repeat': 'passed', 'cas_concurrent_writers': 'passed',
            'response_loss_request_id_retry': 'passed', 'missing_ledger_read_closed': 'passed',
            'scope_lead_viewer_and_owner_membership': 'passed', 'assignment_consent_unchanged': 'passed',
            'owner_removal_before_final_response': 'passed', 'deleted_uuid_absorbing_restore': 'passed',
            'snapshot_before_create_restore_barrier': 'passed',
            'participant_requirement_restore_before_actor_first_action': 'passed',
            'account_erasure_closes_missing_action_uuid': 'passed',
            'creator_account_hard_delete_after_reassignment': 'passed',
            'account_deletion_db_commit_export_failure_retry': 'passed',
            'soft_delete_cleanup_before_final_worker_proof': 'passed',
            'action_bound_copilot_comparison_and_revision_race': 'passed',
            'weekly_summary_filtered_pages_full_36_action_export': 'passed',
            'weekly_summary_null_fence_edit_and_owner_withdrawal': 'passed',
            'weekly_summary_copilot_scope': 'native_pg_synthetic_provider_metadata',
            'weekly_summary_cost_and_http_staging': 'pending',
            'calendar_retention_not_extended_by_edits': 'passed', 'canonical_hash_timezone_independent': 'passed',
            'leased_owner_removal_cleanup': 'passed', 'actions_do_not_bump_privacy_generation': 'passed',
            'copilot_and_privacy_registry_regressions': 'passed',
            'restore_evidence_scope': 'simulated old snapshots on native PostgreSQL',
            'cloud_restore': 'pending', 'http_and_browser_acceptance': 'pending',
            'production_ready': False, 'docker_started': False, 'clickhouse_changed': False,
            'logs': str(OUT.relative_to(ROOT)),
        }
        (OUT/'evidence.json').write_text(json.dumps(evidence, indent=2)+'\n')
        (OUT.parent/'actions-local.json').write_text(json.dumps(evidence, indent=2)+'\n')
        print(json.dumps(evidence))
    finally:
        if (data/'postmaster.pid').exists():
            subprocess.run([str(BIN/'pg_ctl'), '-D', str(data), 'stop', '-m', 'fast'], capture_output=True)


if __name__ == '__main__':
    main()
