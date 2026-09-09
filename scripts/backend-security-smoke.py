#!/usr/bin/env python3
"""Regression checks against two disposable API replicas sharing disposable databases.

Pass all URLs explicitly. Creates test accounts and alters only their credentials.
Refuses non-loopback targets; never reads application .env files.
"""
import argparse
import concurrent.futures
import hashlib
import json
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--api-a', required=True)
parser.add_argument('--api-b', required=True)
parser.add_argument('--postgres-test-url', required=True)
args = parser.parse_args()
for target in (args.api_a, args.api_b, args.postgres_test_url):
    if urllib.parse.urlparse(target).hostname not in ('localhost', '127.0.0.1', '::1'):
        parser.error('only disposable loopback test services are allowed')


def request(base, method, path, token=None, payload=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(base + path, headers=headers, method=method,
        data=json.dumps(payload).encode() if payload is not None else None)
    try:
        response = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    data = response.read()
    try:
        body = json.loads(data) if data else None
    except json.JSONDecodeError:
        body = None
    return response.status, body


def sql(statement):
    completed = subprocess.run(['psql', args.postgres_test_url, '-XAt', '-v', 'ON_ERROR_STOP=1', '-c', statement],
        check=True, text=True, capture_output=True)
    return completed.stdout.strip()


def check(status, actual, label):
    assert actual[0] == status, f'{label}: expected {status}, got {actual[0]}'
    print('PASS', label, flush=True)
    return actual[1]


username = 'audit-' + uuid.uuid4().hex
registration = {'username': username, 'password': 'disposable-test-password'}
with concurrent.futures.ThreadPoolExecutor() as pool:
    futures = [pool.submit(request, base, 'POST', '/api/v1/auth/register', payload=registration)
               for base in (args.api_a, args.api_b)]
    registrations = [future.result() for future in futures]
assert sorted(result[0] for result in registrations) == [200, 400], [r[0] for r in registrations]
print('PASS concurrent registration has one winner', flush=True)
registered = next(result[1]['data'] for result in registrations if result[0] == 200)
user, session = registered['user_id'], registered['token']
check(200, request(args.api_b, 'GET', '/api/v2/me', session), 'session works across replicas')
key = check(200, request(args.api_a, 'POST', '/api/v1/users/current/api_key', session), 'issue API key')['data']['api_key']
check(200, request(args.api_b, 'GET', '/api/v1/users/current', key), 'new key authenticates on B without reload')
metadata = check(200, request(args.api_b, 'GET', '/api/v1/users/current/api_key', session), 'key read returns no plaintext')
assert metadata['data']['api_key'] is None
check(200, request(args.api_a, 'DELETE', '/api/v1/users/current/api_key', session), 'revoke on A')
check(401, request(args.api_b, 'GET', '/api/v1/users/current', key), 'revoked key rejected on B')
key2 = check(200, request(args.api_b, 'POST', '/api/v1/users/current/api_key', session), 'rotate after revoke')['data']['api_key']
key2_hash = hashlib.sha256(key2.encode()).hexdigest()
sql(f"UPDATE api_keys SET expires_at = now() - interval '1 second' WHERE key_hash = '{key2_hash}';")
check(401, request(args.api_a, 'GET', '/api/v1/users/current', key2), 'key expiry enforced without cache refresh')
app, token_id, oauth = str(uuid.uuid4()), str(uuid.uuid4()), uuid.uuid4().hex
hash_value = hashlib.sha256(oauth.encode()).hexdigest()
sql(f"INSERT INTO oauth_apps(id, owner_user_id, name, client_id) VALUES ('{app}', '{user}', 'audit', '{app}'); "
    f"INSERT INTO oauth_access_tokens(id, app_id, user_id, token_hash, scopes, expires_at) "
    f"VALUES ('{token_id}', '{app}', '{user}', '{hash_value}', ARRAY['read_goals'], now() + interval '1 hour');")
check(200, request(args.api_b, 'GET', '/api/v2/me/goals', oauth), 'limited OAuth reads granted resource')
for method, path, payload in [
    ('PATCH', '/api/v2/profile', {'is_public': True}),
    ('POST', '/api/v2/organizations', {'name': 'not-allowed'}),
    ('POST', '/api/v1/reprocess', {'start': '2026-09-01', 'end': '2026-09-01', 'dry_run': False}),
]:
    result = request(args.api_b, method, path, oauth, payload)
    assert result[0] in (401, 403), (path, result[0])
    print('PASS OAuth denied', path, flush=True)
check(403, request(args.api_b, 'POST', '/api/v1/heartbeats.bulk', oauth, []), 'read-only OAuth cannot ingest')
sql(f"UPDATE oauth_access_tokens SET scopes = ARRAY[]::text[] WHERE id = '{token_id}';")
check(403, request(args.api_b, 'GET', '/api/v2/me/goals', oauth), 'empty OAuth grant is not an account credential')
sql(f"UPDATE oauth_access_tokens SET revoked_at = now() WHERE id = '{token_id}';")
check(401, request(args.api_a, 'GET', '/api/v2/me/goals', oauth), 'revoked OAuth rejected across replicas')
check(422, request(args.api_b, 'POST', '/api/v1/import/wakatime', session, {'file_path':'/etc/passwd'}), 'server-side import paths rejected')
for path, payload in [('/api/v2/exports', {'format':'json','scope':'all'}),
                      ('/api/v2/report-schedules', {'report_type':'daily'})]:
    check(503, request(args.api_b, 'POST', path, session, payload), 'unavailable processor refuses ' + path)
assert sql(f"SELECT count(*) FROM export_jobs WHERE user_id = '{user}'") == '0'
assert sql(f"SELECT count(*) FROM report_schedules WHERE user_id = '{user}'") == '0'
dump = json.dumps({'user': {}, 'days': [{'heartbeats': [{'entity':'a.py','type':'file','time':1788900000,'is_write':True}]}]})
first = check(200, request(args.api_b, 'POST', '/api/v1/import/wakatime', session, {'dump_json':dump}), 'JSON upload imports')
second = check(200, request(args.api_b, 'POST', '/api/v1/import/wakatime', session, {'dump_json':dump}), 'identical import retries')
assert first['data']['imported_heartbeats'] == 1
assert second['data']['imported_heartbeats'] == 0
# Kill only this disposable database's API connections. Pool must reconnect on the next request.
sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'wakaclock-server' AND pid <> pg_backend_pid();")
check(200, request(args.api_b, 'GET', '/api/v2/me', session), 'PostgreSQL pool recovers terminated connections')
session_hash = hashlib.sha256(session.encode()).hexdigest()
sql(f"UPDATE sessions SET revoked_at = now() WHERE token_hash = '{session_hash}';")
check(401, request(args.api_b, 'GET', '/api/v2/me', session), 'session revocation enforced on B')
print('All backend security smoke checks passed', flush=True)
