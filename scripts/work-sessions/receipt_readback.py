"""Exact-session verification. Raw identities/paths stay in memory, never in reports."""
import base64
import hashlib
import json
from pathlib import Path
import sqlite3
import urllib.parse
import urllib.request
import uuid

FIELDS = {
    'input_tokens': 'input_tokens', 'output_tokens': 'output_tokens',
    'cache_read_tokens': 'cache_read_tokens', 'cache_write_tokens': 'cache_write_tokens',
    'prompt_characters': 'prompt_character_count', 'estimated_cost_microusd': 'estimated_cost_microusd',
}


def digest_parts(parts):
    digest = hashlib.sha256()
    for part in parts:
        value = part.encode()
        digest.update(len(value).to_bytes(8, 'little') + value)
    return digest.hexdigest()


def session_scope(collector, agent, native):
    return 'ws1_' + digest_parts([collector, agent, native])


def receipt_id(user, collector, agent, session):
    uuid.UUID(user)
    uuid.UUID(collector)
    return hashlib.sha256(f'{user}:{len(agent.encode())}:{agent}:{collector}:{session}'.encode()).hexdigest()


def local_usage(home, agent, native):
    path = Path(home) / '.wakaclock/ai-attribution.sqlite3'
    if not path.is_file():
        return []
    with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as db:
        rows = db.execute('SELECT record_json FROM delivered_usage WHERE record_json IS NOT NULL').fetchall()
    records = [json.loads(row[0]) for row in rows]
    return [r for r in records if r.get('agent') == agent and r.get('collector_id')
            and r['ai_session_id'] == session_scope(r['collector_id'], agent, native)]


def loopback_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('loopback_origin_required')
    return url.rstrip('/')


class Reader:
    def __init__(self, api, key, ch, ch_user, ch_password):
        self.api, self.ch = loopback_url(api), loopback_url(ch)
        self.key, self.ch_user, self.ch_password = key, ch_user, ch_password

    def api_get(self, route):
        req = urllib.request.Request(self.api + route, headers={'Authorization': 'Bearer ' + self.key})
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read(16 * 1024 * 1024))['data']

    def rows(self, sql, **params):
        query = urllib.parse.urlencode({'param_' + k: v for k, v in params.items()})
        auth = base64.b64encode(f'{self.ch_user}:{self.ch_password}'.encode()).decode()
        req = urllib.request.Request(self.ch + '/?' + query, data=(sql + ' FORMAT JSON').encode(),
                                     headers={'Authorization': 'Basic ' + auth}, method='POST')
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read(16 * 1024 * 1024))['data']


def measured(values):
    present = [v for v in values if v is not None]
    return {'value': sum(present) if present else None, 'coverage': {
        'reported_events': len(present), 'total_events': len(values),
        'status': 'no_data' if not values else 'unavailable' if not present else 'complete' if len(present) == len(values) else 'partial',
    }}


def verify(reader, user, records, expected_event_ids=None):
    if not records:
        return {'status': 'failed', 'mismatches': ['no_delivered_usage_facts']}
    first = records[0]
    identity = (first['collector_id'], first['agent'], first['ai_session_id'])
    if any((r.get('collector_id'), r.get('agent'), r.get('ai_session_id')) != identity for r in records):
        return {'status': 'failed', 'mismatches': ['mixed_local_session_identity']}
    collector, agent, session = identity
    rid = receipt_id(user, collector, agent, session)
    params = dict(user=user, collector=collector, agent=agent, session=session)
    facts = reader.rows('SELECT usage_event_id, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, prompt_character_count, estimated_cost_microusd FROM wakaclock.ai_usage_events FINAL WHERE user_id={user:UUID} AND collector_id={collector:String} AND ai_agent={agent:String} AND ai_session_id={session:String}', **params)
    mismatches = []
    if {r['usage_event_id'] for r in records} != {r['usage_event_id'] for r in facts} or len(records) != len(facts):
        mismatches.append('usage_identity_or_count_mismatch')
    source = {r['usage_event_id']: r for r in records}
    for fact in facts:
        local = source.get(fact['usage_event_id'])
        if local is not None and any(local.get(field) != (int(fact[field]) if fact.get(field) is not None else None)
                                     for field in FIELDS.values() if field != 'estimated_cost_microusd'):
            mismatches.append('usage_capture_value_mismatch')
            break
    receipt = reader.api_get('/api/v2/me/work-sessions/' + rid)
    if receipt['id'] != rid or receipt['agent'] != agent or receipt['identity_status'] != 'scoped':
        mismatches.append('receipt_identity_mismatch')
    if receipt['usage_events'] != len(facts):
        mismatches.append('receipt_usage_count_mismatch')
    for output, field in FIELDS.items():
        expected = measured([int(r[field]) if r.get(field) is not None else None for r in facts])
        if receipt['usage'][output] != expected:
            mismatches.append(output + '_mismatch')
    # Compare the complete API evidence set with independently queried canonical winners.
    ops = reader.rows("SELECT entity, ifNull(ai_event_id, '') AS event, ifNull(ai_change_id, '') AS change_id, ifNull(heartbeat_id, '') AS heartbeat, revision FROM wakaclock.heartbeats_canonical WHERE user_id={user:UUID} AND machine={collector:String} AND session_id={session:String} AND (notEmpty(ifNull(ai_event_id,'')) OR notEmpty(ifNull(ai_change_id,'')))", **params)
    if expected_event_ids is not None and {r['event'] for r in ops} != set(expected_event_ids):
        mismatches.append('operation_capture_identity_mismatch')
    canonical = {digest_parts([user, session, r['event'] or r['change_id'] or r['heartbeat'], r['entity']]): int(r['revision']) for r in ops}
    evidence, cursor, seen_cursors = {}, None, set()
    for _ in range(101):
        suffix = '?limit=100' + ('&cursor=' + urllib.parse.quote(cursor, safe='') if cursor else '')
        page = reader.api_get('/api/v2/me/work-sessions/' + rid + '/evidence' + suffix)
        for operation in page['operations']:
            if operation['event_id'] in evidence:
                mismatches.append('duplicate_evidence')
            evidence[operation['event_id']] = operation['revision']
        cursor = page.get('next_cursor')
        if not page['has_more']:
            break
        if not cursor or cursor in seen_cursors:
            mismatches.append('invalid_evidence_pagination')
            break
        seen_cursors.add(cursor)
    else:
        mismatches.append('evidence_limit_exceeded')
    if evidence != canonical or receipt['evidence_count'] != len(canonical):
        mismatches.append('canonical_evidence_mismatch')
    return {'status': 'passed' if not mismatches else 'failed', 'receipt_id': rid,
            'revision_fingerprint': receipt['revision_fingerprint'], 'usage_events': len(facts),
            'operation_count': len(ops), 'mismatches': sorted(set(mismatches)),
            'coverage': {name: receipt['usage'][name]['coverage'] for name in FIELDS}}
