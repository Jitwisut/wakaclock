#!/usr/bin/env python3
"""Real CH + native PG, synthetic Team cost faults; one disposable container only."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import uuid
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PG = Path('/opt/homebrew/opt/postgresql@16/bin')
DOCKER = '/usr/local/bin/docker'
IMAGE = 'clickhouse/clickhouse-server:24.10.2.80-alpine'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target-dir', required=True)
    args = parser.parse_args()
    ident = uuid.uuid4().hex
    tmp = Path('/private/tmp') / f'atoaxis-cost-{ident}'
    out = ROOT/'output/team-closure-2026-10-13'/tmp.name
    tmp.mkdir(mode=0o700); out.mkdir(parents=True)
    data = tmp/'pg'; name = f'atoaxis-cost-{ident[:12]}'
    created = False

    def run(command, label, env=None, timeout=600):
        if str(command[0]) == DOCKER:
            timeout = min(timeout, 30)
        try:
            result = subprocess.run([str(x) for x in command], cwd=ROOT/'backend/api', env=env,
                                    capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired as error:
            (out/f'{label}.log').write_bytes((error.stdout or b'')+(error.stderr or b'')+b'\nfixture_command_timeout\n')
            raise RuntimeError(f'isolated fixture command timeout: {label}') from error
        (out/f'{label}.log').write_bytes(result.stdout+result.stderr)
        if result.returncode:
            raise RuntimeError(f'isolated cost fixture failed: {label}; see synthetic log')
        return result.stdout

    before = shutil.disk_usage(ROOT).free
    try:
        assert PG.is_dir(), 'native PostgreSQL 16 required'
        # Desktop start can return before its engine API is ready. Bound each
        # attempt and fail without creating containers or touching existing data.
        ready = False
        for _ in range(15):
            try:
                probe = subprocess.run([DOCKER,'version','--format','{{.Server.Version}}'], capture_output=True, timeout=2)
                if probe.returncode == 0 and probe.stdout.strip():
                    ready = True
                    break
            except subprocess.TimeoutExpired:
                pass
            time.sleep(1)
        if not ready:
            raise RuntimeError('isolated Docker engine readiness unconfirmed')
        # Reuse exact pinned image; do not silently download another provider/version.
        image = run([DOCKER,'image','inspect',IMAGE,'--format','{{.Id}}'], 'image').decode().strip()
        prior = run([DOCKER,'ps','--format','{{.Names}}'], 'containers-before').decode().splitlines()
        run([DOCKER,'run','-d','--rm','--pull=never','--name',name,
             '--label','com.atoaxis.fixture=joint-cost','--cpus','2','--memory','1g',
             '--tmpfs','/var/lib/clickhouse','--tmpfs','/var/log/clickhouse-server',
             '-p','127.0.0.1:58125:8123','-e','CLICKHOUSE_DB=wakaclock',
             '-e','CLICKHOUSE_SKIP_USER_SETUP=1',IMAGE], 'clickhouse-start')
        created = True
        for _ in range(40):
            check = subprocess.run([DOCKER,'exec',name,'clickhouse-client','--query','SELECT 1'], capture_output=True, timeout=3)
            if check.returncode == 0: break
            time.sleep(1)
        else: raise RuntimeError('isolated ClickHouse readiness timeout')
        # The native client probes a different listener. Verify the published HTTP
        # endpoint too before letting a Rust network failure masquerade as a code regression.
        http = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for _ in range(40):
            try:
                with http.open('http://127.0.0.1:58125/ping', timeout=2) as response:
                    if response.read().strip() == b'Ok.':
                        break
            except (OSError, TimeoutError):
                pass
            time.sleep(1)
        else:
            raise RuntimeError('isolated ClickHouse published HTTP readiness timeout')
        run([PG/'initdb','-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--no-locale'],'postgres-init')
        run([PG/'pg_ctl','-D',data,'-l',tmp/'pg.log','-o',f'-h 127.0.0.1 -p 56441 -k {tmp}','start'],'postgres-start')
        run([PG/'createdb','-h','127.0.0.1','-p','56441','-U','postgres','atoaxis_team_test'],'database')
        env = {**os.environ, 'POSTGRES_TEST_URL':'postgresql://postgres@127.0.0.1:56441/atoaxis_team_test',
               'CLICKHOUSE_TEST_URL':'http://127.0.0.1:58125','CLICKHOUSE_TEST_DATABASE':'wakaclock'}
        for key in ('ATOAXIS_TEAM_FINANCIAL_GUARD_PATH','ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE','ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED'):
            env.pop(key, None)
        for key in ('CLICKHOUSE_TEST_USER','CLICKHOUSE_TEST_PASSWORD'):
            env.pop(key, None)
        result = run(['cargo','test','-p','wakaclock-server','--lib','team_cost_joint_canonical',
                      '--target-dir',args.target_dir,'--jobs','4','--','--ignored','--nocapture','--test-threads=1'],
                     'joint-cost', env=env, timeout=900)
        assert b'1 passed' in result
        version = run([DOCKER,'exec',name,'clickhouse-client','--query','SELECT version()'],'version').decode().strip()
        files = ['backend/api/src/repository/team_cost_tests.rs','backend/api/src/services/team_insights.rs',
                 'backend/api/src/repository/team_usage_admissions.rs',
                 'backend/api/src/repository/team_financial_guard.rs',
                 'backend/api/src/infrastructure/team_financial_guard.rs',
                 'backend/api/src/repository/team_trust.rs',
                 'backend/api/src/repository/team_actions.rs',
                 'backend/api/src/model/team_insights.rs',
                 'backend/api/src/handlers/v2/team_insights.rs',
                 'backend/api/src/repository/team_usage_scan.rs',
                 'backend/api/src/services/team_usage_admission_worker.rs',
                 'backend/api/migrations/postgres/052_team_usage_admissions.sql',
                 'backend/api/migrations/postgres/053_team_usage_admission_scans.sql',

                 'backend/api/src/services/team_comparison.rs','backend/api/src/services/team_weekly_summary.rs',
                 'backend/api/src/repository/team_insights.rs','scripts/team-cost-local-check.py']
        evidence = {'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'base_commit':run(['git','rev-parse','HEAD'],'commit').decode().strip(),
                    'source_scope':'uncommitted_worktree','fixture':'synthetic_metadata_only_real_postgres_clickhouse',
                    'clickhouse_version':version,'clickhouse_image_id':image,'postgres_version':run([PG/'postgres','--version'],'pg-version').decode().strip(),
                    'source_sha256':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files},
                    'independent_cost_ledger':{'baseline_micro_usd':500,'followup_micro_usd':1000,'contributors':5},
                    'canonical_correction_after_serialization':'passed','published_week_not_reissued':'passed',
                    'pg_source_change_during_canonical_read':'passed','canonical_change_after_response_capture':'passed',
                    'financial_pending_and_completed_change_after_serialization':'passed',
                    'private_financial_proof_not_serialized':'passed',
                    'autonomous_usage_admission_real_canonical_and_delayed_resweep':'passed',
                    'weekly_summary_csv_cost':'passed','production_ready':False,'http_browser_acceptance':'pending',
                    'maximum_owned_containers':1,'prior_containers_count':len(prior),'logs':str(out.relative_to(ROOT)),
                    'free_space_before_bytes':before,'free_space_after_build_bytes':shutil.disk_usage(ROOT).free}
        (out/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
        (out.parent/'cost-joint-local.json').write_text(json.dumps(evidence,indent=2)+'\n')
        print(json.dumps(evidence))
    finally:
        original_failure = sys.exc_info()[0] is not None
        cleanup = {'owned_container_created':created,'owned_container_stopped':not created}
        if (data/'postmaster.pid').exists():
            try:
                stopped = subprocess.run([str(PG/'pg_ctl'),'-D',str(data),'stop','-m','fast'],capture_output=True,timeout=15)
                (out/'postgres-stop.log').write_bytes(stopped.stdout+stopped.stderr)
            except subprocess.TimeoutExpired:
                cleanup['postgres_error'] = 'stop_timeout'
        if created:
            try:
                stopped = subprocess.run([DOCKER,'stop',name],capture_output=True,timeout=20)
                (out/'clickhouse-stop.log').write_bytes(stopped.stdout+stopped.stderr)
                cleanup['owned_container_stopped'] = stopped.returncode == 0
                check = subprocess.run([DOCKER,'ps','-q'],capture_output=True,timeout=5)
                if cleanup['owned_container_stopped'] and check.returncode == 0 and not check.stdout.strip():
                    stopped = subprocess.run([DOCKER,'desktop','stop'],capture_output=True,timeout=30)
                    (out/'docker-desktop-stop.log').write_bytes(stopped.stdout+stopped.stderr)
            except subprocess.TimeoutExpired:
                cleanup['docker_error'] = 'cleanup_timeout'
        cleanup['owned_postgres_stopped'] = not (data/'postmaster.pid').exists()
        if (tmp/'pg.log').exists():
            shutil.copy2(tmp/'pg.log',out/'postgres.log')
        if cleanup['owned_postgres_stopped']:
            shutil.rmtree(tmp)
        cleanup['owned_fixture_data_removed'] = not tmp.exists()
        (out/'cleanup.json').write_text(json.dumps(cleanup,indent=2)+'\n')
        print(json.dumps(cleanup))
        if not original_failure and not (cleanup['owned_postgres_stopped'] and cleanup['owned_container_stopped']):
            raise RuntimeError('isolated fixture cleanup unconfirmed; retained evidence requires follow-up')


if __name__ == '__main__':
    main()
