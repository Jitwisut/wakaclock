#!/usr/bin/env python3
"""Record independent daily ground truth and report readiness without inventing elapsed days."""
import argparse
from datetime import datetime, timezone
import json
import re
import uuid
from pathlib import Path
from local_lab import ROOT, private_json, request, daily_blockers
from build_manifest import file_digest
from checks import report_errors
from receipt_readback import digest_parts
from runtime_binding import preflight

AGENTS = ('codex', 'claude-code')


def now():
    return datetime.now(timezone.utc)


def campaign_passed(report, expected_agent, build_hash):
    from receipt_campaign import SCENARIOS
    rows = report.get('scenarios', [])
    return (report.get('schema_version') == 2 and report.get('agent') == expected_agent
            and report.get('evidence_kind') == 'controlled_live'
            and report.get('build_manifest_sha256') == build_hash
            and not report.get('blockers')
            and len(rows) == len(SCENARIOS)
            and {row.get('scenario') for row in rows} == set(SCENARIOS)
            and all(row.get('status') == 'passed' and not row.get('mismatches') for row in rows)
            and all(
                set(row.get('stages', {})) == {'native', 'fixture', 'capture', 'delivery', 'receipt', 'replay'}
                and all(status == 'passed' for status in row['stages'].values()) for row in rows))


def finish_record(record, receipt, receipt_id, owner, build_hash, reviewed, mismatches, current=None):
    """Ownership is enforced by the authenticated detail API and pinned at begin."""
    if record.get('receipt_id'):
        raise ValueError('observation_already_finished')
    if record.get('build_manifest_sha256') != build_hash:
        raise ValueError('build_changed_during_observation')
    if record.get('owner_reference') != digest_parts(['observation-owner', owner]):
        raise ValueError('observation_owner_changed')
    if receipt.get('id') != receipt_id:
        raise ValueError('receipt_reference_mismatch')
    if receipt.get('agent') != record['agent']:
        raise ValueError('agent_mismatch')
    current = current or now()
    started = datetime.fromisoformat(record['started_at']).timestamp()
    if not started <= receipt['observed_window']['start'] <= current.timestamp():
        raise ValueError('ground_truth_must_precede_new_session')
    return {**record, 'receipt_id': receipt_id, 'revision_fingerprint': receipt['revision_fingerprint'],
            'finished_at': current.isoformat(), 'ground_truth_before_readback': True,
            'reviewed': reviewed, 'mismatches': mismatches,
            'max_ingestion_lag_seconds': receipt['diagnostics']['max_ingestion_lag_seconds'],
            'usage_coverage': {key: value['coverage'] for key, value in receipt['usage'].items()
                              if isinstance(value, dict) and 'coverage' in value}}


def window_blockers(build_hash, codex, claude, checks):
    blockers = report_errors(checks, build_hash)
    for agent, report in [('codex', codex), ('claude-code', claude)]:
        if not campaign_passed(report, agent, build_hash):
            blockers.append(agent + ':campaign_not_passed_for_current_build')
    return blockers


def rehearsal_blockers(records, build_hash, owner):
    completed = {r.get('agent') for r in records if r.get('evidence_kind') == 'rehearsal'
                 and r.get('build_manifest_sha256') == build_hash
                 and r.get('owner_reference') == digest_parts(['observation-owner', owner])
                 and r.get('finished_at') and r.get('receipt_id') and r.get('reviewed') is True
                 and r.get('ground_truth_before_readback') is True and r.get('mismatches') == []}
    return [agent + ':daily_rehearsal_incomplete' for agent in AGENTS if agent not in completed]


