#!/usr/bin/env python3
"""Owned, checkpointed installation. User plugins/configuration/spools are retained."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import uuid
from contextlib import contextmanager


def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def safe(path):
    for entry in [path, *path.parents]:
        if entry.is_symlink() and not (sys.platform == 'darwin' and str(entry) in ('/var', '/tmp', '/etc') and str(entry.resolve()) == '/private' + str(entry)):
            raise RuntimeError('kilo_install_symlink_refused')


def sync_dir(directory):
    if os.name != 'nt':
        fd = os.open(directory, os.O_RDONLY)
        try: os.fsync(fd)
        finally: os.close(fd)


def persist(path, value):
    stage = path.with_name(path.name + '.' + str(uuid.uuid4()) + '.metadata')
    fd = os.open(stage, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(value, stream); stream.flush(); os.fsync(stream.fileno())
    stage.replace(path); sync_dir(path.parent)


@contextmanager
def install_lock(plugins):
    path = plugins / '.atoaxis-kilo-setup.lock'; safe(path)
    fd = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
    try:
        if os.name == 'nt':
            import msvcrt
            if os.fstat(fd).st_size == 0: os.write(fd, b'0')
            os.lseek(fd, 0, os.SEEK_SET); msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    finally: os.close(fd)


def inventory(target, entry, plugins):
    actual = {}
    if target.exists():
        for path in target.rglob('*'):
            safe(path)
            if path.is_file(): actual[str(path.relative_to(plugins))] = digest(path)
    if entry.exists(): actual[entry.name] = digest(entry)
    return actual


def install(root, plugins, action):
    target = plugins / 'atoaxis-kilo-code'; entry = plugins / 'atoaxis-kilo-code.ts'
    ledger = plugins / '.atoaxis-kilo-owned.json'
    for path in (target, entry, ledger): safe(path)
    previous = json.loads(ledger.read_text()) if ledger.exists() else None
    actual = inventory(target, entry, plugins)
    generations = []
    if previous:
        if previous.get('version') == 1: generations = [previous['files']]
        elif previous.get('version') == 2 and previous.get('phase') in ('prepared', 'active', 'removing'):
            generations = previous['generations']
        else: raise RuntimeError('kilo_install_ownership_unconfirmed')
    if actual:
        if not generations: raise RuntimeError('kilo_install_ownership_unconfirmed')
        if any(not any(generation.get(name) == sha for generation in generations) for name, sha in actual.items()):
            raise RuntimeError('kilo_user_modified_files_preserved')
        if previous.get('version') == 1 or previous.get('phase') == 'active':
            if actual != generations[-1]: raise RuntimeError('kilo_user_modified_files_preserved')
    if action == '--uninstall':
        if not previous: return
        persist(ledger, {'version': 2, 'phase': 'removing', 'generations': generations})
        if target.exists(): shutil.rmtree(target)
        entry.unlink(missing_ok=True); sync_dir(plugins)
        ledger.unlink(); sync_dir(plugins)
        return
    stage = plugins / ('atoaxis-kilo-stage-' + str(uuid.uuid4())); stage.mkdir(mode=0o700)
    try:
        shutil.copytree(root / 'src', stage / 'modules')
        shutil.copyfile(root.parent / 'common/activity-spool.ts', stage / 'modules/activity-spool.ts')
        producer = stage / 'modules/producer-client.ts'
        producer.write_text(producer.read_text().replace('"../../common/activity-spool.ts"', '"./activity-spool.ts"'))
        staged_entry = stage / 'entry.ts'; shutil.copyfile(root / 'installer/entrypoint.ts', staged_entry)
        next_files = {str(Path(target.name) / p.relative_to(stage / 'modules')): digest(p) for p in (stage / 'modules').rglob('*') if p.is_file()}
        next_files[entry.name] = digest(staged_entry)
        if next_files not in generations: generations.append(next_files)
        if len(generations) > 8: raise RuntimeError('kilo_install_recovery_requires_review')
        for path in stage.rglob('*'):
            if path.is_file():
                with path.open('rb') as stream: os.fsync(stream.fileno())
        sync_dir(stage / 'modules'); sync_dir(stage)
        # Durably authorize exact old/new files before removing either generation.
        persist(ledger, {'version': 2, 'phase': 'prepared', 'generations': generations})
        if target.exists(): shutil.rmtree(target)
        (stage / 'modules').rename(target); staged_entry.replace(entry); sync_dir(plugins)
        if inventory(target, entry, plugins) != next_files: raise RuntimeError('kilo_install_generation_mismatch')
        persist(ledger, {'version': 2, 'phase': 'active', 'generations': [next_files]})
    finally: shutil.rmtree(stage)


def main():
    root, plugins, action = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    if action == '--uninstall' and not any(str(plugins).endswith(x) for x in ('/kilo/plugin', '/.kilo/plugin', '/.kilocode/plugin')):
        raise RuntimeError('kilo_install_scope_unconfirmed')
    safe(plugins); plugins.mkdir(parents=True, exist_ok=True)
    with install_lock(plugins): install(root, plugins, action)


if __name__ == '__main__':
    try: main()
    except Exception:
        print('AtoAxis: kilo installation not confirmed; preserve existing files and ownership evidence', file=sys.stderr)
        sys.exit(1)
