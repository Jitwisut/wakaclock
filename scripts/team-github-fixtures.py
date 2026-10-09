#!/usr/bin/env python3
"""Separate fixture writer; refuses every repository except the approved private test repo.
The analytics GitHub App is never used to write commits, PRs, issues or workflow files.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
REPOSITORY='Jitwisut/atoaxis-team-github-fixture'
OUT=ROOT/'output/team-github-staging/fixture-writer'

def run(args,**kwargs):
    return subprocess.check_output(args,text=True,**kwargs).strip()

def api(path,fields=None):
    args=['gh','api',path]
    for key,value in (fields or {}).items():args += ['-f',key+'='+value]
    return json.loads(run(args))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--seed',action='store_true');args=parser.parse_args()
    metadata=api('repos/'+REPOSITORY)
    if metadata['full_name']!=REPOSITORY or not metadata['private'] or metadata['owner']['login']!='Jitwisut':raise SystemExit('Refuse non-fixture/private scope')
    if not args.seed:
        print(json.dumps({'repository':REPOSITORY,'private':True,'writes_enabled':False}));return
    OUT.mkdir(parents=True,exist_ok=True)
    if (OUT/'expected-ledger.json').exists():raise SystemExit('Fixture ledger already exists; inspect before adding a new fixture run')
    source=OUT/'repository';source.mkdir(exist_ok=True)
    env={**os.environ,'GIT_AUTHOR_NAME':'AtoAxis test fixture','GIT_AUTHOR_EMAIL':'fixture@example.test','GIT_COMMITTER_NAME':'AtoAxis test fixture','GIT_COMMITTER_EMAIL':'fixture@example.test'}
    def git(*parts):return run(['git',*parts],cwd=source,env=env)
    git('init','-q','-b','fixture-base');git('remote','add','origin','https://github.com/'+REPOSITORY+'.git')
    (source/'README.md').write_text('Synthetic metadata fixture. No real source or prompt data.\n')
    workflows=source/'.github/workflows';workflows.mkdir(parents=True,exist_ok=True)
    (workflows/'fixture.yml').write_text('name: Synthetic check\non:\n  pull_request:\njobs:\n  metadata-check:\n    runs-on: ubuntu-latest\n    steps:\n      - run: exit 0\n')
    git('add','README.md','.github/workflows/fixture.yml');git('commit','-q','-m','Create isolated metadata fixture');git('push','-u','origin','fixture-base')
    run(['gh','repo','edit',REPOSITORY,'--default-branch','fixture-base'])
    issue=api('repos/'+REPOSITORY+'/issues',{'title':'Synthetic linked issue','body':'This test issue contains no user content.'})
    git('checkout','-q','-b','fixture/open-pr');(source/'fixture-marker.txt').write_text('Synthetic test marker\n');git('add','fixture-marker.txt');git('commit','-q','-m','Add test marker');git('push','-u','origin','fixture/open-pr')
    pr=api('repos/'+REPOSITORY+'/pulls',{'title':'Synthetic integration PR','head':'fixture/open-pr','base':'fixture-base','body':'Closes #'+str(issue['number'])})
    ledger={'repository_id':metadata['id'],'repository':REPOSITORY,'private':True,'base_branch':'fixture-base','open_issue':{'id':issue['id'],'number':issue['number']},'open_pr':{'id':pr['id'],'number':pr['number'],'head_sha':pr['head']['sha'],'head_branch':pr['head']['ref']},'review_from_other_user':'pending','historical_90_day_boundary':'pending','fixture_source_not_analytics_payload':True}
    (OUT/'expected-ledger.json').write_text(json.dumps(ledger,indent=2));print('Seeded approved fixture repository; expected metadata ledger saved')

if __name__=='__main__':main()
