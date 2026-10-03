#!/usr/bin/env python3
"""Bounded native-agent campaign for the isolated receipt lab; never certifies itself."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import uuid

from build_manifest import file_digest
from local_lab import API, REPO, ROOT, collector_env, config, private_json
from receipt_readback import Reader, local_usage, verify
from runtime_binding import preflight

SCENARIOS = ('single-file', 'multi-file', 'create-delete-rename', 'failure-no-op', 'retry-dedup')
MARKER = 'receipt fixture\n'


def process(command, cwd, values, timeout):
    # Bound memory and keep native output out of shared evidence/logs.
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        completed = subprocess.run(command, cwd=cwd, env=values, stdout=stdout, stderr=stderr,
                                   timeout=timeout, check=False)
        if stdout.tell() + stderr.tell() > 2 * 1024 * 1024:
            raise ValueError('native_output_limit_exceeded')
        stdout.seek(0)
        stderr.seek(0)
        return subprocess.CompletedProcess(command, completed.returncode,
                                           stdout.read().decode('utf-8', errors='replace'),
                                           stderr.read().decode('utf-8', errors='replace'))


def deliver(sync, workspace, values, timeout=90):
    """Drain deferred telemetry within one deadline. This never invokes a model."""
    deadline = time.monotonic() + timeout
    attempts = 0
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False, attempts
        sent = process(sync, workspace, values, remaining)
        attempts += 1
        status = json.loads(sent.stdout)
        if sent.returncode == 0 and status.get('sent') is True:
            return True, attempts
        if (status.get('deferred_reason') not in ('backoff', 'already_running', 'sqlite_busy')
                or status.get('unresolved_conflicts', 0) or status.get('last_error') not in (None, 'already_running')):
            return False, attempts
        time.sleep(min(1, max(0, deadline - time.monotonic())))


def utc():
    return datetime.now(timezone.utc).isoformat()


def native_failure_code(completed):
    """Classify failures without retaining vendor output, account details or prompts."""
    output = (completed.stdout + '\n' + completed.stderr).lower()
    if 'usage_limit_exceeded' in output or 'hit your usage limit' in output:
        return 'native_usage_limit_exceeded'
    if 'not logged in' in output or 'authentication_error' in output:
        return 'native_authentication_failed'
    return 'native_execution_failed'


def expected_files(scenario):
    return {'single-file': {'single.txt': MARKER}, 'multi-file': {'multi-a.txt': MARKER, 'multi-b.txt': MARKER},
            'create-delete-rename': {'created.txt': MARKER, 'rename-target.txt': 'seed\n'},
            'failure-no-op': {}, 'retry-dedup': {'retry.txt': MARKER}}[scenario]


def prompt(scenario, agent):
    method = 'apply_patch' if agent == 'codex' else 'Edit/Write tools and only the necessary file move/delete commands'
    files = expected_files(scenario)
    if not files:
        return 'Do not invoke tools or change files. Respond with the word ready.'
    text = f'In this disposable fixture directory use {method}. Create exactly these files with the specified complete content: {json.dumps(files)}. Do not create other files.'
    if scenario == 'create-delete-rename':
        text += ' Move rename-source.txt to rename-target.txt, preserving its contents, and delete delete-me.txt.'
    return text


def run(agent, execute=False, selected=SCENARIOS, timeout=300):
    try:
        return run_campaign(agent, execute, selected, timeout)
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        # Never print exceptions containing local credentials or transcript text.
        return {'schema_version': 2, 'artifact_kind': 'receipt_campaign', 'agent': agent,
                'evidence_kind': 'controlled_live', 'review_status': 'pending', 'promotable': False,
                'scenarios': [], 'blockers': ['campaign_preflight_failed'], 'finished_at': utc()}


def run_campaign(agent, execute=False, selected=SCENARIOS, timeout=300):
    if not selected or len(set(selected)) != len(selected) or any(s not in SCENARIOS for s in selected):
        raise ValueError('invalid_scenarios')
    run_id = uuid.uuid4().hex
    result = {'schema_version': 2, 'artifact_kind': 'receipt_campaign', 'run_id': run_id,
              'agent': agent, 'started_at': utc(), 'evidence_kind': 'controlled_live',
              'review_status': 'pending', 'promotable': False, 'scenarios': [], 'blockers': []}
    if not execute:
        result['blockers'].append('campaign_not_enabled')
        return result
    manifest_path = ROOT / 'evidence/build-manifest.json'
    if not manifest_path.is_file():
        result['blockers'].append('tested_build_manifest_missing')
        return result
    manifest = json.loads(manifest_path.read_text())
    try:
        result['build_manifest_sha256'] = preflight()
    except (OSError, ValueError, KeyError):
        result['blockers'].append('lab_build_or_process_not_ready')
        return result
    collector = REPO / 'backend/api/target/release/wakaclock'
    if manifest['collector_sha256'] != file_digest(collector):
        result['blockers'].append('collector_build_mismatch')
        return result
    result['build_manifest_sha256'] = file_digest(manifest_path)
    result['collector_sha256'] = manifest['collector_sha256']
    values = collector_env('campaign')
    agent_home = ROOT / 'campaign' / ('codex-home' if agent == 'codex' else 'claude-home')
    values['CODEX_HOME' if agent == 'codex' else 'CLAUDE_CONFIG_DIR'] = str(agent_home)
    executable = shutil.which('codex' if agent == 'codex' else 'claude')
    if not executable:
        result['blockers'].append('agent_executable_missing')
        return result
    version = process([executable, '--version'], ROOT, values, 20)
    if version.returncode:
        result['blockers'].append('agent_version_unavailable')
        return result
    result['agent_version'] = version.stdout.strip()[:128]
    auth = process([executable, 'login', 'status'] if agent == 'codex' else [executable, 'auth', 'status'], ROOT, values, 20)
    authenticated = auth.returncode == 0
    if agent != 'codex' and authenticated:
        try:
            authenticated = json.loads(auth.stdout).get('loggedIn') is True
        except (ValueError, AttributeError):
            authenticated = False
    if not authenticated:
        result['blockers'].append('isolated_agent_login_required')
        return result
    account = json.loads((ROOT / 'campaign-account.json').read_text())
    settings = config()
    reader = Reader(API, account['api_key'], 'http://127.0.0.1:58129', 'receipt_validation', settings['db_password'])
    # Preflight before consuming a native-agent call.
    reader.api_get('/api/v2/me/work-sessions?limit=1')
    for scenario in selected:
        workspace = ROOT / 'campaign/workspace' / run_id / scenario
        workspace.mkdir(parents=True, mode=0o700)
        ground_truth = {'scenario': scenario, 'recorded_at': utc(), 'expected_file_count': len(expected_files(scenario)),
                        'expected_final_line_count': len(expected_files(scenario)), 'human_intervals': None,
                        'agent_intervals': None, 'expected_usage_tokens': None}
        private_json(workspace.parent / (scenario + '-ground-truth.json'), ground_truth)
        if scenario == 'create-delete-rename':
            (workspace / 'rename-source.txt').write_text('seed\n')
            (workspace / 'delete-me.txt').write_text('seed\n')
        process(['git', 'init', '-q'], workspace, values, 20).check_returncode()
        native = str(uuid.uuid4()) if agent != 'codex' else None
        if agent == 'codex':
            command = [executable, 'exec', '--json', '--cd', str(workspace), '--skip-git-repo-check', '--approve-for-me', prompt(scenario, agent)]
        else:
            command = [executable, '--print', '--output-format', 'json', '--session-id', native,
                       '--permission-mode', 'acceptEdits', '--strict-mcp-config', '--setting-sources', 'user',
                       '--tools', 'Read,Edit,Write,Bash', '--allowedTools', 'Read,Edit,Write,Bash(mv rename-source.txt rename-target.txt),Bash(rm delete-me.txt)',
                       '--max-budget-usd', '1', prompt(scenario, agent)]
        row = {'scenario': scenario, 'status': 'failed', 'ground_truth_recorded_at': ground_truth['recorded_at'], 'mismatches': [],
               'stages': {stage: 'not_run' for stage in ('native', 'fixture', 'capture', 'delivery', 'receipt', 'replay')}}
        result['scenarios'].append(row)
        try:
            completed = process(command, workspace, values, timeout)
            if completed.returncode:
                row['stages']['native'] = 'failed'
                row['mismatches'].append(native_failure_code(completed))
                row['native_exit_code'] = completed.returncode
                continue
            row['stages']['native'] = 'passed'
            if agent == 'codex':
                for line in completed.stdout.splitlines():
                    try:
                        event = json.loads(line)
                        if event.get('type') == 'thread.started':
                            native = event.get('thread_id')
                    except ValueError:
                        pass
            if not native:
                row['mismatches'].append('native_session_identity_missing')
                continue
            candidates = list(agent_home.glob('sessions/**/*' + native + '*.jsonl')) if agent == 'codex' else list(agent_home.glob('projects/**/' + native + '.jsonl'))
            if len(candidates) != 1:
                row['mismatches'].append('exact_transcript_unavailable')
                continue
            # Reparse before sync using the read-only collector inventory. Never retain its paths/native IDs.
            inventory = process([str(collector), 'ai', 'repair', '--agent', agent, '--transcript', str(candidates[0]), '--dry-run', '--json'], workspace, values, 90)
            if inventory.returncode:
                row['mismatches'].append('transcript_inventory_failed')
                row['stages']['capture'] = 'failed'
                continue
            parsed = json.loads(inventory.stdout)
            if parsed.get('truncated_candidates') or parsed.get('warnings'):
                row['mismatches'].append('transcript_inventory_incomplete')
                row['stages']['capture'] = 'failed'
                continue
            references = parsed['candidates']
            if any(r.get('session_id') != native or r.get('agent') != agent for r in references):
                row['mismatches'].append('transcript_inventory_identity_mismatch')
                continue
            expected_ids = {r['event_id'] for r in references}
            row['expected_operation_count'] = len(expected_ids)
            row['stages']['capture'] = 'passed'
            actual = {str(p.relative_to(workspace)): p.read_text() for p in workspace.rglob('*') if p.is_file() and '.git' not in p.relative_to(workspace).parts}
            if actual != expected_files(scenario):
                row['mismatches'].append('independent_fixture_diff_mismatch')
            row['stages']['fixture'] = 'passed' if actual == expected_files(scenario) else 'failed'
            sync = [str(collector), 'sync', '--agent', agent, '--transcript', str(candidates[0]), '--from-start', '--json']
            delivered, attempts = deliver(sync, workspace, values)
            row['delivery_attempts'] = attempts
            if not delivered:
                row['stages']['delivery'] = 'failed'
                row['mismatches'].append('collector_delivery_incomplete')
                continue
            row['stages']['delivery'] = 'passed'
            records = local_usage(values['HOME'], agent, native)
            check = verify(reader, account['user_id'], records, expected_ids)
            row['stages']['receipt'] = check['status']
            prior_mismatches = list(row['mismatches'])
            row.update(check)
            row['mismatches'] = sorted(set(prior_mismatches + check['mismatches']))
            if actual != expected_files(scenario):
                row['mismatches'].append('independent_fixture_diff_mismatch')
            if scenario != 'failure-no-op' and row.get('operation_count', 0) == 0:
                row['mismatches'].append('missing_operation_evidence')
            if scenario == 'failure-no-op' and row.get('operation_count', 0) != 0:
                row['mismatches'].append('unexpected_noop_operation')
            replayed, attempts = deliver(sync, workspace, values)
            row['replay_attempts'] = attempts
            if not replayed:
                row['mismatches'].append('replay_delivery_incomplete')
            repeated = verify(reader, account['user_id'], local_usage(values['HOME'], agent, native), expected_ids)
            if repeated != check:
                row['mismatches'].append('replay_changed_receipt')
            row['stages']['replay'] = 'failed' if any(m.startswith('replay_') for m in row['mismatches']) else 'passed'
            row['status'] = 'passed' if not row['mismatches'] else 'failed'
        except (OSError, ValueError, KeyError, subprocess.SubprocessError):
            row['status'] = 'failed'
            row['mismatches'].append('campaign_step_failed')
            for stage, status in row['stages'].items():
                if status == 'not_run':
                    row['stages'][stage] = 'blocked'
    result['schema_version'] = 2
    result['finished_at'] = utc()
    try:
        if preflight() != result['build_manifest_sha256']:
            result['blockers'].append('build_changed_during_campaign')
    except (OSError, ValueError, KeyError):
        result['blockers'].append('build_changed_during_campaign')
    return result


def save_report(output, result):
    output = Path(output)
    private_json(output, result)
    from observation import campaign_passed
    from evidence_contract import run_evidence
    build_hash = result.get('build_manifest_sha256')
    if build_hash and campaign_passed(result, result['agent'], build_hash):
        name = 'codex_native' if result['agent'] == 'codex' else 'claude_native'
        evidence = run_evidence(build_hash, __file__, {name: 'passed'},
                                sample_count=len(result['scenarios']), native_campaign=result)
        private_json(output.with_name(output.stem + '-evidence.json'), evidence)


def main(agent=None):
    parser = argparse.ArgumentParser(description=__doc__)
    if agent is None:
        parser.add_argument('--agent', choices=['codex', 'claude-code'], required=True)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--scenario', choices=SCENARIOS, action='append')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = run(agent or args.agent, args.execute, args.scenario or SCENARIOS)
    save_report(args.output, result)
    print(json.dumps({'agent': result['agent'], 'blockers': result['blockers'], 'scenarios': len(result['scenarios']), 'promotable': False}))
    return 0 if result['scenarios'] and all(r['status'] == 'passed' for r in result['scenarios']) and not result['blockers'] else 2


if __name__ == '__main__':
    sys.exit(main())
