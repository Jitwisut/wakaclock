#!/usr/bin/env python3
"""Copilot commercial admission on disposable native PostgreSQL; no provider or Docker.
Does not accept database credentials/URLs. Retains logs, removes owned fixture data
only after the server has stopped. Reuses backend/api/target.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
BIN = Path('/opt/homebrew/opt/postgresql@16/bin')
TMP = Path('/private/tmp') / f'atoaxis-copilot-admission-{uuid.uuid4().hex}'
OUT = ROOT / 'output/team-closure-2026-10-13' / TMP.name
PORT = '56443'
TESTS = ('copilot_daily_durable_mixed_report_consent_retry_and_restore',
         'copilot_scheduler_rotates_beyond_one_hundred_organizations',
         'weekly_copilot_bundle', 'weekly_registry_revocation_cleanup_and_restore',
         'financial_guard_database_restored_before_enrollment_is_denied')


def run(args, label, env=None, cwd=ROOT):
    p = subprocess.run([str(a) for a in args], cwd=cwd, env=env, capture_output=True)
    (OUT / f'{label}.log').write_bytes(p.stdout+p.stderr)
    if p.returncode:
        raise RuntimeError(f'{label} failed; inspect metadata-only fixture log')
    return p.stdout


def main():
    TMP.mkdir(mode=0o700)
    OUT.mkdir(parents=True)
    data = TMP/'pg'
    results = {}
    try:
        run(['cargo','build','--bin','team-financial-guard','--jobs','4'],
            'build-financial-operator',cwd=ROOT/'backend/api')
        run([BIN/'initdb', '-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'], 'init')
        run([BIN/'pg_ctl', '-D', data, '-l', TMP/'pg.log', '-o', f'-h 127.0.0.1 -p {PORT} -k {TMP}', 'start'], 'start')
        run([BIN/'createdb', '-h', '127.0.0.1', '-p', PORT, '-U', 'postgres', 'atoaxis_team_test'], 'database')
        env={**os.environ,'POSTGRES_TEST_URL':f'postgresql://postgres@127.0.0.1:{PORT}/atoaxis_team_test',
             'TEAM_FINANCIAL_GUARD_TEST_BIN':str(ROOT/'backend/api/target/debug/team-financial-guard')}
        for key in ('ATOAXIS_TEAM_FINANCIAL_GUARD_PATH','ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE','ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED'):
            env.pop(key, None)
        for key in ('COPILOT_DRILL_STAGE','COPILOT_DRILL_LEDGER','COPILOT_REPORT_BENCHMARK'):
            env.pop(key,None)
        for name in TESTS:
            output=run(['cargo','test','-p','wakaclock-server','--lib',name,'--','--ignored','--nocapture','--test-threads=1'],name,env,ROOT/'backend/api')
            assert b'1 passed' in output, 'test did not execute'
            results[name]='passed'
        files=['backend/api/src/repository/team_stripe_customer_resolution.rs',
               'backend/api/src/repository/team_stripe_customer_recovery.rs',
               'backend/api/src/repository/team_stripe_customer_dispatch.rs',
               'backend/api/src/services/team_stripe_customer_request.rs',
               'backend/api/src/repository/copilot_daily.rs','backend/api/src/repository/copilot_reports.rs',
               'backend/api/src/services/team_financial_transaction.rs',
               'backend/api/src/services/team_financial_transaction_tests.rs',
               'backend/api/src/infrastructure/team_financial_transaction_tests.rs',
               'backend/api/src/repository/team_financial_transaction_tests.rs',
               'backend/api/src/repository/team_financial_transaction.rs',
               'backend/api/src/repository/copilot_admission.rs','backend/api/src/services/copilot_admission.rs',
               'backend/api/src/services/copilot_daily.rs','backend/api/src/repository/team_trust.rs',
               'backend/api/src/infrastructure/postgres.rs','backend/api/migrations/postgres/054_team_copilot_admissions.sql',
               'backend/api/src/infrastructure/team_financial_guard.rs','backend/api/src/services/team_financial_guard.rs',
                 'backend/api/src/services/team_financial_source.rs',
                 'backend/api/src/services/team_financial_inventory.rs',
                 'backend/api/src/repository/team_financial_inventory.rs',
                 'backend/api/src/repository/team_financial_inventory_tests.rs',
                 'backend/api/migrations/postgres/055_team_financial_source_checkpoints.sql',
                 'backend/api/src/services/team_financial_ingress.rs',
                 'backend/api/src/repository/team_financial_ingress.rs',
                 'backend/api/src/repository/team_financial_ingress_tests.rs',
                 'backend/api/migrations/postgres/056_team_financial_ingress.sql',
               'backend/api/src/repository/team_financial_guard.rs','backend/api/src/bin/team-financial-guard.rs',
               'backend/api/Cargo.toml','backend/api/Cargo.lock','backend/api/src/services/mod.rs',
               'backend/api/src/repository/mod.rs','backend/api/src/infrastructure/mod.rs']
        evidence={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),
                  'base_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip(),
                  'source_scope':'uncommitted worktree','fixture':'native_postgresql_synthetic_metadata',
                  'tests':results,'source_sha256':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files},
                  'actual_operator_database_cli':'passed', 'commercial_mode_downgrade_read_and_admission_denied':'passed',
                  'docker_started':False,'live_provider_certified':False,'financial_restore':'pending',
                  'public_activation_enabled':False,'production_ready':False,'logs':str(OUT.relative_to(ROOT))}
        (OUT/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
        (OUT.parent/'copilot-admission-local.json').write_text(json.dumps(evidence,indent=2)+'\n')
        print(json.dumps(evidence))
    finally:
        if (data/'postmaster.pid').exists():
            stopped=subprocess.run([str(BIN/'pg_ctl'),'-D',str(data),'stop','-m','fast'],capture_output=True)
            (OUT/'stop.log').write_bytes(stopped.stdout+stopped.stderr)
        if (TMP/'pg.log').exists():
            shutil.copy2(TMP/'pg.log',OUT/'postgres.log')
        if not (data/'postmaster.pid').exists():
            shutil.rmtree(TMP)


if __name__=='__main__':
    main()
