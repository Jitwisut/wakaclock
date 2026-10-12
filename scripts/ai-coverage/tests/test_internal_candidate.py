import json
import sys
import tempfile
import struct
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from package_internal_candidate import package_candidate, inspect_members, REQUIRED_CAPABILITIES
from verify_release_artifacts import ArtifactError, sha256_bytes
from test_verify_release_artifacts import bundle_files, bundle_manifest

COMMIT = 'a' * 40
COMPILED = b'buffer.enableJournal(); cli.runtime(action); commands.registerCommand(`wakaclock.runtime${action}`); registerJournalRecoveryCommands();'
COMPILED_CLI = b'async acceptJournalBatch() { return runCli(["heartbeat-batch"]); }'
COMPILED_RECOVERY = b'function applyJournalRecovery() {}'


def fixture(path, target='win32-arm64', sensitive=False):
    header=bytearray(128)
    if target.startswith("win32"):
        header[:2]=b"MZ";struct.pack_into("<I",header,60,64);header[64:68]=b"PE\0\0";struct.pack_into("<H",header,68,0xAA64 if target.endswith("arm64") else 0x8664)
    else:
        header[:4]=b"\xcf\xfa\xed\xfe";struct.pack_into("<I",header,4,0x0100000C if target.endswith("arm64") else 0x01000007)
    binary = bytes(header) + ' '.join(sorted(REQUIRED_CAPABILITIES)).encode() + COMMIT.encode()
    name = 'wakaclock.exe' if target.startswith('win32') else 'wakaclock'
    manifest = {'schemaVersion': 1, 'protocolVersion': 1, 'cliVersion': '0.1.0',
                'target': target, 'binary': name, 'sha256': sha256_bytes(binary),
                'sourceCommit': COMMIT, 'buildProfile': 'release', 'releaseChannel': 'internal',
                'signing': 'unsigned', 'capabilities': sorted(REQUIRED_CAPABILITIES), 'sourceTreeDigest':'b'*64, 'compiledSha256':{'out/src/extension.js':sha256_bytes(COMPILED),'out/src/cli.js':sha256_bytes(COMPILED_CLI),'out/src/journalRecovery.js':sha256_bytes(COMPILED_RECOVERY)}}
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('extension/package.json', json.dumps({'version': '0.1.0', 'contributes':{'commands':[{'command':name} for name in ['wakaclock.runtimePause','wakaclock.runtimeResume','wakaclock.inspectJournal','wakaclock.prepareJournalRecovery','wakaclock.applyJournalRecovery','wakaclock.journalRecoveryHistory']]}}))
        archive.writestr('extension/resources/cli-manifest.json', json.dumps(manifest))
        archive.writestr('extension/out/src/extension.js', COMPILED)
        archive.writestr('extension/out/src/cli.js', COMPILED_CLI)
        archive.writestr('extension/out/src/journalRecovery.js', COMPILED_RECOVERY)
        archive.writestr('extension/resources/bin/' + name, binary)
        for key, data in bundle_files().items():
            archive.writestr('extension/resources/ai-agents/' + key, data)
        archive.writestr('extension/resources/ai-agents/bundle-manifest.json', bundle_manifest(bundle_files()))
        if sensitive:
            archive.writestr('extension/accidental-secret.txt', b'-----BEGIN PRIVATE KEY-----')


class InternalCandidateTest(unittest.TestCase):
    def test_template_registered_commands_require_declared_commands_and_durable_cli(self):
        with tempfile.TemporaryDirectory() as directory:
            package=Path(directory)/'candidate.vsix';fixture(package)
            inspect_members(package,COMMIT)
            with zipfile.ZipFile(package) as archive:members={name:archive.read(name) for name in archive.namelist()}
            for omitted in ['extension/out/src/cli.js','extension/package.json']:
                broken=dict(members)
                if omitted.endswith('cli.js'):broken.pop(omitted)
                else:broken[omitted]=json.dumps({'version':'0.1.0'}).encode()
                with zipfile.ZipFile(package,'w') as archive:
                    for name,data in broken.items():archive.writestr(name,data)
                with self.assertRaisesRegex(ArtifactError,'compiled_extension_incompatible'):inspect_members(package,COMMIT)
    def test_declared_roo_bridge_requires_compiled_durable_resources_and_capability(self):
        with tempfile.TemporaryDirectory() as directory:
            package=Path(directory)/"candidate.vsix";fixture(package)
            with zipfile.ZipFile(package) as archive:members={name:archive.read(name) for name in archive.namelist()}
            metadata=json.loads(members['extension/package.json']);metadata['contributes']['commands'].append({'command':'wakaclock.setupRooTracking'})
            members['extension/package.json']=json.dumps(metadata).encode()
            with zipfile.ZipFile(package,'w') as archive:
                for name,data in members.items():archive.writestr(name,data)
            with self.assertRaisesRegex(ArtifactError,'roo_bridge_incompatible'):inspect_members(package,COMMIT)

    def test_windows_standalone_keeps_identical_binary_resources_and_pending_certification(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fixture(root / 'candidate.vsix')
            report = package_candidate(root / 'candidate.vsix', COMMIT, root / 'dist')
            data = json.loads(report.read_text())
            self.assertFalse(data['production_ready'])
            self.assertEqual(data['native_certification'], 'pending')
            archive = next((root / 'dist').glob('*.zip'))
            with zipfile.ZipFile(archive) as runtime:
                self.assertEqual(sha256_bytes(runtime.read('wakaclock.exe')), data['binary_sha256'])
                self.assertIn('resources/ai-agents/bundle-manifest.json', runtime.namelist())
                self.assertIn('runtime-manifest.json', runtime.namelist())

    def test_source_mismatch_and_sensitive_material_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory) / 'candidate.vsix'
            fixture(package)
            with self.assertRaisesRegex(ArtifactError, 'commit_mismatch'):
                inspect_members(package, 'b' * 40)
            fixture(package, sensitive=True)
            with self.assertRaisesRegex(ArtifactError, 'sensitive_material_detected'):
                inspect_members(package, COMMIT)

    def test_native_architecture_and_compiled_hash_are_verified(self):
        from package_internal_candidate import verify_native_target, verify_standalone
        with self.assertRaisesRegex(ArtifactError, "native_format_invalid"):
            verify_native_target(b"not a binary", "win32-x64")
        with tempfile.TemporaryDirectory() as directory:
            package=Path(directory)/"candidate.vsix"
            fixture(package)
            with zipfile.ZipFile(package) as archive:
                binary=archive.read("extension/resources/bin/wakaclock.exe")
            with self.assertRaisesRegex(ArtifactError,"architecture_mismatch"):
                verify_native_target(binary,"win32-x64")
            corrupted=Path(directory)/"standalone.zip"
            with zipfile.ZipFile(corrupted,"w") as archive:
                archive.writestr("wakaclock.exe",b"changed")
            with self.assertRaisesRegex(ArtifactError,"content_mismatch"):
                verify_standalone(corrupted,{"wakaclock.exe":binary})
