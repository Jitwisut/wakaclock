"""Hash tracked and non-ignored new source, then bind successful builds to that snapshot."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone
from local_lab import REPO, ROOT, private_json


def source_digest(repo=REPO):
    paths = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=repo).split(b'\0')
    digest = hashlib.sha256()
    for name in sorted(set(p for p in paths if p and p != b'frontend/app/next-env.d.ts')):
        path = repo / os.fsdecode(name)
        if path.is_symlink():
            data = b'link:' + os.fsencode(os.readlink(path))
        elif path.is_file():
            data = path.read_bytes()
        else:
            data = b'deleted'
        digest.update(len(name).to_bytes(8, 'little') + name)
        digest.update(hashlib.sha256(data).digest())
    return digest.hexdigest()


def file_digest(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def tree_digest(root):
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob('*') if p.is_file() and 'cache' not in p.relative_to(root).parts):
        digest.update(str(path.relative_to(root)).encode() + b'\0')
        digest.update(bytes.fromhex(file_digest(path)))
    return digest.hexdigest()


def build(values):
    before = source_digest()
    commands = [
        ('rust', REPO, ['cargo', 'build', '--release', '--locked', '--offline', '--manifest-path', 'backend/api/Cargo.toml', '-p', 'wakaclock-server', '-p', 'wakaclock-cli', '--bin', 'wakaclock-server', '--bin', 'wakaclock', '--bin', 'account-deletion', '--bin', 'job-worker']),
        ('frontend', REPO / 'frontend/app', ['npm', 'run', 'build', '--', '--webpack']),
    ]
    for label, cwd, command in commands:
        with (ROOT / f'{label}-build.log').open('w') as log:
            subprocess.run(command, cwd=cwd, env=values, stdout=log, stderr=subprocess.STDOUT, check=True)
    after = source_digest()
    if before != after:
        raise RuntimeError('source_changed_during_build; rerun against a stable source snapshot')
    output = REPO / 'frontend/app/build/receipt-validation'
    manifest = {
        'schema_version': 2, 'generated_at': datetime.now(timezone.utc).isoformat(),
        'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip(),
        'source_snapshot_sha256': after, 'source_unchanged_during_build': True,
        'generated_source_exclusions': ['frontend/app/next-env.d.ts'],
        'collector_sha256': file_digest(REPO / 'backend/api/target/release/wakaclock'),
        'server_sha256': file_digest(REPO / 'backend/api/target/release/wakaclock-server'),
        'deletion_worker_sha256': file_digest(REPO / 'backend/api/target/release/account-deletion'),
        'job_worker_sha256': file_digest(REPO / 'backend/api/target/release/job-worker'),
        'frontend_build_id': (output / 'BUILD_ID').read_text().strip(),
        'frontend_sha256': tree_digest(output),
        'api_origin': values['NEXT_PUBLIC_WAKACLOCK_API_URL'],
        'review_status': 'pending', 'promotable': False,
    }
    private_json(ROOT / 'evidence/build-manifest.json', manifest)
    print('Builds passed with unchanged source; manifest written to local evidence directory.')
