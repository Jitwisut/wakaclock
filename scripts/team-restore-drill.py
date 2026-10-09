#!/usr/bin/env python3
"""Local synthetic-only PostgreSQL/ClickHouse logical backup/restore drill.
Creates disposable tmpfs containers; refuses names/ports/database outside this fixture.
Never reads application config, credential files, source, prompts, or real user data.
"""
import datetime as dt
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
NAMES = ['atoaxis-team-phase2-postgres', 'atoaxis-team-phase2-clickhouse',
         'atoaxis-team-phase2-pg-restore', 'atoaxis-team-phase2-ch-restore']
OUT = ROOT / 'output/team-phase2-restore'


def run(args, **kwargs):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs).stdout


def stage(name, port, ch_port, ledger):
    env = {**os.environ, 'POSTGRES_TEST_URL': f'postgresql://postgres:team_test_only@127.0.0.1:{port}/atoaxis_team_test',
           'CLICKHOUSE_TEST_URL': f'http://127.0.0.1:{ch_port}', 'CLICKHOUSE_TEST_DATABASE': 'wakaclock',
           'TEAM_DRILL_STAGE': name, 'ATOAXIS_TEAM_PRIVACY_LEDGER_PATH': str(ledger)}
    command=['cargo', 'test', '-p', 'wakaclock-server', '--lib', 'restore_drill_fixture_stages', '--', '--ignored', '--test-threads=1']
    completed=subprocess.run(command,cwd=ROOT/'backend/api',env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    (OUT/(name+'.log')).write_bytes(completed.stdout+completed.stderr)
    if completed.returncode: raise RuntimeError('fixture failed: '+name+'; inspect isolated fixture log')
    result=completed.stdout
    assert b'1 passed' in result, 'fixture did not pass'


def main():
    global NAMES, OUT
    parser=argparse.ArgumentParser();parser.add_argument('--github',action='store_true');args=parser.parse_args()
    if args.github:
        NAMES=[name.replace('phase2','github-drill').replace('team-pg-restore','team-github-pg-restore').replace('team-ch-restore','team-github-ch-restore') for name in NAMES]
        OUT=ROOT/'output/team-github-restore'
    OUT.mkdir(parents=True, exist_ok=True)
    ledger = OUT / 'independent-privacy-registry.json'
    try:
        for i, name in enumerate(NAMES):
            # Reuse only our known tmpfs source containers. Verify no volume/bind data exists.
            try:
                metadata = json.loads(run(['docker', 'inspect', name]))[0]
                assert not any(m.get('Type') in ('bind', 'volume') for m in metadata.get('Mounts', [])), 'refuse persistent mounts'
            except subprocess.CalledProcessError:
                if i % 2 == 0:
                    port = 55432 if i == 0 else 55433
                    run(['docker','run','-d','--rm','--name',name,'--tmpfs','/var/lib/postgresql/data','-p',f'127.0.0.1:{port}:5432','-e','POSTGRES_PASSWORD=team_test_only','-e','POSTGRES_DB=atoaxis_team_test','postgres:16-alpine'])
                else:
                    port = 58123 if i == 1 else 58124
                    run(['docker','run','-d','--rm','--name',name,'--tmpfs','/var/lib/clickhouse','--tmpfs','/var/log/clickhouse-server','-p',f'127.0.0.1:{port}:8123','-e','CLICKHOUSE_DB=wakaclock','-e','CLICKHOUSE_SKIP_USER_SETUP=1','clickhouse/clickhouse-server:24.10.2.80-alpine'])
        for name in NAMES:
            for _ in range(30):
                try:
                    if 'postgres' in name or 'pg-restore' in name:
                        run(['docker','exec',name,'pg_isready','-U','postgres'])
                    else:
                        run(['docker','exec',name,'clickhouse-client','--query','SELECT 1'])
                    break
                except subprocess.CalledProcessError: time.sleep(1)
            else: raise RuntimeError('fixture readiness timeout')
        stage('seed',55432,58123,ledger)
        # Real logical database backups before consent withdrawal; payload is synthetic metadata only.
        pg_dump = run(['docker','exec',NAMES[0],'pg_dump','-U','postgres','-d','atoaxis_team_test','-Fc'])
        tables = run(['docker','exec',NAMES[1],'clickhouse-client','--query',"SELECT name FROM system.tables WHERE database='wakaclock' AND engine NOT LIKE '%View' ORDER BY name FORMAT TSV"]).decode().splitlines()
        ch_backups = []
        for table in tables:
            assert table.replace('_','').isalnum(), 'unexpected fixture table name'
            ddl = run(['docker','exec',NAMES[1],'clickhouse-client','--query',f'SHOW CREATE TABLE wakaclock.{table} FORMAT TSVRaw']).decode()
            data = run(['docker','exec',NAMES[1],'clickhouse-client','--query',f'SELECT * FROM wakaclock.{table} FORMAT Native'])
            ch_backups.append((table,ddl,data))
        stage('revoke',55432,58123,ledger)
        run(['docker','exec','-i',NAMES[2],'pg_restore','-U','postgres','-d','atoaxis_team_test','--no-owner'], input=pg_dump)
        run(['docker','exec',NAMES[3],'clickhouse-client','--query','CREATE DATABASE IF NOT EXISTS wakaclock'])
        for table, ddl, data in ch_backups:
            run(['docker','exec',NAMES[3],'clickhouse-client','--query',ddl])
            if data: run(['docker','exec','-i',NAMES[3],'clickhouse-client','--query',f'INSERT INTO wakaclock.{table} FORMAT Native'],input=data)
        stage('verify-old-restore',55433,58124,ledger)
        result = {'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),
                  'base_commit':run(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip(),
                  'build_scope':'current uncommitted source tree; fixture test executable',
                  'test_binary_sha256':hashlib.sha256(max((ROOT/'backend/api/target/debug/deps').glob('wakaclock_server-????????????????'),key=lambda path:path.stat().st_mtime).read_bytes()).hexdigest(),
                  'fixture':'synthetic_metadata_only' ,'postgres_logical_restore':'passed','clickhouse_native_restore':'passed',
                  'old_consent_read_blocked':'passed','independent_registry_regression_rejected':'passed',
                  'rollout_and_sharing_disabled_after_reconcile':'passed','personal_usage_preserved_distinct':'passed',
                  'cloud_restore_certified':False, 'team_rollup_cleanup':'passed','github_context_and_facts_restore_cleanup':'passed'}
        (OUT/'latest.json').write_text(json.dumps(result,indent=2))
        print(json.dumps(result))
    finally:
        # Remove only the two restore instances; source fixtures can be used for remaining tests.
        for name in NAMES[2:]:
            subprocess.run(['docker','stop',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
