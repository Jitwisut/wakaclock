#!/usr/bin/env python3
"""Persistent loopback-only receipt lab. Secrets stay in ignored, mode-0600 files."""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import urllib.request
import time

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / '.local' / 'receipt-validation'
API = 'http://127.0.0.1:18080'
UI = 'http://127.0.0.1:13000'


def private_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(data, stream, indent=2)
        stream.write('\n')
    path.chmod(0o600)


def config():
    return json.loads((ROOT / 'private.json').read_text())


def env():
    settings = config()
    # Explicitly override deployment flags; never inherit a hosted ingestion target.
    values = {k: v for k, v in os.environ.items() if not k.startswith(('ATOAXIS_', 'CLICKHOUSE_', 'POSTGRES_', 'REDIS_', 'WAKACLOCK_', 'PRESENCE_', 'LIVEKIT_'))}
    values.update({
        'SERVER_HOST': '127.0.0.1', 'SERVER_PORT': '18080',
        'POSTGRES_URL': f"postgresql://receipt_validation:{settings['db_password']}@127.0.0.1:55439/receipt_validation",
        'CLICKHOUSE_URL': 'http://127.0.0.1:58129', 'CLICKHOUSE_DATABASE': 'wakaclock',
        'CLICKHOUSE_USER': 'receipt_validation', 'CLICKHOUSE_PASSWORD': settings['db_password'],
        'JWT_SECRET': settings['jwt_secret'], 'CORS_ORIGINS': UI,
        'ATOAXIS_WORK_SESSIONS_ENABLED': 'true', 'ATOAXIS_MEASUREMENT_REPAIR_ENABLED': 'true',
        'ATOAXIS_METRICS_PORT': '19090',
        'RECEIPT_DB_PASSWORD': settings['db_password'], 'RUST_LOG': 'warn',
        'ATOAXIS_VALIDATION_BUILD': '1', 'NEXT_PUBLIC_WAKACLOCK_API_URL': API,
        'NEXT_PUBLIC_APP_URL': UI,
        'RECEIPT_QUEUE_PASSWORD': settings['queue_password'],
        'RECEIPT_STORAGE_PASSWORD': settings['storage_password'],
        'ATOAXIS_JOB_QUEUE_URL': f"amqp://receipt_validation:{settings['queue_password']}@127.0.0.1:55679/%2f",
        'ATOAXIS_ACCOUNT_DELETION_MODE': 'job',
        'ATOAXIS_OBJECT_STORE_S3_ENDPOINT': 'http://127.0.0.1:59000',
        'ATOAXIS_OBJECT_STORE_S3_BUCKET': 'receipt-validation',
        'ATOAXIS_OBJECT_STORE_S3_ACCESS_KEY': 'receipt_validation',
        'ATOAXIS_OBJECT_STORE_S3_SECRET_KEY': settings['storage_password'],
        'ATOAXIS_OBJECT_STORE_S3_REGION': 'us-east-1',
        'ATOAXIS_OBJECT_STORE_S3_PATH_STYLE': 'true',
        'ATOAXIS_OBJECT_STORE_ALLOW_HTTP': 'true',
        'ACCOUNT_DELETION_WORKER_HEALTH_HOST': '127.0.0.1',
        'ACCOUNT_DELETION_WORKER_HEALTH_PORT': '18082',
        'ATOAXIS_JOB_WORKER_HEALTH_HOST': '127.0.0.1',
        'ATOAXIS_JOB_WORKER_HEALTH_PORT': '18083',
    })
    return values


