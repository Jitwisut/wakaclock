#!/usr/bin/env python3
"""Isolated local GitHub staging; never reads the personal runtime configuration.
Secrets and process evidence live only in ignored output/team-github-staging.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import signal
import time
import urllib.request
import urllib.error
import subprocess
import shutil
import platform
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/team-github-staging'
DEPLOY = ROOT / 'deployment/team-github'


def environment():
    OUT.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = OUT / 'environment.json'
    if not path.exists():
        values = {
            'TEAM_STAGE_POSTGRES_PASSWORD': secrets.token_hex(32),
            'TEAM_STAGE_CLICKHOUSE_PASSWORD': secrets.token_hex(32),
            'JWT_SECRET': secrets.token_hex(32),
            'ATOAXIS_KMS_KEY_ID': __import__('base64').b64encode(secrets.token_bytes(32)).decode(),
            'ATOAXIS_GITHUB_WEBHOOK_SECRET': secrets.token_hex(32),
        }
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(values, stream)
    values = json.loads(path.read_text())
    values.update({
        'POSTGRES_URL': 'postgresql://postgres:' + values['TEAM_STAGE_POSTGRES_PASSWORD'] + '@127.0.0.1:55442/atoaxis_team_github_staging',
        'CLICKHOUSE_URL': 'http://127.0.0.1:58133', 'CLICKHOUSE_DATABASE': 'wakaclock',
        'CLICKHOUSE_USER': 'stage', 'CLICKHOUSE_PASSWORD': values['TEAM_STAGE_CLICKHOUSE_PASSWORD'],
        'SERVER_HOST': '127.0.0.1', 'SERVER_PORT': '8410',
        'ATOAXIS_TEAM_ENABLED': 'true',
        'ATOAXIS_TEAM_PRIVACY_LEDGER_PATH': str(OUT / 'independent-privacy-ledger.json'),
        'ATOAXIS_INGEST_MODE': 'direct', 'ATOAXIS_AI_USAGE_INGEST_MODE': 'direct',
        'PRESENCE_V2_ENABLED': 'false', 'CORS_ORIGINS': 'http://127.0.0.1:3411',
    })
    # This file contains App identifiers and encrypted-vault path, never App secrets.
    app = OUT / 'github-app.json'
    if app.exists():
        config=json.loads(app.read_text())
        allowed={'ATOAXIS_GITHUB_APP_ID','ATOAXIS_GITHUB_CLIENT_ID','ATOAXIS_GITHUB_APP_SLUG','ATOAXIS_GITHUB_CREDENTIALS_PATH','ATOAXIS_GITHUB_PUBLIC_URL'}
        if set(config)-allowed:raise ValueError('GitHub staging config must contain metadata and encrypted-vault path only')
        values.update(config)
    return values


def app_manifest(origin):
    parsed = urllib.parse.urlparse(origin)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise ValueError('public origin must be a credential-free HTTPS origin')
    origin = origin.rstrip('/')
    return {
        'name': 'AtoAxis Team Staging', 'url': origin,
        'hook_attributes': {'url': origin + '/api/v2/team/webhooks/github', 'active': True},
                'callback_urls': [origin + '/dashboard/wakaclock/teams/github/callback'],
        'public': True,
        'default_permissions': {'metadata': 'read', 'pull_requests': 'read', 'issues': 'read', 'checks': 'read', 'statuses': 'read'},
        'default_events': ['installation', 'installation_repositories', 'pull_request', 'pull_request_review', 'issues', 'check_run', 'check_suite', 'status', 'repository'],
    }


def managed(command, origin, values):
    state_path=OUT/'managed-processes.json'
    state=json.loads(state_path.read_text()) if state_path.exists() else {}
    def owned(pid):
        result=subprocess.run(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],capture_output=True,text=True)
        return any(line.startswith('n'+str(OUT)) for line in result.stdout.splitlines())
    if command=='stop':
        for item in state.get('processes',[]):
            pid=item['pid']
            if owned(pid) and os.getpgid(pid)==pid:os.killpg(pid,signal.SIGTERM)
        state_path.write_text(json.dumps({'processes':[],'stopped_at':datetime.now(timezone.utc).isoformat()},indent=2))
        print('Stopped owned staging processes; database volumes and queues retained.')
        return
    if command=='status':
        print(json.dumps({'checked_at':datetime.now(timezone.utc).isoformat(),'processes':[{'name':p['name'],'running':owned(p['pid'])} for p in state.get('processes',[])],'github_app_configured':bool(values.get('ATOAXIS_GITHUB_APP_ID')),'certification':'pending'},indent=2))
        return
    if any(owned(p['pid']) for p in state.get('processes',[])):raise SystemExit('Managed staging is already running; stop it before changing builds.')
    for port in (8410,3410,3411):
        result=subprocess.run(['lsof','-tiTCP:'+str(port),'-sTCP:LISTEN'],capture_output=True,text=True)
        if result.stdout.strip():raise SystemExit('Staging port is already in use: '+str(port)+'; refuse to replace an unregistered listener.')
    if values.get('ATOAXIS_GITHUB_PUBLIC_URL') and origin!=values['ATOAXIS_GITHUB_PUBLIC_URL']:raise SystemExit('Tunnel origin differs from configured App; update callback/webhook URLs first.')
    if origin:app_manifest(origin)
    # Infrastructure is ready before receivers. Workers retry until API migrations exist.
    stage_env={k:v for k,v in os.environ.items() if not k.startswith(('ATOAXIS_','WAKACLOCK_','POSTGRES_','CLICKHOUSE_','REDIS_','JWT_','DATABASE_'))}
    stage_env.update(values)
    subprocess.run(['docker','compose','-f',str(DEPLOY/'compose.yaml'),'up','-d','--wait'],env=stage_env,check=True)
    commands=['api','webhook-worker','privacy-worker','ui','proxy']
    if values.get('ATOAXIS_GITHUB_APP_ID'):commands.insert(2,'github-worker')
    children=[]
    for name in commands:
        argv=['python3',str(Path(__file__).resolve()),name]
        if name=='ui' and origin:argv+=['--origin',origin]
        log_path=OUT/(name+'.log')
        fd=os.open(log_path,os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
        with os.fdopen(fd,'ab') as stream:
            process=subprocess.Popen(argv,cwd=OUT,env=stage_env,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
        children.append({'name':name,'pid':process.pid})
        state_path.write_text(json.dumps({'started_at':datetime.now(timezone.utc).isoformat(),'origin':origin or 'http://127.0.0.1:3411','processes':children},indent=2))
        if name=='api':
            deadline=time.monotonic()+300
            while True:
                if process.poll() is not None:raise SystemExit('Staging receiver exited; workers were not started. See private staging log.')
                try:
                    with urllib.request.urlopen('http://127.0.0.1:8410/health',timeout=2) as response:
                        if response.status==200:break
                except (urllib.error.URLError,TimeoutError):pass
                if time.monotonic()>deadline:raise SystemExit('Staging receiver readiness unconfirmed; workers were not started.')
                time.sleep(1)
    print('Staging processes started; builds/readiness are pending. Use status and verify readiness before connecting GitHub.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['start', 'stop', 'status', 'infra-up', 'infra-stop', 'api', 'webhook-worker', 'github-worker', 'privacy-worker', 'initialize-ledger', 'ui', 'proxy', 'tunnel', 'preflight', 'manifest'])
    parser.add_argument('--origin')
    args = parser.parse_args()
    values = environment()
    if args.command in ('start','stop','status'):
        managed(args.command,args.origin,values)
        return
    # Deliberately remove inherited application/provider configuration.
    env = {k: v for k, v in os.environ.items() if not k.startswith(('ATOAXIS_', 'WAKACLOCK_', 'POSTGRES_', 'CLICKHOUSE_', 'REDIS_', 'JWT_', 'DATABASE_'))}
    env.update(values)
    if values.get('ATOAXIS_GITHUB_PUBLIC_URL'): env['CORS_ORIGINS'] = values['ATOAXIS_GITHUB_PUBLIC_URL']
    if args.command in ('infra-up', 'infra-stop'):
        command = ['docker', 'compose', '-f', str(DEPLOY / 'compose.yaml')]
        command += ['up', '-d', '--wait'] if args.command == 'infra-up' else ['stop']
        subprocess.run(command, env=env, check=True)
    elif args.command == 'ui':
        # Next loads dotenv from its project root. A clean copy prevents loading real .env files.
        target = OUT / 'ui-project'
        ignored = shutil.ignore_patterns('node_modules', '.next', '.env*', 'coverage', 'test-results', 'playwright-report', 'build', '.git')
        shutil.copytree(ROOT / 'frontend/app', target, ignore=ignored, dirs_exist_ok=True)
        modules = target / 'node_modules'
        if not modules.exists(): modules.symlink_to(ROOT / 'frontend/app/node_modules', target_is_directory=True)
        origin = args.origin or 'http://127.0.0.1:3411'
        app_manifest(origin) if args.origin else None
        env.update({'NEXT_PUBLIC_WAKACLOCK_API_URL': origin, 'NEXT_PUBLIC_APP_URL': origin, 'AUTH_SECRET': values['JWT_SECRET']})
        for k in list(env):
            if k.startswith(('NEXT_PUBLIC_POSTHOG', 'NEXT_PUBLIC_GA_', 'POSTHOG_', 'ARCJET_')): env.pop(k)
        env['NODE_ENV'] = 'production'
        subprocess.run(['node', str(modules / 'next/dist/bin/next'), 'build', '--webpack'], cwd=target, env=env, check=True)
        subprocess.run(['node', str(modules / 'next/dist/bin/next'), 'start', '-p', '3410', '-H', '127.0.0.1'], cwd=target, env=env, check=True)
    elif args.command == 'proxy':
        subprocess.run(['caddy', 'run', '--config', str(DEPLOY / 'Caddyfile')], cwd=OUT, env=env, check=True)
    elif args.command == 'tunnel':
        subprocess.run(['cloudflared', 'tunnel', '--url', 'http://127.0.0.1:3411', '--no-autoupdate'], cwd=OUT, env=env, check=True)
    elif args.command == 'manifest':
        manifest = app_manifest(args.origin)
        path = OUT / 'app-manifest.json'
        path.write_text(json.dumps(manifest, indent=2))
        print('Prepared staging App manifest:', path)
    elif args.command == 'preflight':
        for key in ('ATOAXIS_GITHUB_APP_ID', 'ATOAXIS_GITHUB_CLIENT_ID', 'ATOAXIS_GITHUB_APP_SLUG', 'ATOAXIS_GITHUB_CREDENTIALS_PATH', 'ATOAXIS_GITHUB_PUBLIC_URL'):
            if not values.get(key): raise SystemExit('Missing staging configuration: ' + key)
        if not Path(values['ATOAXIS_GITHUB_CREDENTIALS_PATH']).is_file():raise SystemExit('Encrypted App credential envelope unavailable')
        if args.origin != values['ATOAXIS_GITHUB_PUBLIC_URL']: raise SystemExit('Tunnel origin changed: update App callbacks/webhook before continuing')
        manifest = app_manifest(args.origin)
        # User supplies the current configured URL snapshot after inspecting App settings.
        settings = json.loads((OUT / 'app-url-evidence.json').read_text())
        checked=datetime.fromisoformat(settings.get('checked_at','').replace('Z','+00:00'))
        if checked.tzinfo is None or not 0<=(datetime.now(timezone.utc)-checked).total_seconds()<=300:raise SystemExit('App callback evidence is stale: inspect settings again')
        if settings.get('webhook_url') != manifest['hook_attributes']['url'] or settings.get('callback_url') != manifest['callback_urls'][0]:
            raise SystemExit('App callback/webhook URL mismatch')
        print('Local URL preflight passed; live App permissions still require GitHub verification')
    else:
        binary = {'api': 'wakaclock-server', 'webhook-worker': 'team-webhook-worker', 'github-worker': 'team-github-worker', 'privacy-worker': 'team-privacy-worker', 'initialize-ledger': 'team-privacy-worker'}[args.command]
        revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        env['ATOAXIS_BUILD_REVISION'] = revision
        subprocess.run(['cargo', 'build', '--bin', binary], cwd=ROOT / 'backend/api', env=env, check=True)
        # Run outside the checkout so dotenv cannot load the personal backend .env.
        command = [str(ROOT / 'backend/api/target/debug' / binary)]
        if args.command == 'initialize-ledger': command += ['--initialize-ledger']
        subprocess.run(command, cwd=OUT, env=env, check=True)


if __name__ == '__main__':
    main()
