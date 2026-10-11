import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('cursor_edits',Path(__file__).parents[1]/'scripts/edit-producer.py')
producer=importlib.util.module_from_spec(spec);spec.loader.exec_module(producer)
class CursorEditTests(unittest.TestCase):
    def profile(self):return {'schema_version':1,'adapter_id':'cursor','cli_path':'/missing/cli','scope_id':'a'*64}
    def raw(self,hook='afterTabFileEdit'):
        return {'hook_event_name':hook,'file_path':'/fixture/repo/a.ts','workspace_roots':['/fixture/repo'],'conversation_id':'native-conversation','generation_id':'turn-not-tool','edits':[{'old_string':'SENSITIVE OLD','new_string':'SENSITIVE NEW\nsecond','old_line':'SENSITIVE','new_line':'SENSITIVE','range':{'start_line_number':1}}],'prompt':'SENSITIVE','user_email':'PRIVATE'}
    def test_inline_metadata_retained_with_cli_offline_and_no_source_or_false_counters(self):
        with tempfile.TemporaryDirectory() as root:
            home=Path(root)
            self.assertEqual(producer.run(self.profile(),self.raw(),home,'afterTabFileEdit'),'producer_durable_retained')
            data=next((home/'.wakaclock/native-producer-spool').rglob('*.json')).read_text()
            self.assertNotIn('SENSITIVE',data);self.assertNotIn('PRIVATE',data)
            r=json.loads(data);self.assertEqual(r['execution_surface'],'inline');self.assertEqual(r['scope_id'],'a'*64)
            self.assertEqual(r['metadata']['lines_added'],2);self.assertEqual(r['metadata']['lines_deleted'],1)
            self.assertIsNone(r['metadata']['model']);self.assertIsNone(r['metadata']['tool_event_id'])
            self.assertNotIn('suggested',data);self.assertNotIn('tokens',data)
    def test_agent_and_inline_separate_and_missing_session_not_invented(self):
        raw=self.raw('afterFileEdit');del raw['conversation_id']
        metadata=producer.project(raw,'afterFileEdit','2026-10-07T01:18:09Z')
        self.assertEqual(metadata['producer_surface'],'ide');self.assertIsNone(metadata['session_id'])
        with self.assertRaisesRegex(ValueError,'schema_unknown'):producer.project(raw,'afterTabFileEdit','2026-10-07T01:18:09Z')
    def test_partial_schema_and_relative_path_do_not_read_todays_files(self):
        for field,value in [('file_path','relative.ts'),('edits',[{'new_string':'text'}])]:
            raw=self.raw();raw[field]=value
            with self.assertRaises(ValueError):producer.project(raw,'afterTabFileEdit','2026-10-07T01:18:09Z')
    def test_pause_preserves_intent_and_disk_failure_is_not_acceptance(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as root:
            home=Path(root);base=home/'.wakaclock';base.mkdir()
            (base/'runtime-desired.json').write_text(json.dumps({'schema_version':1,'desired':{'capture':False}}))
            self.assertEqual(producer.run(self.profile(),self.raw(),home,'afterTabFileEdit'),'paused_by_user')
            self.assertFalse((base/'native-producer-spool').exists())
            (base/'runtime-desired.json').unlink()
            with patch.object(producer.producer.common,'durable_file',side_effect=OSError('full')):
                with self.assertRaises(OSError):producer.run(self.profile(),self.raw(),home,'afterTabFileEdit')
if __name__=='__main__':unittest.main()
