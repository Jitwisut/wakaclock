#!/usr/bin/env python3
"""Synthetic Copilot PostgreSQL restore drill, sequential native instances, no Docker.
Uses only the fixed localhost fixture ports/data directories. Never reads app env files.
Keeps backup, independent ledger and logs; stops both owned instances on every exit.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
TMP = Path('/private/tmp/atoaxis-copilot-reports-test') / f'drill-{uuid.uuid4().hex}'
BIN = Path('/opt/homebrew/opt/postgresql@16/bin')
OUT_ROOT = ROOT / 'output/copilot-reports-local'
OUT = OUT_ROOT / TMP.name
LEDGER = TMP / 'drill-ledger.json'


def run(args, *, log=None, env=None):
    p = subprocess.run([str(x) for x in args], cwd=ROOT, env=env, capture_output=True)
    if log:
        log.write_bytes(p.stdout + p.stderr)
    if p.returncode:
        raise RuntimeError('fixture command failed; inspect synthetic local log')
    return p.stdout


def stage(name, port):
    env = {**os.environ, 'POSTGRES_TEST_URL': f'postgresql://postgres@127.0.0.1:{port}/atoaxis_team_test',
           'COPILOT_DRILL_STAGE': name, 'COPILOT_DRILL_LEDGER': str(LEDGER)}
    output = run(['cargo', 'test', '--manifest-path', 'backend/api/Cargo.toml', '-p',
                  'wakaclock-server', '--lib', 'weekly_copilot_bundle', '--', '--ignored',
                  '--nocapture', '--test-threads=1'], env=env, log=OUT / f'{name}.log')
    assert b'1 passed' in output, 'test not executed'


def main():
    assert BIN.is_dir(), 'native PostgreSQL 16 required'
    TMP.mkdir(parents=True, mode=0o700)
    OUT.mkdir(parents=True, exist_ok=True)
    restore = TMP / 'restore-pg'
    assert not restore.exists() and not LEDGER.exists(), 'refuse to overwrite drill evidence'
    try:
        # New owned synthetic instance. No arbitrary POSTGRES_URL accepted.
        run([BIN / 'initdb', '-D', TMP / 'pg', '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'])
        run([BIN / 'pg_ctl', '-D', TMP / 'pg', '-l', TMP / 'source-postgres.log', '-o',
             f'-h 127.0.0.1 -p 56437 -k {TMP}', 'start'])
        run([BIN / 'createdb', '-h', '127.0.0.1', '-p', '56437', '-U', 'postgres', 'atoaxis_team_test'])
        stage('seed', 56437)
        LEDGER.chmod(0o600)
        backup = TMP / 'before-revocation.dump'
        run([BIN / 'pg_dump', '-h', '127.0.0.1', '-p', '56437', '-U', 'postgres',
             '-d', 'atoaxis_team_test', '-Fc', '-f', backup])
        stage('revoke', 56437)
        run([BIN / 'pg_ctl', '-D', TMP / 'pg', 'stop', '-m', 'fast'])
        # Only one database instance is active at a time.
        run([BIN / 'initdb', '-D', restore, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'])
        run([BIN / 'pg_ctl', '-D', restore, '-l', TMP / 'restore-postgres.log', '-o',
             f'-h 127.0.0.1 -p 56438 -k {TMP}', 'start'])
        run([BIN / 'createdb', '-h', '127.0.0.1', '-p', '56438', '-U', 'postgres', 'atoaxis_team_test'])
        run([BIN / 'pg_restore', '-h', '127.0.0.1', '-p', '56438', '-U', 'postgres',
             '-d', 'atoaxis_team_test', '--no-owner', backup])
        stage('verify', 56438)
        bench_env = {**os.environ, 'POSTGRES_TEST_URL': 'postgresql://postgres@127.0.0.1:56438/atoaxis_team_test',
                     'COPILOT_REPORT_BENCHMARK': '1'}
        for key in ['COPILOT_DRILL_STAGE', 'COPILOT_DRILL_LEDGER']:
            bench_env.pop(key, None)
        bench = run(['cargo', 'test', '--manifest-path', 'backend/api/Cargo.toml', '-p',
                     'wakaclock-server', '--lib', 'weekly_copilot_bundle', '--', '--ignored',
                     '--nocapture', '--test-threads=1'], env=bench_env, log=OUT / 'benchmark.log')
        assert b'1 passed' in bench, 'benchmark not executed'
        # cargo writes nocapture test diagnostics to stderr; read the saved log.
        rows = (OUT / 'benchmark.log').read_text().splitlines()
        performance = json.loads(next(x.split('=', 1)[1] for x in rows
                                      if x.startswith('copilot_local_service_benchmark=')))
        result = {'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                  'base_commit': run(['git', 'rev-parse', 'HEAD']).decode().strip(),
                  'source_scope': 'uncommitted source tree', 'fixture': 'synthetic_metadata_only',
                  'postgres_backup_sha256': hashlib.sha256(backup.read_bytes()).hexdigest(),
                  'restore_to_new_native_instance': 'passed',
                  'pre_revocation_restore_read_denied': 'passed',
                  'regressed_registry_export_denied': 'passed',
                  'reconciled_rollout_integration_and_read_closed': 'passed',
                  'accepted_facts_preserved_and_blocked': 'passed',
                  'instances_simultaneously_active': 1,
                  'docker_started': False, 'clickhouse_changed': False,
                  'cloud_or_live_certified': False, 'local_service_performance': performance}
        result['source_sha256'] = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'backend/api/migrations/postgres/037_team_copilot_reports.sql', ROOT/'backend/api/src/repository/copilot_reports.rs', ROOT/'backend/api/src/repository/team_trust.rs']}
        (OUT / 'restore.json').write_text(json.dumps(result, indent=2) + '\n')
        (OUT_ROOT / 'restore.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result))
    finally:
        for directory in [TMP / 'pg', restore]:
            if (directory / 'postmaster.pid').exists():
                subprocess.run([str(BIN / 'pg_ctl'), '-D', str(directory), 'stop', '-m', 'fast'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
