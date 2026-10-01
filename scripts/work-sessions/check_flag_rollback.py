#!/usr/bin/env python3
"""Check flag rollback on an extra loopback API process using the isolated lab DBs."""
from datetime import datetime, timezone
import json
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from evidence_contract import run_evidence

from build_manifest import file_digest
from local_lab import REPO, ROOT, env, private_json
from receipt_readback import receipt_id, session_scope
from runtime_binding import available, artifacts_valid, manifest


def call(route, token, method='GET', payload=None):
    request = urllib.request.Request('http://127.0.0.1:18081' + route, method=method,
                                     data=None if payload is None else json.dumps(payload).encode(),
                                     headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        return error.code, None


def main():
    data, build_hash = manifest()
    artifacts_valid(data)
    available(18081)
    available(19091)
    account = json.loads((ROOT / 'campaign-account.json').read_text())
    token = account['api_key']
    collector = str(uuid.uuid4())
    session = session_scope(collector, 'codex', str(uuid.uuid4()))
    rid = receipt_id(account['user_id'], collector, 'codex', session)
    route = '/api/v2/me/work-sessions/' + rid
    values = env()
    values.update(SERVER_PORT='18081', ATOAXIS_METRICS_PORT='19091')
    binary = REPO / 'backend/api/target/release/wakaclock-server'
    statuses = {}
    for enabled in (False, True):
        values['ATOAXIS_WORK_SESSIONS_ENABLED'] = str(enabled).lower()
        with (ROOT / 'flag-check-server.log').open('a') as log:
            process = subprocess.Popen([str(binary)], cwd=ROOT, env=values, stdout=log, stderr=log)
            try:
                ready = False
                for _ in range(100):
                    if process.poll() is not None:
                        raise RuntimeError('isolated_server_exited')
                    try:
                        status, _ = call('/api/v2/me/work-sessions?limit=1', token)
                        if status == (200 if enabled else 503):
                            ready = True
                            break
                    except (OSError, urllib.error.URLError):
                        pass
                    time.sleep(0.1)
                if not ready:
                    raise RuntimeError('isolated_server_not_ready')
                if not enabled:
                    usage = {'usage_event_id': str(uuid.uuid4()), 'ai_session_id': session,
                             'collector_id': collector, 'occurred_at': datetime.now(timezone.utc).isoformat(),
                             'agent': 'codex', 'provider': 'openai', 'model': 'flag-fixture',
                             'prompt_count': 1, 'input_tokens': 0, 'token_source': 'transcript'}
                    statuses['disabled_ingest'] = call('/api/v1/ai/usage', token, 'POST', [usage])[0]
                    statuses['disabled_read'] = call(route, token)[0]
                    statuses['disabled_outcome'] = call(route + '/outcome', token, 'PUT', {'outcome': 'completed'})[0]
                    assert statuses == {'disabled_ingest': 200, 'disabled_read': 503, 'disabled_outcome': 503}
                else:
                    status, body = call(route, token)
                    statuses['restored_read'] = status
                    assert status == 200 and body['data']['usage_events'] == 1
                    assert body['data']['usage']['input_tokens']['value'] == 0
                    assert body['data']['usage']['output_tokens']['value'] is None
            finally:
                process.terminate()
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
    artifacts_valid(data)
    private_json(ROOT / 'evidence/flag-rollback.json', run_evidence(build_hash, __file__,
        dict.fromkeys(('flag_disabled', 'telemetry_continues', 'restart_persistence'), 'passed'),
        server_sha256=file_digest(binary), statuses=statuses,
        generated_at=datetime.now(timezone.utc).isoformat()))
    print('Flag rollback passed: ingest continued, reads/writes disabled, restart restored receipt.')


if __name__ == '__main__':
    main()
