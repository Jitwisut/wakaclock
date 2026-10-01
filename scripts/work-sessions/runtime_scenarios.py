"""Prepare independent fixtures, record local capture, then verify lab readback.

This tool never calls a model, changes network connectivity, or sleeps the computer.
Capture snapshots must be taken before queue delivery. Missing snapshots stay blocked.
"""
import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
import sqlite3
import uuid

from build_manifest import file_digest
from local_lab import ROOT, API, collector_env, env, private_json
from receipt_campaign import process
from receipt_readback import Reader, local_usage, session_scope, verify
from runtime_binding import preflight

SCENARIOS = ('human_only', 'ai_only', 'human_after_ai', 'formatter', 'two_agents',
             'offline_retry', 'restart_resume', 'idle', 'sleep_wake')
EVENTS = ('human_active', 'human_idle', 'agent_start', 'agent_stop', 'sleep', 'wake',
          'offline', 'online', 'restart', 'resume', 'capture')
SOURCES = ('operator_observed', 'editor', 'agent_hook', 'os_event')
EXPECTED = {
    'human_only': 'seed\nhuman\n', 'ai_only': 'seed\nagent\n',
    'human_after_ai': 'seed\nagent\nhuman\n', 'formatter': 'seed\nformatted\n',
    'two_agents': 'seed\ncodex\nclaude\n', 'offline_retry': 'seed\nagent\n',
    'restart_resume': 'seed\nagent\nresumed\n', 'idle': 'seed\nhuman\n',
    'sleep_wake': 'seed\nhuman\n',
}


def utc():
    return datetime.now(timezone.utc).isoformat()


def intervals(events, start_event, end_event):
    result, active = [], None
    previous = float('-inf')
    for event in events:
        at = event['timestamp']
        if not isinstance(at, (float, int)) or not math.isfinite(at) or at < previous:
            raise ValueError('unordered_or_invalid_interval_evidence')
        previous = at
        if event['event'] == start_event:
            if active is not None:
                raise ValueError('duplicate_interval_start')
            active = at
        elif event['event'] == end_event:
            if active is None:
                raise ValueError('interval_end_without_start')
            result.append((active, at))
            active = None
        elif event['event'] == 'sleep' and active is not None:
            result.append((active, at))
            active = None
    return None if active is not None or not result else result


def union_seconds(values):
    if values is None:
        return None
    total, end = 0, float('-inf')
    for start, stop in sorted(values):
        if not all(math.isfinite(x) for x in (start, stop)) or stop < start:
            raise ValueError('invalid_interval')
        total += max(0, stop - max(start, end))
        end = max(end, stop)
    return total


def interval_reference(events):
    human = intervals(events, 'human_active', 'human_idle')
    agent = intervals(events, 'agent_start', 'agent_stop')
    h, a = union_seconds(human), union_seconds(agent)
    combined = union_seconds(human + agent) if human is not None and agent is not None else None
    return {'human_seconds': h, 'agent_seconds': a, 'combined_seconds': combined,
            'overlap_seconds': h + a - combined if combined is not None else None,
            'basis': 'independent_recorded_intervals_not_usage_event_gaps'}


def snapshot_queue(home, workspace):
    path = Path(home) / '.wakaclock/queue.db'
    if not path.is_file():
        return []
    rows = []
    with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as db:
        for (payload,) in db.execute('SELECT payload FROM heartbeat_queue WHERE destination=?', (API,)):
            value = json.loads(payload)
            entity = value.get('entity')
            if isinstance(entity, str) and Path(entity).resolve().is_relative_to(workspace.resolve()):
                rows.append(value)
    return rows


def check_fixture(workspace, scenario):
    actual = {str(p.relative_to(workspace)): p.read_text() for p in workspace.rglob('*')
              if p.is_file() and '.git' not in p.relative_to(workspace).parts}
    return actual == {'fixture.txt': EXPECTED[scenario]}


