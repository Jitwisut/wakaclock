#!/usr/bin/env python3
"""Smoke the built operator CLI with a private disposable metadata-only journal.
No database, provider, credentials or Docker. Does not build or alter real ledgers.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
BINARY = ROOT/'backend/api/target/debug/team-financial-guard'
OUT = ROOT/'output/team-closure-2026-10-13'


def main():
    assert BINARY.is_file(), 'build operator CLI first'
    root = Path(tempfile.mkdtemp(prefix='atoaxis-financial-cli-', dir='/private/tmp'))
    root.chmod(0o700)
    namespace, organization = str(uuid.uuid4()), str(uuid.uuid4())
    journal = root/'guard.jsonl'
    reports = []

    clean_env = {k:v for k,v in os.environ.items() if k not in (
        'ATOAXIS_TEAM_FINANCIAL_GUARD_PATH', 'ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE',
        'ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED', 'POSTGRES_URL')}

    def call(args, success=True, settings=None):
        result = subprocess.run([str(BINARY), *map(str, args)], cwd=ROOT,
                                env={**clean_env, **(settings or {})}, capture_output=True, timeout=15)
        reports.append({'command':args[0], 'status':result.returncode,
                        'stdout':result.stdout.decode(), 'stderr':result.stderr.decode()})
        assert (result.returncode == 0) == success, 'unexpected operator outcome'
        return result

    try:
        call(['initialize',journal,'--namespace',namespace,'--legacy-organization',organization],False)
        assert not journal.exists(), 'missing acknowledgement cannot mutate storage'
        call(['initialize',journal,'--namespace',namespace,'--legacy-organization',organization,
              '--acknowledge-reviewed-roster'])
        original=journal.read_bytes()
        settings={'ATOAXIS_TEAM_FINANCIAL_GUARD_PATH':str(journal),
                  'ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE':namespace}
        for flag in (None,'false','0','yes','true '):
            env={**settings}
            if flag is not None:
                env['ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED']=flag
            call(['verify-deployment'],False,env)
        call(['verify-deployment'],False,{'ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED':'true'})
        if os.name=='posix':
            for key in settings:
                call(['verify-deployment'],False,{**settings,'ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED':'true',key:os.fsdecode(b'\xff')})
        commercial={**settings,'ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED':'true'}
        verified=json.loads(call(['verify-deployment'],True,commercial).stdout)
        assert verified['status']=='commercial_guard_configured'
        assert verified['production_ready'] is False and verified['financial_sources']=='unconfirmed'
        assert str(journal).encode() not in json.dumps(verified).encode()
        call(['verify-deployment'],False,{**commercial,'ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE':str(uuid.uuid4())})
        missing=root/'uninitialized.jsonl'
        call(['verify-deployment'],False,{**commercial,'ATOAXIS_TEAM_FINANCIAL_GUARD_PATH':str(missing)})
        assert not missing.exists()
        assert journal.read_bytes()==original, 'verification must not append or activate'
        inventory=['inspect-inventory',journal,'--namespace',namespace,
                   '--organization',organization,'--account','acct_fixture']
        call(inventory,False)  # No POSTGRES_URL: must not infer/seed a source head.
        call(['inspect-inventory',journal,'--namespace',str(uuid.uuid4()),
              '--organization',organization,'--account','acct_fixture'],False)
        call(['inspect-inventory',journal,'--namespace',namespace,
              '--organization',organization,'--account','invalid'],False)
        assert journal.read_bytes()==original, 'inventory failure must not mutate evidence'
        call(['inspect-ingress',journal,'--namespace',namespace,'--account','acct_fixture'],False)
        assert journal.read_bytes()==original, 'missing DB cannot initialize ingress evidence'

        status=json.loads(call(['inspect',journal]).stdout)
        assert status['namespace']==namespace and status['legacy']==1 and status['pending']==0
        assert status['product_authorization_enabled'] is False
        call(['initialize',journal,'--namespace',namespace,'--acknowledge-reviewed-roster'],False)
        assert journal.read_bytes()==original, 'second initialization must preserve evidence'
        marker='private_fixture_marker_must_not_escape'
        journal.write_bytes(original+marker.encode()+b'\n')
        result=call(['inspect',journal],False)
        assert marker.encode() not in result.stdout+result.stderr
        assert journal.read_bytes()==original+marker.encode()+b'\n', 'invalid evidence cannot be truncated'
        evidence={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),
                  'base_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip(),
                  'source_scope':'uncommitted worktree','binary_sha256':hashlib.sha256(BINARY.read_bytes()).hexdigest(),
                  'explicit_roster_ack':'passed','initialize_inspect':'passed','reinitialize_preserves_original':'passed',
                  'corrupt_record_denied_and_retained':'passed','public_error_metadata_only':'passed',
                  'deployment_configuration_matrix':'passed','missing_ledger_not_initialized':'passed',
                  'inventory_missing_database_namespace_scope_denied_without_mutation':'passed',
                  'ingress_missing_database_denied_without_seed':'passed',
                  'database_verified':False,'provider_contacted':False,'product_authorization_enabled':False,
                  'platform_scope':'local operator CLI only; not client/native OS certification','commands':reports}
        (OUT/'financial-guard-cli-smoke.json').write_text(json.dumps(evidence,indent=2)+'\n')
        print(json.dumps({k:v for k,v in evidence.items() if k!='commands'}))
    finally:
        shutil.rmtree(root)


if __name__=='__main__':
    main()
