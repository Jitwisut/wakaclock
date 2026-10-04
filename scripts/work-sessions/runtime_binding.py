"""Bind owned lab processes to artifacts; reject stale processes before model calls."""
import json
import os
import signal
import socket
import subprocess
import time
import urllib.request
from datetime import datetime, timezone

from build_manifest import file_digest, source_digest, tree_digest
from local_lab import ROOT, REPO, private_json

SERVICES = {
    'api': (18080, '/health', 'server_sha256', 'wakaclock-server'),
    'ui': (13000, '/dashboard/wakaclock/heartbeats', 'frontend_sha256', None),
    'worker': (18082, '/ready', 'deletion_worker_sha256', 'account-deletion'),
    'relay': (18083, '/ready', 'job_worker_sha256', 'job-worker'),
}


def manifest():
    path = ROOT / 'evidence/build-manifest.json'
    return json.loads(path.read_text()), file_digest(path)


def artifacts_valid(data, require_source=True):
    if require_source and data['source_snapshot_sha256'] != source_digest():
        raise ValueError('source_build_mismatch')
    for key, name in [('collector_sha256', 'wakaclock'), ('server_sha256', 'wakaclock-server'),
                      ('deletion_worker_sha256', 'account-deletion'), ('job_worker_sha256', 'job-worker')]:
        if data.get(key) != file_digest(REPO / 'backend/api/target/release' / name):
            raise ValueError(key + '_mismatch')
    if data['frontend_sha256'] != tree_digest(REPO / 'frontend/app/build/receipt-validation'):
        raise ValueError('frontend_build_mismatch')


def process_identity(pid):
    result = subprocess.run(['ps', '-p', str(pid), '-o', 'lstart='], capture_output=True, text=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else None


def available(port):
    with socket.socket() as sock:
        try:
            sock.bind(('127.0.0.1', port))
        except OSError:
            raise ValueError('lab_port_in_use_' + str(port)) from None


def healthy(service):
    port, route, _, _ = SERVICES[service]
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}{route}', timeout=2) as response:
            return response.status == 200
    except OSError:
        return False


def launch(service, command, cwd, values, receipts_enabled=True):
    data, build_hash = manifest()
    artifacts_valid(data)
    available(SERVICES[service][0])
    child = subprocess.Popen(command, cwd=cwd, env=values, start_new_session=True)
    path = ROOT / 'processes' / (service + '.json')
    record = {'schema_version': 1, 'service': service, 'pid': child.pid,
              'process_identity': process_identity(child.pid), 'build_manifest_sha256': build_hash,
              'artifact_sha256': data[SERVICES[service][2]], 'receipts_enabled': receipts_enabled,
              'process_group': child.pid, 'started_at': datetime.now(timezone.utc).isoformat()}
    private_json(path, record)
    try:
        child.wait()
    except KeyboardInterrupt:
        os.killpg(child.pid, signal.SIGTERM)
        child.wait(timeout=15)
    finally:
        # Retain the audit record, but it can no longer satisfy preflight.
        private_json(path, {**record, 'stopped': True})
    if child.returncode:
        raise ValueError('lab_process_failed_' + service)


def verify_process(record, service, data, build_hash):
    if (record.get('service') != service or record.get('stopped') or
            record.get('build_manifest_sha256') != build_hash or
            record.get('artifact_sha256') != data.get(SERVICES[service][2]) or
            not record.get('process_identity') or
            process_identity(record.get('pid', 0)) != record['process_identity']):
        raise ValueError('lab_process_build_mismatch_' + service)
    if service == 'api' and not record.get('receipts_enabled'):
        raise ValueError('receipts_disabled')


def preflight(services=('api', 'ui', 'worker', 'relay')):
    data, build_hash = manifest()
    artifacts_valid(data)
    for service in services:
        record = json.loads((ROOT / 'processes' / (service + '.json')).read_text())
        verify_process(record, service, data, build_hash)
        if not healthy(service):
            raise ValueError('lab_process_not_ready_' + service)
    return build_hash


def stop_owned():
    for service in SERVICES:
        path = ROOT / 'processes' / (service + '.json')
        if not path.exists():
            continue
        record = json.loads(path.read_text())
        if (not record.get('stopped') and record.get('process_identity') and
                process_identity(record['pid']) == record['process_identity']):
            if record.get('process_group') == record['pid']:
                os.killpg(record['pid'], signal.SIGTERM)
            else:
                os.kill(record['pid'], signal.SIGTERM)