def check_capture(rows, canonical):
    mismatches = []
    if not rows:
        return ['queue_capture_missing']
    latest = {}
    for row in rows:
        key = row.get('heartbeat_id')
        if not key:
            mismatches.append('capture_identity_missing')
            continue
        if key not in latest or row.get('revision', 0) > latest[key].get('revision', 0):
            latest[key] = row
    remote = {row['heartbeat_id']: row for row in canonical}
    if len(remote) != len(canonical) or set(remote) != set(latest):
        mismatches.append('canonical_capture_identity_or_count_mismatch')
    for key, local in latest.items():
        if key not in remote:
            continue
        for field in ('session_id', 'ai_agent', 'identity_source', 'identity_status'):
            if (local.get(field) or None) != (remote[key].get(field) or None):
                mismatches.append('capture_' + field + '_mismatch')
        if int(remote[key]['revision']) != local.get('revision', 0):
            mismatches.append('capture_revision_mismatch')
    return sorted(set(mismatches))


def verify_run(record, workspace, reader, account, values, build):
    if record['build_manifest_sha256'] != build:
        raise ValueError('runtime_build_changed')
    mismatches, blockers = [], []
    if not check_fixture(workspace, record['scenario']):
        mismatches.append('independent_fixture_diff_mismatch')
    captures = record.get('captures', [])
    start = datetime.fromisoformat(record['started_at']).timestamp()
    canonical = reader.rows('SELECT heartbeat_id, session_id, ai_agent, identity_source, identity_status, revision FROM wakaclock.heartbeats_canonical WHERE user_id={user:UUID} AND startsWith(entity,{prefix:String}) AND time >= {start:Float64}',
                            user=account['user_id'], prefix=str(workspace.resolve()) + '/', start=start)
    capture_issues = check_capture(captures, canonical)
    if 'queue_capture_missing' in capture_issues:
        blockers.append('queue_capture_missing')
    mismatches.extend(x for x in capture_issues if x != 'queue_capture_missing')
    sources = {row.get('identity_source') for row in captures}
    if record['capture_mode'] == 'live_hook' and 'agent_hook' not in sources:
        blockers.append('live_hook_evidence_missing')
    if record['capture_mode'] == 'live_editor' and not any('vscode' in str(row.get('plugin', '')).lower() for row in captures):
        blockers.append('live_editor_evidence_missing')
    sessions = record.get('sessions', {})
    if record['scenario'] in ('ai_only', 'human_after_ai', 'two_agents', 'offline_retry', 'restart_resume') and not sessions:
        blockers.append('native_session_reference_missing')
    if record['scenario'] == 'two_agents' and set(sessions) != {'codex', 'claude-code'}:
        blockers.append('both_native_agents_required')
    receipts = []
    for agent, native in sessions.items():
        agent_home = Path(values['CODEX_HOME'] if agent == 'codex' else values['CLAUDE_CONFIG_DIR'])
        pattern = 'sessions/**/*' + native + '*.jsonl' if agent == 'codex' else 'projects/**/' + native + '.jsonl'
        candidates = list(agent_home.glob(pattern))
        if len(candidates) != 1:
            blockers.append('exact_transcript_unavailable')
            continue
        from local_lab import REPO
        inventory = process([str(REPO / 'backend/api/target/release/wakaclock'), 'ai', 'repair', '--agent', agent,
                             '--transcript', str(candidates[0]), '--dry-run', '--json'], workspace, values, 90)
        if inventory.returncode:
            blockers.append('transcript_inventory_failed')
            continue
        parsed = json.loads(inventory.stdout)
        references = parsed.get('candidates', [])
        if parsed.get('warnings') or parsed.get('truncated_candidates') or any(r.get('session_id') != native or r.get('agent') != agent for r in references):
            mismatches.append('transcript_inventory_incomplete_or_wrong_session')
            continue
        result = verify(reader, account['user_id'], local_usage(values['HOME'], agent, native), {r['event_id'] for r in references})
        mismatches.extend(result['mismatches'])
        if result['status'] == 'passed':
            receipts.append({key: result[key] for key in ('receipt_id', 'revision_fingerprint', 'usage_events', 'operation_count')})
    events = record['events']
    required = {'idle': ('human_active', 'human_idle'), 'sleep_wake': ('sleep', 'wake'),
                'offline_retry': ('offline', 'online'), 'restart_resume': ('restart', 'resume')}.get(record['scenario'], ())
    if not set(required).issubset(e['event'] for e in events):
        blockers.append('required_runtime_events_missing')
    reference = interval_reference(events)
    status = 'failed' if mismatches else 'blocked' if blockers else 'passed'
    return {'schema_version': 3, 'evidence_kind': 'validation_run', 'build_manifest_sha256': build,
            'runner': 'runtime_scenarios', 'runner_sha256': file_digest(Path(__file__)), 'sample_count': 1,
            'status': status, 'blockers': sorted(set(blockers)), 'mismatches': sorted(set(mismatches)),
            'scenarios': [{'scenario': record['scenario'], 'status': status, 'mismatches': sorted(set(mismatches))}],
            'capture_mode': record['capture_mode'], 'captured_count': len(captures), 'canonical_count': len(canonical),
            'interval_reference': reference, 'receipts': receipts, 'review_status': 'pending', 'promotable': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='action', required=True)
    prepare = commands.add_parser('prepare')
    prepare.add_argument('--scenario', choices=SCENARIOS, required=True)
    prepare.add_argument('--capture-mode', choices=('live_editor', 'live_hook', 'transcript_import'), required=True)
    record = commands.add_parser('record')
    record.add_argument('--run', required=True)
    record.add_argument('--event', choices=EVENTS, required=True)
    record.add_argument('--source', choices=SOURCES, default='operator_observed')
    record.add_argument('--agent', choices=('codex', 'claude-code'))
    record.add_argument('--native-session')
    check = commands.add_parser('verify')
    check.add_argument('--run', required=True)
    args = parser.parse_args()
    build = preflight()
    values = collector_env('campaign')
    if args.action == 'prepare':
        alias = uuid.uuid4().hex
        workspace = ROOT / 'campaign/workspace/runtime' / alias
        workspace.mkdir(parents=True, mode=0o700)
        (workspace / 'fixture.txt').write_text('seed\n')
        private_json(ROOT / 'runtime-runs' / (alias + '.json'), {
            'schema_version': 1, 'run_id': alias, 'scenario': args.scenario,
            'capture_mode': args.capture_mode, 'started_at': utc(), 'build_manifest_sha256': build,
            'events': [], 'captures': [], 'sessions': {}, 'verified': False})
        print(json.dumps({'run_id': alias, 'expected_fixture': EXPECTED[args.scenario],
                          'workspace_relative': 'campaign/workspace/runtime/' + alias}))
        return
    if not re.fullmatch('[0-9a-f]{32}', args.run):
        raise ValueError('invalid_run_reference')
    path = ROOT / 'runtime-runs' / (args.run + '.json')
    record = json.loads(path.read_text())
    if record['verified'] or record['build_manifest_sha256'] != build:
        raise ValueError('run_finished_or_build_changed')
    workspace = ROOT / 'campaign/workspace/runtime' / args.run
    if args.action == 'record':
        if args.native_session:
            if not args.agent or not re.fullmatch('[A-Za-z0-9_-]{1,128}', args.native_session):
                raise ValueError('invalid_native_session_reference')
            previous = record['sessions'].get(args.agent)
            if previous and previous != args.native_session:
                raise ValueError('native_session_changed')
            record['sessions'][args.agent] = args.native_session
        record['events'].append({'event': args.event, 'timestamp': datetime.now(timezone.utc).timestamp(), 'source': args.source})
        if args.event == 'capture':
            record['captures'].extend(snapshot_queue(values['HOME'], workspace))
        private_json(path, record)
        print(json.dumps({'run_id': args.run, 'recorded_event': args.event}))
    else:
        account = json.loads((ROOT / 'campaign-account.json').read_text())
        config = env()
        reader = Reader(API, account['api_key'], config['CLICKHOUSE_URL'], config['CLICKHOUSE_USER'], config['CLICKHOUSE_PASSWORD'])
        report = verify_run(record, workspace, reader, account, values, build)
        if preflight() != build:
            raise ValueError('build_changed_during_readback')
        private_json(ROOT / 'evidence/runtime' / (args.run + '.json'), report)
        private_json(path, {**record, 'verified': True})
        print(json.dumps(report))


if __name__ == '__main__':
    main()