def request(route, method='GET', token=None, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(API + route, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read()
        return json.loads(body) if body else None


def bootstrap():
    settings = config()
    for identity in ('campaign', 'daily'):
        account_path = ROOT / f'{identity}-account.json'
        if account_path.exists():
            previous = json.loads(account_path.read_text())
            auth = request('/api/v1/auth/login', 'POST', payload={
                'username': previous['username'], 'password': previous['password'],
            })['data']
            private_json(account_path, {**previous, **auth})
            continue
        username = 'receipt-' + identity + '-' + settings['installation']
        password = secrets.token_urlsafe(32)
        auth = request('/api/v1/auth/register', 'POST', payload={'username': username, 'password': password})['data']
        key = request('/api/v1/users/current/api_key', 'POST', token=auth['token'])['data']['api_key']
        private_json(account_path, {**auth, 'password': password, 'api_key': key})
    print('Campaign and daily accounts ready; credentials retained in private local files.')


def collector_env(identity='campaign'):
    values = env()
    account = json.loads((ROOT / f'{identity}-account.json').read_text())
    # HOME here configures the child collector's actual home, never the operator's shell.
    values.update({'HOME': str(ROOT / identity / 'collector-home'),
                   'CODEX_HOME': str(ROOT / identity / 'codex-home'),
                   'CLAUDE_CONFIG_DIR': str(ROOT / identity / 'claude-home'),
                   'WAKACLOCK_SERVER_URL': API, 'WAKACLOCK_API_KEY': account['api_key']})
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init', 'up', 'stop', 'bootstrap', 'api', 'ui', 'worker', 'relay', 'readiness', 'collector', 'build', 'runtime', 'login', 'agent', 'auth-status', 'prepare-editor', 'editor', 'editor-status'])
    parser.add_argument('--identity', choices=['campaign', 'daily'], default='campaign')
    parser.add_argument('--tool', choices=['codex', 'claude-code'], default='codex')
    parser.add_argument('--receipts-disabled', action='store_true')
    parser.add_argument('--vsix', type=Path)
    args, extra = parser.parse_known_args()
    if args.action == 'init':
        ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
        ROOT.chmod(0o700)
        if not (ROOT / 'private.json').exists():
            private_json(ROOT / 'private.json', {'db_password': secrets.token_hex(24), 'jwt_secret': secrets.token_hex(48), 'installation': secrets.token_hex(4)})
        settings = config()
        for name in ('queue_password', 'storage_password'):
            settings.setdefault(name, secrets.token_hex(24))
        private_json(ROOT / 'private.json', settings)
        for identity in ('campaign', 'daily'):
            for name in ('collector-home', 'codex-home', 'claude-home', 'workspace'):
                (ROOT / identity / name).mkdir(parents=True, exist_ok=True, mode=0o700)
            for alias, target in [('.codex', 'codex-home'), ('.claude', 'claude-home')]:
                link = ROOT / identity / 'collector-home' / alias
                expected = ROOT / identity / target
                if link.is_symlink() and link.resolve() != expected.resolve():
                    raise ValueError('collector_home_alias_mismatch')
                if not link.exists():
                    link.symlink_to(expected, target_is_directory=True)
        (ROOT / 'evidence').mkdir(exist_ok=True)
        print('Initialized isolated receipt lab. Existing state was preserved.')
        return
    values = env()
    if args.action in ('up', 'stop'):
        from runtime_binding import available, stop_owned
        if args.action == 'stop':
            stop_owned()
        else:
            for name, port in [('postgres', 55439), ('clickhouse', 58129), ('rabbitmq', 55679), ('object-store', 59000)]:
                owner = subprocess.run(['docker', 'inspect', '--format', '{{index .Config.Labels "com.docker.compose.project"}}', 'atoaxis-receipt-validation-' + name + '-1'], capture_output=True, text=True)
                if owner.returncode or owner.stdout.strip() != 'atoaxis-receipt-validation':
                    available(port)
        command = ['docker', 'compose', '-f', str(Path(__file__).with_name('compose.yaml'))]
        command += ['up', '-d', '--wait'] if args.action == 'up' else ['stop']
        subprocess.run(command, env=values, check=True)
        if args.action == 'up':
            from local_s3 import request as s3_request
            for _ in range(30):
                try:
                    status, _ = s3_request(config(), 'PUT')
                    if status in (200, 409):
                        break
                    raise ValueError('lab_bucket_initialization_failed')
                except OSError:
                    time.sleep(0.5)
            else:
                raise ValueError('lab_object_store_not_ready')
    elif args.action == 'bootstrap':
        bootstrap()
    elif args.action == 'api':
        if args.receipts_disabled:
            values['ATOAXIS_WORK_SESSIONS_ENABLED'] = 'false'
        binary = str(REPO / 'backend/api/target/release/wakaclock-server')
        from runtime_binding import launch
        launch('api', [binary], ROOT, values, not args.receipts_disabled)
    elif args.action == 'ui':
        from runtime_binding import launch
        launch('ui', ['npm', 'run', 'start', '--', '--hostname', '127.0.0.1', '--port', '13000'], REPO / 'frontend/app', values)
    elif args.action in ('worker', 'relay'):
        from runtime_binding import launch
        name = 'account-deletion' if args.action == 'worker' else 'job-worker'
        values['ATOAXIS_METRICS_PORT'] = '19092' if args.action == 'worker' else '19093'
        launch(args.action, [str(REPO / 'backend/api/target/release' / name)], ROOT, values)
    elif args.action == 'readiness':
        from runtime_binding import preflight
        build_hash = preflight()
        print(json.dumps({'schema_version': 2, 'ready': True, 'build_manifest_sha256': build_hash}))
    elif args.action in ('prepare-editor', 'editor', 'editor-status'):
        from editor_profile import prepare, launch, verify_profile
        if args.action == 'prepare-editor':
            if not args.vsix:
                raise ValueError('vsix_required')
            report = prepare(args.identity, args.vsix)
        elif args.action == 'editor':
            report = launch(args.identity)
        else:
            report = verify_profile(args.identity)
        print(json.dumps(report))
    elif args.action == 'collector':
        from runtime_binding import manifest, artifacts_valid
        artifacts_valid(manifest()[0])
        values = collector_env(args.identity)
        os.chdir(ROOT)
        binary = str(REPO / 'backend/api/target/release/wakaclock')
        os.execve(binary, [binary, *extra], values)
    elif args.action in ('login', 'agent', 'auth-status'):
        values = collector_env(args.identity)
        os.chdir(ROOT / args.identity / 'workspace')
        binary = 'codex' if args.tool == 'codex' else 'claude'
        command = [binary]
        if args.action == 'login':
            command += ['login'] if args.tool == 'codex' else ['auth', 'login']
        elif args.action == 'auth-status':
            command += ['login', 'status'] if args.tool == 'codex' else ['auth', 'status']
            status = subprocess.run(command, env=values, capture_output=True, text=True, timeout=20)
            authenticated = status.returncode == 0
            if args.tool != 'codex' and authenticated:
                authenticated = json.loads(status.stdout).get('loggedIn') is True
            print(json.dumps({'agent': args.tool, 'isolated_auth_available': authenticated}))
            return
        else:
            command += extra
        os.execvpe(binary, command, values)
    elif args.action == 'build':
        from build_manifest import build
        build(values)
    elif args.action == 'runtime':
        subprocess.run(['python3', str(Path(__file__).with_name('capture_runtime.py')), '--output', str(ROOT / 'evidence/runtime.json'), '--collector-binary', str(REPO / 'backend/api/target/release/wakaclock')], cwd=REPO, check=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        print('Lab command failed; inspect private local logs. No credentials are printed.')
        raise SystemExit(2)
