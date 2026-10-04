#!/usr/bin/env python3
"""Capture local version/build metadata only. This does NOT certify a live workflow."""
import argparse
import hashlib
import json
import pathlib
import platform
import shutil
import subprocess
from datetime import datetime, timezone


def command(args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=20, check=False)
        return result.stdout.strip()[:2048] if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--collector-binary', type=pathlib.Path)
    args = parser.parse_args()
    agents = {}
    for name in ('codex', 'claude'):
        executable = shutil.which(name)
        agents[name] = {'version_output': command([executable, '--version']) if executable else None,
                        'live_readback': 'not_run', 'certification': 'pending'}
    editor = shutil.which('code')
    extensions = command([editor, '--list-extensions', '--show-versions']) if editor else None
    extension = [line for line in (extensions or '').splitlines()
                 if 'atoaxis' in line.lower() or 'wakaclock' in line.lower()]
    binary_digest = None
    if args.collector_binary:
        binary_digest = hashlib.sha256(args.collector_binary.read_bytes()).hexdigest()
    result = {
        'schema_version': 1, 'captured_at': datetime.now(timezone.utc).isoformat(),
        'os': {'system': platform.system(), 'version': platform.mac_ver()[0], 'architecture': platform.machine()},
        'editor_version': command([editor, '--version']) if editor else None,
        'tracking_extension_versions': extension, 'agents': agents,
        'source_commit': command(['git', 'rev-parse', 'HEAD']),
        'working_tree_dirty': bool(command(['git', 'status', '--porcelain'])),
        'collector_binary_sha256': binary_digest,
        'databases': {
            'rabbitmq_image_id': command(['docker', 'inspect', '--format', '{{.Image}}', 'atoaxis-receipt-validation-rabbitmq-1']),
            'object_store_image_id': command(['docker', 'inspect', '--format', '{{.Image}}', 'atoaxis-receipt-validation-object-store-1']),
            'postgres_version': command(['docker', 'exec', 'atoaxis-receipt-validation-postgres-1', 'postgres', '--version']),
            'postgres_image_id': command(['docker', 'inspect', '--format', '{{.Image}}', 'atoaxis-receipt-validation-postgres-1']),
            'clickhouse_version': command(['docker', 'exec', 'atoaxis-receipt-validation-clickhouse-1', 'clickhouse', '--version']),
            'clickhouse_image_id': command(['docker', 'inspect', '--format', '{{.Image}}', 'atoaxis-receipt-validation-clickhouse-1']),
        },
        'promotable': False,
        'release_gates': {'fresh_exact_tuple_capture': 'pending', 'seven_day_reference': 'pending',
                          'ten_sessions_per_agent': 'pending', 'five_user_pilot': 'pending'},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(f'Wrote metadata inventory to {args.output}; certification remains pending.')


if __name__ == '__main__':
    main()
