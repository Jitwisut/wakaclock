#!/usr/bin/env python3
"""Strict metadata intake for the shared Mac/Windows certification matrix.
A complete matrix is evidence intake, never a substitute for live provider verification.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
FIELDS={'schema_version','session_id','tool','os','architecture','provider_version','client_version','build_sha','activity_origin','started_at','ended_at','metrics','expected_ledger_sha256','server_evidence_sha256','inline_ledger_sha256'}
METRICS={'repository_identity','branch','commit_sha','context_delivery','usage','suggested','accepted','agent_edits'}
HEX=re.compile(r'^[a-f0-9]{64}$')

def validate(record):
    if set(record)-FIELDS:raise ValueError('non-allowlisted certification metadata')
    if record.get('schema_version')!=1:raise ValueError('certification schema unsupported')
    for key in ('session_id','expected_ledger_sha256','server_evidence_sha256'):
        if not HEX.fullmatch(record.get(key,'')):raise ValueError('opaque evidence hash required: '+key)
    if not re.fullmatch(r'[a-f0-9]{40}',record.get('build_sha','')):raise ValueError('clean commit SHA required')
    if record.get('tool') not in ('codex','claude_code','cursor_ide','copilot_vscode') or record.get('os') not in ('macos','windows'):raise ValueError('tool/OS outside manifest')
    if record.get('activity_origin')!='user':raise ValueError('monitor or synthetic session is not client certification')
    for key in ('architecture','provider_version','client_version'):
        if not re.fullmatch(r'[a-zA-Z0-9._+ -]{1,96}',record.get(key,'')):raise ValueError('version/architecture evidence required')
    times=[]
    for key in ('started_at','ended_at'):
        value=record.get(key)
        if not isinstance(value,str):raise ValueError('session timestamp required: '+key)
        try:at=datetime.fromisoformat(value.replace('Z','+00:00'))
        except ValueError:raise ValueError('invalid session timestamp: '+key) from None
        if at.tzinfo is None or at.utcoffset() is None:raise ValueError('timezone required: '+key)
        times.append(at)
    if times[1]<=times[0] or times[1]>datetime.now(timezone.utc):raise ValueError('session must have ended with a positive measured interval')
    metrics=record.get('metrics',{})
    if set(metrics)!=METRICS or any(v not in ('observed','unavailable','pending','failed') for v in metrics.values()):raise ValueError('each metric needs an explicit availability verdict')
    if record['tool'] in ('cursor_ide','copilot_vscode') and not HEX.fullmatch(record.get('inline_ledger_sha256','')):raise ValueError('independent inline ledger required')
    return record

def main():
    parser=argparse.ArgumentParser();parser.add_argument('reports',type=Path,nargs='+');args=parser.parse_args()
    records=[validate(json.loads(path.read_text())) for path in args.reports]
    identities=[(r['tool'],r['os'],r['session_id']) for r in records]
    if len(set(identities))!=len(identities):raise SystemExit('duplicate certification session')
    builds={r['build_sha'] for r in records}
    if len(builds)>1:raise SystemExit('Mac and Windows must use the same clean build SHA')
    matrix={tool+':'+os:sum(r['tool']==tool and r['os']==os for r in records) for tool in ('codex','claude_code','cursor_ide','copilot_vscode') for os in ('macos','windows')}
    print(json.dumps({'matrix':matrix,'minimum_sessions_present':all(n>=10 for n in matrix.values()),'certificate_status':'pending_independent_review','provider_limits_require_owner_review':any(v=='unavailable' for r in records for v in r['metrics'].values())},indent=2))

if __name__=='__main__':main()
