import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('producer', Path(__file__).parents[1] / 'activity-producer.py')
producer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)

def primary_files(files):
    files = list(files)
    contexts = [p for p in files if json.loads(p.read_text()).get('kind') == 'session_context']
    for file in contexts:
        record = json.loads(file.read_text())
        assert set(record['metadata']) == {'context_version', 'native_session', 'repository', 'branch', 'commit_sha', 'reason', 'binding'}
    return [p for p in files if json.loads(p.read_text()).get('kind') != 'session_context']

class ProducerTests(unittest.TestCase):
    def profile(self):
        return {'schema_version': 1, 'adapter_id': 'cline', 'execution_surface': 'ide', 'scope_id': 'a' * 64, 'cli_path': '/missing/fixture-cli'}
    def raw(self):
        return {'hookName': 'PostToolUse', 'taskId': 'fixture-task', 'workspaceRoots': ['/fixture-project'], 'postToolUse': {'success': False, 'parameters': 'SENSITIVE', 'result': 'SENSITIVE'}, 'prompt': 'SENSITIVE'}
    def test_missing_cli_retains_only_metadata_before_handoff(self):
        with tempfile.TemporaryDirectory() as root:
            home = Path(root)
            self.assertEqual(producer.run(self.profile(), self.raw(), home), 'handoff_pending')
            files = primary_files((home / '.wakaclock/native-producer-spool').rglob('*.json'))
            self.assertEqual(len(files), 1)
            content = files[0].read_text()
            self.assertNotIn('SENSITIVE', content)
            record = json.loads(content)
            self.assertNotIn('timestamp', record['metadata'])
            self.assertTrue(record['observed_at'])
    def test_pause_creates_no_event_and_does_not_replay_time(self):
        with tempfile.TemporaryDirectory() as root:
            home = Path(root); state = home / '.wakaclock'; state.mkdir()
            (state / 'runtime-desired.json').write_text(json.dumps({'schema_version': 1, 'desired': {'capture': False}}))
            self.assertEqual(producer.run(self.profile(), self.raw(), home), 'paused_by_user')
            self.assertFalse((state / 'native-producer-spool').exists())
    def test_failed_disk_commit_never_calls_cli(self):
        with tempfile.TemporaryDirectory() as root, patch.object(producer, 'durable_file', side_effect=OSError('disk full')), patch.object(producer.subprocess, 'run') as invoke:
            with self.assertRaises(OSError): producer.run(self.profile(), self.raw(), Path(root))
            self.assertTrue(all(call.args[0][0] == "git" for call in invoke.call_args_list))
    def test_neutral_or_false_ack_cannot_remove_spool(self):
        for acknowledgement in ({'cancel': False}, {'acknowledgement': {'durable': True, 'status': 'accepted'}}):
            with tempfile.TemporaryDirectory() as root, patch.object(producer.subprocess, 'run') as invoke:
                invoke.return_value.returncode = 0; invoke.return_value.stdout = json.dumps(acknowledgement).encode()
                producer.run(self.profile(), self.raw(), Path(root))
                self.assertEqual(len(primary_files(Path(root).rglob('*.json'))), 1)
    def test_antigravity_metadata_strips_tool_arguments_error_and_transcript(self):
        metadata = producer.sanitize('antigravity', {'hook_event_name': 'PostToolUse', 'conversationId': 'fixture', 'workspacePaths': ['/fixture'], 'stepIdx': 2, 'toolCall': {'args': 'SENSITIVE'}, 'error': 'SENSITIVE', 'transcriptPath': 'SENSITIVE'})
        self.assertTrue(metadata['failed']); self.assertEqual(metadata['stepIdx'], 2)
        self.assertNotIn('SENSITIVE', json.dumps(metadata))
    def test_cline_milliseconds_preserve_exact_observation_time(self):
        metadata = producer.sanitize('cline', {**self.raw(), 'timestamp': '1791313293123'})
        self.assertEqual(metadata['timestamp'], '2026-10-06T19:01:33.123000Z')
        self.assertNotIn('SENSITIVE', json.dumps(metadata))
    def test_symlink_cannot_redirect_spool(self):
        with tempfile.TemporaryDirectory() as root:
            home = Path(root); (home / '.wakaclock').symlink_to(home)
            with self.assertRaisesRegex(ValueError, 'symlink'): producer.retain(self.profile(), self.raw(), home)

if __name__ == '__main__': unittest.main()
