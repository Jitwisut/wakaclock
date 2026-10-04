"""Prepare and validate only the lab's isolated VS Code profile."""
import json
from pathlib import Path
import subprocess
import zipfile
import hashlib

from local_lab import ROOT, REPO, API, collector_env, private_json
from build_manifest import file_digest
from runtime_binding import manifest, artifacts_valid, preflight


def package_metadata(archive, collector_hash):
    with zipfile.ZipFile(archive) as package:
        metadata = json.loads(package.read('extension/package.json'))
        bundled = json.loads(package.read('extension/resources/cli-manifest.json'))
        if bundled.get('binary') != 'wakaclock':
            raise ValueError('unexpected_collector_binary')
        binary = package.read('extension/resources/bin/wakaclock')
    if metadata['publisher'] != 'atoaxis' or metadata['name'] != 'atoaxis-vscode':
        raise ValueError('unexpected_extension')
    if bundled['sha256'] != collector_hash or hashlib.sha256(binary).hexdigest() != collector_hash:
        raise ValueError('extension_collector_build_mismatch')
    return metadata


def paths(identity):
    if identity not in ('daily', 'campaign'):
        raise ValueError('invalid_profile')
    return ROOT / identity / 'vscode-user-data', ROOT / identity / 'vscode-extensions'


def verify_profile(identity):
    data, build_hash = manifest()
    artifacts_valid(data)
    user, extensions = paths(identity)
    settings = json.loads((user / 'User/settings.json').read_text())
    if (settings.get('wakaclock.serverUrl') != API or
            settings.get('wakaclock.cliPath') != str(REPO / 'backend/api/target/release/wakaclock')):
        raise ValueError('editor_destination_or_collector_mismatch')
    installed = list(extensions.glob('atoaxis.atoaxis-vscode-*'))
    if len(installed) != 1:
        raise ValueError('one_lab_extension_required')
    extension = installed[0]
    package = json.loads((extension / 'package.json').read_text())
    bundled = json.loads((extension / 'resources/cli-manifest.json').read_text())
    if bundled.get('binary') != 'wakaclock':
        raise ValueError('unexpected_collector_binary')
    if (bundled['sha256'] != data['collector_sha256'] or
            file_digest(extension / 'resources/bin' / bundled['binary']) != data['collector_sha256']):
        raise ValueError('installed_extension_collector_mismatch')
    return {'schema_version': 1, 'identity': identity, 'extension_version': package['version'],
            'collector_sha256': data['collector_sha256'], 'build_manifest_sha256': build_hash,
            'destination_verified': True, 'live_editor_capture': 'not_run'}


def prepare(identity, vsix):
    data, _ = manifest()
    artifacts_valid(data)
    package_metadata(vsix, data['collector_sha256'])
    user, extensions = paths(identity)
    subprocess.run(['code', '--user-data-dir', str(user), '--extensions-dir', str(extensions),
                    '--install-extension', str(Path(vsix).resolve()), '--force'],
                   env=collector_env(identity), check=True, capture_output=True, timeout=90)
    settings_path = user / 'User/settings.json'
    settings = json.loads(settings_path.read_text()) if settings_path.exists() else {}
    settings.update({'wakaclock.serverUrl': API,
                     'wakaclock.cliPath': str(REPO / 'backend/api/target/release/wakaclock'),
                     'wakaclock.debugLogging': False})
    private_json(settings_path, settings)
    report = verify_profile(identity)
    private_json(ROOT / 'evidence' / (identity + '-editor-profile.json'), report)
    return report


def launch(identity):
    preflight()
    report = verify_profile(identity)
    user, extensions = paths(identity)
    subprocess.run(['code', '--user-data-dir', str(user), '--extensions-dir', str(extensions),
                    '--new-window', str(ROOT / identity / 'workspace')],
                   env=collector_env(identity), check=True, timeout=30)
    return report
