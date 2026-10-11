#!/usr/bin/env python3
"""Cursor file edits, projected in memory onto the shared durable metadata spool.
Contract: https://prod.cursor.com/docs/hooks (afterFileEdit/afterTabFileEdit).
This observes completed edit fragments, not suggestions, rejects or token usage.
"""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import sys
import uuid

# Standalone install puts shared helpers beside this script; VSIX preserves bundle layout.
helper = Path(__file__).with_name('metadata-producer.py')
if not helper.exists(): helper = Path(__file__).parents[2] / 'common/metadata-producer.py'
spec = importlib.util.spec_from_file_location('metadata_producer', helper)
producer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)

def bounded_string(value):
    return isinstance(value, str) and 0 < len(value) <= 4096 and not any(ord(c)<32 for c in value)

def project(raw, expected_hook, at):
    if not isinstance(raw, dict) or expected_hook not in ('afterFileEdit', 'afterTabFileEdit') or raw.get('hook_event_name') != expected_hook:
        raise ValueError('cursor_edit_schema_unknown')
    entity=raw.get('file_path')
    # The public contract provides absolute paths. Never use current PWD for replay.
    if not bounded_string(entity) or not (Path(entity).is_absolute() or len(entity)>2 and entity[1:3] in (':\\',':/')):
        raise ValueError('cursor_edit_path_unresolved')
    edits=raw.get('edits')
    if not isinstance(edits,list) or not edits or len(edits)>1000: raise ValueError('cursor_edit_schema_unknown')
    added=deleted=0
    for edit in edits:
        if not isinstance(edit,dict) or not isinstance(edit.get('old_string'),str) or not isinstance(edit.get('new_string'),str): raise ValueError('cursor_edit_schema_unknown')
        # Same fragment-line semantics as the existing Cursor agent adapter; not
        # a filesystem diff, whole-file baseline or independent accept counter.
        added+=len(edit['new_string'].splitlines());deleted+=len(edit['old_string'].splitlines())
    session=raw.get('conversation_id')
    session=session if bounded_string(session) else None
    roots=raw.get('workspace_roots')
    root=next((r for r in roots if bounded_string(r) and (Path(r).is_absolute() or len(r)>2 and r[1:3] in (':\\',':/')) and entity.replace('\\','/').startswith(r.replace('\\','/').rstrip('/')+'/')),None) if isinstance(roots,list) else None
    # No operation ID means one immutable observation, not a fabricated session.
    # The spool retains this UUID during every retry/restart.
    event='cursor-edit:'+str(uuid.uuid4())
    return {'schema_version':1,'producer_version':1,'event_type':'file_change','event_id':event,'occurred_at':at,'entity':entity,'project_root':root,'change_kind':'modify','agent':'cursor','provider':None,'model':None,'session_id':session,'source':'agent_hook','confidence':'verified','lines_added':added,'lines_deleted':deleted,'transport':'native_plugin','tool':expected_hook,'tool_event_id':None,'producer_surface':'inline' if expected_hook=='afterTabFileEdit' else 'ide'}

def run(profile,raw,home,expected_hook):
    if profile.get('schema_version')!=1 or profile.get('adapter_id')!='cursor' or not bounded_string(profile.get('cli_path')): raise ValueError('cursor_profile_invalid')
    # Timestamp is fixed before identity negotiation and spool IO.
    at=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
    metadata=project(raw,expected_hook,at)
    retained=producer.retain('file_mutation',metadata,profile['cli_path'],metadata['producer_surface'],home,profile.get('scope_id'))
    if retained is None: return 'paused_by_user'
    # The idle collector owns handoff/removal. Do not emit a fake durable CLI ACK.
    return 'producer_durable_retained'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--profile',required=True);parser.add_argument('--hook',choices=['afterFileEdit','afterTabFileEdit'],required=True);args=parser.parse_args()
    try:
        raw=sys.stdin.buffer.read(4*1024*1024+1)
        if len(raw)>4*1024*1024: raise ValueError('cursor_payload_too_large')
        home=Path(os.environ.get('ATOAXIS_PRODUCER_HOME',str(Path.home())))
        profile=json.loads(producer.common.safe_path(Path(args.profile)).read_text())
        run(profile,json.loads(raw),home,args.hook)
    except Exception:
        print('AtoAxis: cursor_edit_capture_failure',file=sys.stderr);return 1
    return 0
if __name__=='__main__':sys.exit(main())