def readiness(observations, window, build_hash, current=None):
    current = current or now()
    elapsed = 0 if window is None else max(0, (current - datetime.fromisoformat(window['started_at'])).total_seconds() / 86400)
    valid_build = window is not None and window['build_manifest_sha256'] == build_hash
    counts, issues = {}, []
    for agent in AGENTS:
        rows = [r for r in observations if r.get('agent') == agent and r.get('evidence_kind') == 'daily_work'
                and r.get('reviewed') is True and r.get('build_manifest_sha256') == build_hash
                and r.get('receipt_id') and r.get('finished_at') and window is not None
                and r['started_at'] >= window['started_at'] and r.get('ground_truth_before_readback') is True]
        counts[agent] = len({r['receipt_id'] for r in rows})
        issues.extend(code for r in rows for code in r.get('mismatches', []))
    blockers = ([] if valid_build else ['observation_window_not_valid_for_build'])
    if elapsed < 7:
        blockers.append('seven_calendar_days_incomplete')
    blockers += [agent + '_ten_sessions_incomplete' for agent, count in counts.items() if count < 10]
    if issues:
        blockers.append('unresolved_measurement_mismatches')
    return {'schema_version': 1, 'generated_at': current.isoformat(), 'elapsed_days': round(elapsed, 3),
            'reviewed_daily_sessions': counts, 'blockers': blockers, 'mismatches': sorted(set(issues)),
            'ready_for_pilot_review': not blockers, 'review_status': 'pending', 'promotable': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest='action', required=True)
    start = subs.add_parser('start-window')
    check = subs.add_parser('check-ready')
    for command in (start, check):
        for name in ('codex', 'claude', 'checks'):
            command.add_argument('--' + name, required=True)
    begin = subs.add_parser('begin')
    begin.add_argument('--agent', choices=AGENTS, required=True)
    begin.add_argument('--scenario', choices=['feature', 'bugfix', 'refactor', 'review'], required=True)
    begin.add_argument('--expected-result', choices=['file_changes', 'review_findings', 'no_changes'], required=True)
    begin.add_argument('--rehearsal', action='store_true')
    finish = subs.add_parser('finish')
    finish.add_argument('--observation', required=True)
    finish.add_argument('--receipt', required=True)
    finish.add_argument('--reviewed', action='store_true')
    finish.add_argument('--mismatch', action='append', default=[])
    subs.add_parser('report')
    args = parser.parse_args()
    manifest = ROOT / 'evidence/build-manifest.json'
    try:
        build_hash = file_digest(manifest)
    except OSError:
        if args.action == 'check-ready':
            print(json.dumps({'ready': False, 'blockers': ['build_manifest_unavailable'],
                              'window_started': (ROOT / 'evidence/observation-window.json').exists()}))
            return
        raise ValueError('build_manifest_unavailable') from None
    folder = ROOT / 'evidence/observations'
    window_path = ROOT / 'evidence/observation-window.json'
    if args.action in ('start-window', 'check-ready'):
        try:
            blockers = window_blockers(build_hash, *(json.loads(Path(filename).read_text())
                                        for filename in (args.codex, args.claude, args.checks)))
        except (OSError, ValueError, TypeError, KeyError):
            blockers = ['readiness_evidence_unavailable']
        blockers.extend(daily_blockers())
        try:
            account = json.loads((ROOT / 'daily-account.json').read_text())
            blockers.extend(rehearsal_blockers([json.loads(p.read_text()) for p in folder.glob('*.json')],
                                               build_hash, account['user_id']))
        except (OSError, ValueError, KeyError):
            blockers.append('daily_rehearsal_evidence_unavailable')
        try:
            preflight()
        except (ValueError, OSError, KeyError):
            blockers.append('lab_preflight_failed')
        if args.action == 'check-ready':
            print(json.dumps({'ready': not blockers, 'blockers': blockers, 'window_started': window_path.exists()}))
            return
        if blockers:
            raise ValueError(';'.join(blockers))
        if window_path.exists():
            raise ValueError('window_already_exists; retain it and explicitly review any build transition')
        private_json(window_path, {'started_at': now().isoformat(), 'build_manifest_sha256': build_hash})
        print('Observation window started on the tested build.')
    elif args.action == 'begin':
        preflight()
        if not args.rehearsal:
            if not window_path.exists() or json.loads(window_path.read_text())['build_manifest_sha256'] != build_hash:
                raise ValueError('tested_observation_window_required')
        alias = uuid.uuid4().hex
        account = json.loads((ROOT / 'daily-account.json').read_text())
        private_json(folder / (alias + '.json'), {'schema_version': 2,
                     'owner_reference': digest_parts(['observation-owner', account['user_id']]),
                     'observation_id': alias, 'agent': args.agent,
                     'scenario': args.scenario, 'expected_result': args.expected_result,
                     'started_at': now().isoformat(), 'evidence_kind': 'rehearsal' if args.rehearsal else 'daily_work',
                     'build_manifest_sha256': build_hash, 'expected_tokens': None, 'expected_cost': None,
                     'human_intervals': None, 'agent_intervals': None, 'reviewed': False})
        print('Observation started: ' + alias)
    elif args.action == 'finish':
        preflight()
        if not re.fullmatch('[0-9a-f]{32}', args.observation) or not re.fullmatch('[0-9a-f]{64}', args.receipt):
            raise ValueError('invalid_opaque_reference')
        if any(not re.fullmatch('[a-z][a-z0-9_]{0,63}', code) for code in args.mismatch):
            raise ValueError('mismatch_codes_only')
        path = folder / (args.observation + '.json')
        record = json.loads(path.read_text())
        account = json.loads((ROOT / 'daily-account.json').read_text())
        receipt = request('/api/v2/me/work-sessions/' + args.receipt, token=account['api_key'])['data']
        record = finish_record(record, receipt, args.receipt, account['user_id'], build_hash,
                               args.reviewed, args.mismatch)
        private_json(path, record)
        print('Readback recorded for the new native session.')
    else:
        window = json.loads(window_path.read_text()) if window_path.exists() else None
        report = readiness([json.loads(p.read_text()) for p in folder.glob('*.json')], window, build_hash)
        private_json(ROOT / 'evidence/readiness.json', report)
        print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
