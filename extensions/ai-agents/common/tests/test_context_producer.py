import importlib.util
import json
import os
import uuid
from pathlib import Path
import subprocess
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

ROOT=Path(__file__).parents[1]
spec=importlib.util.spec_from_file_location('context',ROOT/'context-producer.py')
context=importlib.util.module_from_spec(spec);spec.loader.exec_module(context)
spec=importlib.util.spec_from_file_location('metadata_context',ROOT/'metadata-producer.py')
producer=importlib.util.module_from_spec(spec);spec.loader.exec_module(producer)

class ContextTests(unittest.TestCase):
    def test_cli_absent_branch_changes_and_credentials_never_change_frozen_context(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp);root=home/'repo';root.mkdir()
            def git(*args): return subprocess.run(['git','-C',str(root),*args],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout
            git('init','-q');git('remote','add','origin','https://credential:SENSITIVE@github.com/Owner/Repo.git?token=SENSITIVE')
            git('checkout','-qb','original');(root/'a').write_text('SENSITIVE_SOURCE')
            git('add','a');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture')
            binding=home/'.wakaclock/native-producer-bindings';binding.mkdir(parents=True)
            (binding/'codex-cli.json').write_text(json.dumps({'scope_id':'a'*64,'owner_fixed':True}))
            config=home/'context.json'
            settings={key:str(uuid.uuid4()) for key in ('user_id','organization_id','collector_id','project_id','repository_id')}
            settings.update(origin='https://stage.invalid',repository='owner/repo',queue_path=str(home/'context.sqlite'))
            config.write_text(json.dumps(settings))
            metadata={'session_id':'task','agent':'codex','cwd':str(root)}
            with patch.dict(os.environ,{'ATOAXIS_TEAM_CONTEXT_CONFIG':str(config)}):
                self.assertEqual(producer.run('session_start',metadata,'/missing-cli','cli',home),'handoff_pending')
            records=[json.loads(p.read_text()) for p in (home/'.wakaclock/native-producer-spool').rglob('*.json')]
            frozen=next(r for r in records if r.get('kind')=='session_context')
            self.assertEqual(frozen['metadata']['repository'],'owner/repo')
            self.assertEqual(frozen['metadata']['branch'],'original')
            self.assertEqual(frozen['metadata']['binding']['repository_id'],settings['repository_id'])
            self.assertEqual(frozen['scope_id'],'a'*64)
            self.assertNotIn('SENSITIVE',json.dumps(frozen));self.assertNotIn(str(root),json.dumps(frozen))
            original=json.dumps(frozen)
            git('checkout','-qb','later')
            settings['repository_id']=str(uuid.uuid4());config.write_text(json.dumps(settings))
            self.assertEqual(json.dumps(frozen),original)
            self.assertEqual(len(records),2)
    def test_git_context_is_frozen_before_cli_identity_handshake(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp);root=home/'repo';root.mkdir()
            real_run=subprocess.run
            def git(*args):return real_run(['git','-C',str(root),*args],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            git('init','-q','--initial-branch=original');git('remote','add','origin','https://github.com/o/r.git')
            def handshake(args,**kwargs):
                if args[0]=='fixture-cli':
                    git('symbolic-ref','HEAD','refs/heads/changed-by-handshake')
                    return subprocess.CompletedProcess(args,0,json.dumps({'schema_version':1,'owner_confirmed':True,'scope_id':'a'*64}).encode())
                return real_run(args,**kwargs)
            with patch.object(producer.subprocess,'run',side_effect=handshake):
                _,record=producer.retain('session_start',{'session_id':'s','agent':'codex','cwd':str(root)},'fixture-cli','cli',home)
            contexts=[json.loads(p.read_text()) for p in (home/'.wakaclock/native-producer-spool').rglob('*.json') if json.loads(p.read_text()).get('kind')=='session_context']
            self.assertEqual(contexts[0]['metadata']['branch'],'original')
            self.assertEqual(contexts[0]['observed_at'],record['observed_at'])
    def test_historical_unknown_identity_and_multiple_roots_never_read_git(self):
        now=datetime.now(timezone.utc).isoformat()
        for metadata,reason,at in [({'session_id':'s','cwd':'/repo'},'historical_context_unavailable','2020-01-01T00:00:00Z'),({'cwd':'/repo'},'native_session_unavailable',now),({'taskId':'s','workspaceRoots':['/a','/b']},'repository_context_ambiguous',now),({'sessionID':'s'},'workspace_evidence_unavailable',now)]:
            with patch.object(context.subprocess,'run') as git:
                frozen=context.freeze('codex',metadata,at)
                self.assertEqual(frozen['reason'],reason);git.assert_not_called()
                self.assertIsNone(frozen['repository'])
    def test_pause_retains_no_context_or_primary_observation(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp);root=home/'.wakaclock';root.mkdir()
            (root/'runtime-desired.json').write_text(json.dumps({'schema_version':1,'desired':{'capture':False}}))
            self.assertEqual(producer.run('session_start',{'agent':'codex','session_id':'s','cwd':'/repo'},'/missing','cli',home),'paused_by_user')
            self.assertFalse((root/'native-producer-spool').exists())
    def test_failure_to_commit_context_never_acknowledges_primary(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(producer.common,'durable_file',side_effect=OSError('full')):
            with self.assertRaises(OSError): producer.run('session_start',{'agent':'codex','session_id':'s'},'/missing','cli',Path(tmp))
            self.assertFalse(list(Path(tmp).rglob('*.json')))

if __name__=='__main__':unittest.main()
