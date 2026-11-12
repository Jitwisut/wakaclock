#!/usr/bin/env python3
"""Freeze Git coordinates at a real hook boundary; replay never opens Git.
Only metadata is retained. The primary observation and this side stream share
scope, original observation time and durable producer transport.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid
from urllib.parse import urlsplit
sys.dont_write_bytecode = True


def repository(remote):
    if remote.startswith('git@github.com:'):
        value = remote[len('git@github.com:'):]
    else:
        try:
            parsed = urlsplit(remote)
            if parsed.scheme not in ('https', 'ssh') or parsed.hostname != 'github.com' or parsed.port:
                return None
            value = parsed.path.lstrip('/')
        except ValueError:
            return None
    value = value.rstrip('/')
    if value.endswith('.git'): value = value[:-4]
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', value) or any(p in ('.', '..') for p in value.split('/')):
        return None
    return value.lower()


def freeze(adapter, metadata, observed_at):
    session = next((metadata.get(key) for key in ('session_id', 'sessionID', 'taskId', 'conversation_id', 'conversationId') if metadata.get(key)), None)
    roots = next((metadata.get(key) for key in ('workspace_roots', 'workspaceRoots', 'workspacePaths') if metadata.get(key)), None)
    root = next((metadata.get(key) for key in ('project_root', 'workspace_root', 'cwd', 'directory') if metadata.get(key)), None)
    evidence = {'context_version': 1, 'native_session': session, 'repository': None, 'branch': None, 'commit_sha': None, 'reason': None, 'binding': None}
    if not isinstance(session, str) or not session or len(session) > 512 or any(ord(c) < 32 for c in session):
        evidence.update(native_session=None, reason='native_session_unavailable')
        return evidence
    if roots:
        # Multiple roots cannot be silently attributed to whichever matches first.
        if not isinstance(roots, list) or len(roots) != 1:
            evidence['reason'] = 'repository_context_ambiguous'
            return evidence
        root = roots[0]
    if not isinstance(root, str) or not Path(root).is_absolute():
        evidence['reason'] = 'workspace_evidence_unavailable'
        return evidence
    # A supplied historical timestamp is never permission to read current Git.
    from datetime import datetime, timezone
    try:
        if abs((datetime.now(timezone.utc) - datetime.fromisoformat(observed_at.replace('Z', '+00:00'))).total_seconds()) > 30:
            evidence['reason'] = 'historical_context_unavailable'
            return evidence
    except (ValueError, TypeError):
        evidence['reason'] = 'historical_context_unavailable'
        return evidence
    def read(args):
        try:
            result = subprocess.run(['git', '-C', root, *args], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=2, check=False)
            if result.returncode == 0 and len(result.stdout) <= 4096:
                return result.stdout.decode('utf-8').strip()
        except (OSError, UnicodeError, subprocess.TimeoutExpired):
            pass
        return None
    evidence['repository'] = repository(read(['config', '--local', '--get', 'remote.origin.url']) or '')
    # Freeze the verified installation's routing metadata now. A later config is
    # never evidence of this event's historical repository/project binding.
    configuration = os.environ.get('ATOAXIS_TEAM_CONTEXT_CONFIG')
    if configuration:
        try:
            path = Path(configuration)
            if any(part.is_symlink() for part in (path, *path.parents) if str(part) not in ('/var','/tmp','/etc')):
                raise ValueError('context_configuration_symlink')
            if path.stat().st_size > 16 * 1024: raise ValueError('context_configuration_limit')
            settings = json.loads(path.read_text())
            fields = ('origin','user_id','organization_id','collector_id','project_id','repository_id','repository')
            binding = {key:settings[key] for key in fields}
            for key in fields[1:-1]: uuid.UUID(binding[key])
            origin = urlsplit(binding['origin'])
            if origin.username or origin.password or origin.query or origin.fragment or origin.path not in ('','/') or origin.scheme not in ('https','http'):
                raise ValueError('context_origin_invalid')
            if binding['repository'].lower() != evidence['repository']:
                raise ValueError('context_repository_mismatch')
            binding['repository'] = binding['repository'].lower()
            evidence['binding'] = binding
        except (OSError, ValueError, KeyError, TypeError):
            pass

    if not evidence['repository']:
        evidence['reason'] = 'repository_evidence_unavailable'
        return evidence
    branch = read(['symbolic-ref', '--quiet', '--short', 'HEAD'])
    if branch and len(branch) <= 256 and not any(ord(c) < 32 for c in branch): evidence['branch'] = branch
    sha = read(['rev-parse', '--verify', 'HEAD'])
    if sha and re.fullmatch(r'(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})', sha): evidence['commit_sha'] = sha.lower()
    return evidence


def retain(primary, metadata, home, common, frozen=None):
    evidence = frozen if frozen is not None else freeze(primary['adapter_id'], metadata, metadata.get('occurred_at') or metadata.get('timestamp') or primary['observed_at'])
    encoded = json.dumps(evidence, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
    record = {key: primary[key] for key in ('scope_id', 'adapter_id', 'execution_surface', 'observed_at')}
    # One stable side-stream ID for each immutable producer observation.
    record.update(schema_version=2, observation_id=str(uuid.uuid5(uuid.NAMESPACE_URL, 'atoaxis-context:' + primary['scope_id'] + ':' + primary['observation_id'])), kind='session_context', payload_hash=hashlib.sha256(encoded).hexdigest(), metadata=evidence)
    directory = common.safe_path(home / '.wakaclock/native-producer-spool' / record['scope_id'])
    stage = common.safe_path(directory / (record['observation_id'] + '.context-stage'))
    file = common.safe_path(directory / (record['observation_id'] + '.json'))
    common.durable_file(stage, json.dumps(record, separators=(',', ':'), ensure_ascii=False).encode())
    os.replace(stage, file)
    common.sync_dir(directory)
    return record
