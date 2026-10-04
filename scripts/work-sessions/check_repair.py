"""Replay, native pagination and repair integration checks against the isolated lab."""
import sys,json,uuid,subprocess,time,urllib.error
from datetime import datetime,timezone
from pathlib import Path

from local_lab import ROOT,REPO,env,request,private_json
from receipt_readback import receipt_id,session_scope
from runtime_binding import preflight
from build_manifest import file_digest


def main():
    build=preflight()
    account=json.loads((ROOT/'campaign-account.json').read_text())
    token=account['api_key']
    campaign=json.loads((ROOT/'evidence/codex-campaign-final.json').read_text())
    assert campaign['build_manifest_sha256']==build, 'campaign_build_mismatch'
    row=next(r for r in campaign['scenarios'] if r['scenario']=='create-delete-rename')
    ops=[];cursor=None;pages=0
    while True:
     route='/api/v2/me/work-sessions/'+row['receipt_id']+'/evidence?limit=1'
     if cursor:route+='&cursor='+cursor
     page=request(route,token=token)['data'];ops.extend(page['operations']);pages+=1
     if not page['has_more']:break
     cursor=page['next_cursor'];assert cursor and pages<10
    assert len(ops)==row['operation_count'] and len({o['event_id'] for o in ops})==len(ops) and pages==len(ops)
    stages={'native_evidence_keyset_pagination':'passed'}
    
    collector=str(uuid.uuid4());session=session_scope(collector,'codex',uuid.uuid4().hex)
    rid=receipt_id(account['user_id'],collector,'codex',session)
    at=datetime.now(timezone.utc);op=uuid.uuid4().hex
    usage={'usage_event_id':uuid.uuid4().hex,'collector_id':collector,'ai_session_id':session,'occurred_at':at.isoformat(),'agent':'codex','provider':'openai','model':'gpt-5.4','prompt_count':1,'input_tokens':0,'token_source':'transcript'}
    request('/api/v1/ai/usage','POST',token=token,payload=[usage])
    request('/api/v1/users/current/heartbeats','POST',token=token,payload={'entity':'synthetic-repair-fixture.rs','entity_type':'file','time':at.timestamp(),'heartbeat_id':op,'ai_event_id':op,'session_id':session,'machine':collector,'is_write':True,'is_ai_generated':True,'ai_agent':'codex','ai_provider':'openai','ai_model':'gpt-5.4','identity_status':'confirmed','identity_source':'agent_hook','ai_source':'agent_hook','ai_confidence':'verified','ai_lines_added':4,'ai_lines_deleted':1})
    route='/api/v2/me/work-sessions/'+rid
    before=request(route,token=token)['data']
    assert before['lines']['verified_ai_added']['value']==4
    evidence=request(route+'/evidence',token=token)['data']['operations'][0]
    repair_id=str(uuid.uuid4())
    repair='/api/v2/me/measurement-repairs/'+repair_id
    preview=request('/api/v2/me/measurement-repairs','POST',token=token,payload={'repair_id':repair_id,'start':at.date().isoformat(),'end':at.date().isoformat(),'timezone':'UTC','candidates':[{'repair_reference':evidence['repair_reference'],'outcome':'success','lines_added':2,'lines_deleted':0}]})['data']
    assert preview['ready']==1
    try:
     request(repair+'/apply','POST',token=token,payload={})
    except urllib.error.HTTPError as error:
     assert error.code==403
    else:raise AssertionError('repair_session_scope_not_enforced')
    stages['repair_requires_first_party_session']='passed'
    applied=request(repair+'/apply','POST',token=account['token'],payload={})['data'];assert applied['applied']==1
    changed=request(route,token=token)['data'];assert changed['lines']['verified_ai_added']['value']==2 and changed['revision_fingerprint']!=before['revision_fingerprint']
    after_op=request(route+'/evidence',token=token)['data']['operations'][0]
    assert after_op['revision']==evidence['revision']+1 and after_op['event_id']==evidence['event_id'] and after_op['lines_added']==2
    rolled=request(repair+'/rollback','POST',token=account['token'],payload={})['data'];assert rolled['rolled_back']==1
    restored=request(route,token=token)['data'];assert restored['lines']['verified_ai_added']['value']==4 and restored['lines']['verified_ai_deleted']['value']==1
    restored_op=request(route+'/evidence',token=token)['data']['operations'][0]
    assert restored_op['revision']==evidence['revision']+2 and restored_op['lines_added']==4 and restored_op['event_id']==evidence['event_id']
    stages['repair_apply_rollback_latest_evidence']='passed'
    
    values=env();values.update(CLICKHOUSE_TEST_URL=values['CLICKHOUSE_URL'],CLICKHOUSE_TEST_USER=values['CLICKHOUSE_USER'],CLICKHOUSE_TEST_PASSWORD=values['CLICKHOUSE_PASSWORD'],POSTGRES_TEST_URL=values['POSTGRES_URL'])
    for name in ('corrections_and_deletions_override_stale_intervals_and_retries','user_job_creation_waits_for_account_tombstone_and_then_is_rejected'):
     with (ROOT/(name+'.log')).open('w') as log:
      result=subprocess.run(['cargo','test','--locked','--offline','--manifest-path','backend/api/Cargo.toml','-p','wakaclock-server','--lib',name,'--','--ignored','--test-threads=1'],cwd=REPO,env=values,stdout=log,stderr=subprocess.STDOUT)
     assert result.returncode==0 and '1 passed;' in (ROOT/(name+'.log')).read_text()
     stages[name]='passed'
    report={'schema_version':3,'build_manifest_sha256':build,'status':'passed','evidence_kind':'validation_run','runner':'check_repair','runner_sha256':file_digest(Path(__file__)),'sample_count':1,'mismatches':[],'blockers':[],'scenarios':[{'scenario':'repair_rollback','status':'passed','mismatches':[]}],'stages':stages,'pagination_pages':pages,'promotable':False}
    if preflight() != build:
        raise ValueError('build_changed_during_repair_checks')
    private_json(ROOT/'evidence/extra-runtime-checks.json',report)
    print(json.dumps(report))

if __name__ == "__main__":
    main()
