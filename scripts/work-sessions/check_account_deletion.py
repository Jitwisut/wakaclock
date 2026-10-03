#!/usr/bin/env python3
"""Disposable lab account: API request, outbox/worker purge, delayed API replay."""
import hashlib
import json
import secrets
import subprocess
import time
import urllib.error
import uuid
from datetime import datetime, timezone
from local_lab import ROOT, API, config, env, request, private_json
from local_s3 import request as s3_request
from receipt_readback import Reader, receipt_id, session_scope
from runtime_binding import preflight
from evidence_contract import run_evidence


def pg(sql):
    result = subprocess.run(['docker', 'exec', '-i', 'atoaxis-receipt-validation-postgres-1',
                             'psql', '-U', 'receipt_validation', '-d', 'receipt_validation',
                             '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], input=sql,
                            capture_output=True, text=True, timeout=15)
    if result.returncode:
        raise ValueError('lab_postgres_check_failed')
    return result.stdout.strip()


def main():
    build_hash = preflight()
    report = {'schema_version': 2, 'evidence_kind': 'synthetic_integration',
              'build_manifest_sha256': build_hash, 'status': 'failed', 'stages': {},
              'generated_at': datetime.now(timezone.utc).isoformat(), 'promotable': False}
    path = ROOT / 'evidence/account-deletion.json'
    try:
        auth = request('/api/v1/auth/register', 'POST', payload={
            'username': 'deletion-fixture-' + uuid.uuid4().hex,
            'password': secrets.token_urlsafe(32)})['data']
        user = str(uuid.UUID(auth['user_id']))
        key = request('/api/v1/users/current/api_key', 'POST', token=auth['token'])['data']['api_key']
        collector = str(uuid.uuid4())
        session = session_scope(collector, 'codex', uuid.uuid4().hex)
        rid = receipt_id(user, collector, 'codex', session)
        usage = {'usage_event_id': uuid.uuid4().hex, 'collector_id': collector,
                 'ai_session_id': session, 'occurred_at': datetime.now(timezone.utc).isoformat(),
                 'agent': 'codex', 'provider': 'openai', 'model': 'deletion-fixture',
                 'prompt_count': 1, 'input_tokens': 0, 'token_source': 'transcript'}
        request('/api/v1/ai/usage', 'POST', token=key, payload=[usage])
        route = '/api/v2/me/work-sessions/' + rid
        request(route + '/outcome', 'PUT', token=key, payload={'outcome': 'completed'})
        request(route + '/outcome', 'DELETE', token=key)
        export_job, artifact = str(uuid.uuid4()), str(uuid.uuid4())
        object_key = 'deletion-fixtures/' + uuid.uuid4().hex
        body = b'disposable receipt validation fixture'
        assert s3_request(config(), 'PUT', object_key, body)[0] == 200
        # SQL interpolations below are generated UUIDs, hex IDs and fixed enum values only.
        pg(f"INSERT INTO export_jobs(id,user_id,format,scope,status) VALUES ('{export_job}','{user}','json','ai','completed'); "
           f"INSERT INTO export_artifacts(id,export_job_id,object_key,sha256,bytes) VALUES ('{artifact}','{export_job}','{object_key}','{hashlib.sha256(body).hexdigest()}',{len(body)});")
        assert pg(f"SELECT count(*) FROM work_session_outcome_history WHERE user_id='{user}';") == '2'
        report['stages']['seed'] = 'passed'
        job = request('/api/v2/me', 'DELETE', token=auth['token'], payload={'confirm': True})['data']
        job_id = str(uuid.UUID(job['job_id']))
        report['stages']['api_request'] = 'passed'
        began = time.monotonic()
        for _ in range(90):
            state = pg(f"SELECT status FROM async_jobs WHERE id='{job_id}';")
            if state == 'succeeded':
                break
            if state in ('failed', 'dead_lettered', 'cancelled'):
                raise ValueError('deletion_worker_' + state)
            time.sleep(0.5)
        else:
            raise ValueError('deletion_worker_timeout')
        report['worker_duration_seconds'] = round(time.monotonic() - began, 3)
        report['stages']['worker'] = 'passed'
        for table in ('users', 'work_session_outcomes', 'work_session_outcome_history', 'export_jobs'):
            field = 'id' if table == 'users' else 'user_id'
            assert pg(f"SELECT count(*) FROM {table} WHERE {field}='{user}';") == '0'
        values = env()
        reader = Reader(API, key, values['CLICKHOUSE_URL'], values['CLICKHOUSE_USER'], values['CLICKHOUSE_PASSWORD'])
        for table in ('heartbeats', 'ai_usage_events', 'ai_sessions', 'ai_session_projects'):
            assert int(reader.rows(f'SELECT count(*) AS n FROM wakaclock.{table} WHERE user_id={{user:UUID}}', user=user)[0]['n']) == 0
        assert s3_request(config(), 'HEAD', object_key)[0] == 404
        assert pg(f"SELECT status FROM account_deletion_requests WHERE account_id='{user}';") == 'succeeded'
        report['stages']['purge'] = 'passed'
        for attempt in range(2):
            try:
                request('/api/v1/ai/usage', 'POST', token=key, payload=[usage])
            except urllib.error.HTTPError as error:
                assert error.code == 401
            else:
                raise ValueError('delayed_replay_accepted')
        assert int(reader.rows('SELECT count(*) AS n FROM wakaclock.ai_usage_events WHERE user_id={user:UUID}', user=user)[0]['n']) == 0
        report['stages']['delayed_api_replay'] = 'passed'
        report['status'] = 'passed'
    except Exception as error:
        # Never print arbitrary HTTP, SQL, credential or account detail.
        report['mismatch_codes'] = [str(error) if isinstance(error, ValueError) else type(error).__name__]
    if preflight() != build_hash:
        raise ValueError('build_changed_during_deletion_check')
    evidence = run_evidence(build_hash, __file__,
        dict.fromkeys(('request_worker_purge', 'outcome_history', 'delayed_replay'), report['status']),
        stages=report['stages'], generated_at=report['generated_at'],
        replay_scope='api_ingestion_only', worker_duration_seconds=report.get('worker_duration_seconds'))
    private_json(path, evidence)
    print(json.dumps(report))
    raise SystemExit(0 if report['status'] == 'passed' else 1)


if __name__ == '__main__':
    main()
