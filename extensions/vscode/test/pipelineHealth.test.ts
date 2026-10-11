import {describe, expect, it} from 'vitest';
import {assessPipeline, pipelineTransitionKey, type PipelineStage} from '../src/pipelineHealth';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const now=Date.parse('2026-10-12T00:00:00Z');
const observed:PipelineStage={adapter_id:'codex',execution_surface:'unknown',stage:'context',status:'observed',pending:0,failure_count:0,last_observed_at:new Date(now).toISOString(),oldest_pending_at:null,error_code:null,version:'fixture'};
describe('pipeline health',()=>{
 it('does not infer capture from empty or absent queues',()=>{
  expect(assessPipeline(undefined,now).state).toBe('unknown');
  expect(assessPipeline([],now).state).toBe('unknown');
  expect(assessPipeline([{...observed,status:'unconfirmed'}],now).state).toBe('unknown');
  expect(assessPipeline([observed],now).state).toBe('complete');
 });
 it('keeps upstream faults visible alongside pending delivery',()=>{
  expect(assessPipeline([{...observed,stage:'server_delivery',status:'pending',pending:1},{...observed,status:'auth_required'}],now).state).toBe('critical');
  expect(assessPipeline([{...observed,pending:1,oldest_pending_at:new Date(now-301000).toISOString()}],now).state).toBe('warning');
  expect(assessPipeline([{...observed,pending:1,oldest_pending_at:new Date(now-1801000).toISOString()}],now).state).toBe('critical');
 });
 it('fails closed on stale, missing observations, pause and invalid timestamps',()=>{
  expect(assessPipeline([{...observed,last_observed_at:new Date(now-301000).toISOString()}],now).state).toBe('stale');
  expect(assessPipeline([{...observed,last_observed_at:'invalid'}],now).state).toBe('unknown');
  expect(assessPipeline([{...observed,status:'paused_by_user'}],now).state).toBe('unavailable');
  expect(assessPipeline([{...observed,last_observed_at:null}],now).state).toBe('unknown');
 });
 it('notifies only semantic transitions, not poll times or counts',()=>{
  expect(pipelineTransitionKey([observed])).toBe(pipelineTransitionKey([{...observed,pending:3,last_observed_at:new Date(now+1000).toISOString()}]));
  expect(pipelineTransitionKey([observed])).not.toBe(pipelineTransitionKey([{...observed,status:'auth_required'}]));
 });
 it('uses the same interpretation in dashboard and VS Code',()=>{
  const normalize=(text:string)=>text.replace(/\s/g,'');
  expect(normalize(readFileSync(resolve('src/pipelineHealth.ts'),'utf8'))).toBe(normalize(readFileSync(resolve('../../frontend/app/lib/wakaclock/pipeline-health.ts'),'utf8')));
 });
});
