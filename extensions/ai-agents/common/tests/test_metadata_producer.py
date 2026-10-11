import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import os
import subprocess
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('metadata',Path(__file__).parents[1]/'metadata-producer.py')
producer=importlib.util.module_from_spec(spec);spec.loader.exec_module(producer)
class MetadataTests(unittest.TestCase):
    def input(self): return {'session_id':'fixture','agent':'claude-code','cwd':'/fixture','occurred_at':'2026-10-07T01:18:09Z'}
    def setup_scope(self,home):
        root=home/'.wakaclock/native-producer-bindings';root.mkdir(parents=True)
        (root/'claude-code-cli.json').write_text(json.dumps({'scope_id':'a'*64}))
    def test_missing_cli_retains_original_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp);self.setup_scope(home)
            self.assertEqual(producer.run('session_end',self.input(),'/missing/cli','cli',home),'handoff_pending')
            record=json.loads(next((home/'.wakaclock/native-producer-spool').rglob('*.json')).read_text())
            self.assertEqual(record['metadata']['occurred_at'],self.input()['occurred_at'])
            self.assertEqual(record['payload_hash'],hashlib.sha256(json.dumps(record['metadata'],sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest())
    def test_unknown_owner_is_parked(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp)
            self.assertEqual(producer.run('session_start',self.input(),'/missing/cli','cli',home),'producer_owner_unconfirmed')
            self.assertEqual(len(list((home/'.wakaclock/native-producer-spool/unconfirmed').glob('*.json'))),1)
    def test_disk_failure_never_invokes_handoff(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(producer.common,'durable_file',side_effect=OSError('full')):
            with self.assertRaises(OSError): producer.run('session_start',self.input(),'/missing/cli','cli',Path(temp))
    def test_legacy_file_hooks_retain_edits_without_cli_and_discard_content(self):
        root=Path(__file__).parents[2]
        cases=[
            ('codex/heartbeat-hook.sh',{'session_id':'s','tool_use_id':'c','tool_input':{'command':'*** Begin Patch\n*** Add File: a.ts\n+PRIVATE_SOURCE_SENTINEL\n*** End Patch'},'tool_response':'Success. Updated the following files:\nA a.ts\n'}),
            ('gemini-cli/scripts/heartbeat.sh',{'session_id':'s','tool_name':'write_file','tool_input':{'file_path':'a.ts','content':'PRIVATE_SOURCE_SENTINEL'}}),
            ('plugins/atoaxis-heartbeat/scripts/heartbeat.sh',{'session_id':'s','tool_name':'Write','tool_input':{'file_path':'a.ts','content':'PRIVATE_SOURCE_SENTINEL'}}),
            ('kimi-code/hooks/post-tool-use.sh',{'session_id':'s','tool_name':'WriteFile','tool_call_id':'c','tool_input':{'file_path':'a.ts','content':'PRIVATE_SOURCE_SENTINEL'}}),
        ]
        for script,payload in cases:
            with self.subTest(script=script), tempfile.TemporaryDirectory() as temp:
                home=Path(temp);fixture=home/'fixture';fixture.mkdir()
                payload={**payload,'cwd':str(fixture),'prompt':'PRIVATE_PROMPT_SENTINEL'}
                env={**os.environ,'ATOAXIS_PRODUCER_HOME':str(home),'WAKACLOCK_CLI_PATH':str(home/'missing-cli')}
                result=subprocess.run(['bash',str(root/script)],input=json.dumps(payload).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,cwd=fixture,timeout=20)
                self.assertEqual(result.returncode,0,result.stderr.decode())
                rows=list((home/'.wakaclock/native-producer-spool/unconfirmed').glob('*.json'))
                self.assertEqual(len(rows),1)
                stored=rows[0].read_text()
                self.assertNotIn('PRIVATE_SOURCE_SENTINEL',stored);self.assertNotIn('PRIVATE_PROMPT_SENTINEL',stored)
                record=json.loads(stored);self.assertEqual(record['kind'],'file_mutation')
                self.assertEqual(record['metadata']['lines_added'],1)
                self.assertEqual(record['metadata']['entity'],str(fixture/'a.ts'))
    def test_content_rejected_before_storage(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError,'metadata_invalid'): producer.retain('session_start',{**self.input(),'prompt':'SECRET'},'/missing/cli','cli',Path(temp))
            self.assertFalse((Path(temp)/'.wakaclock').exists())
if __name__=='__main__': unittest.main()
