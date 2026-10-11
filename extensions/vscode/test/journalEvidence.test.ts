import { describe, it, expect } from "vitest";
import { mergeRecoveryEvidence, recoveryEvidenceBatch, validRecoveryEvidence, type RecoveryEvidence } from "../src/journalEvidence";
const row=(id: string, time: string, canonical: RecoveryEvidence['canonical']='unavailable'):RecoveryEvidence=>({heartbeatId:id,revision:0,cliStatus:'accepted',serverAck:'unconfirmed',canonical,observedAt:time});
describe('bounded recovery evidence',()=>{
 it('advances across 251 identities and resumes from the persisted cursor',()=>{
  const ids=Array.from({length:251},(_,i)=>`heartbeat-${i}`);
  let cursor=0; const observed:string[]=[];
  for(let tick=0;tick<3;tick++){const batch=recoveryEvidenceBatch(ids,cursor);expect(batch.records.length).toBeLessThanOrEqual(100); observed.push(...batch.records);cursor=JSON.parse(JSON.stringify(batch.nextCursor));}
  expect(observed).toEqual(ids);expect(cursor).toBe(0);
  expect(recoveryEvidenceBatch(ids,200).records[0]).toBe('heartbeat-200');
 });
 it('preserves untouched evidence, revision identity and ignores older replies',()=>{
  const older='2026-10-07T01:00:00Z',newer='2026-10-07T02:00:00Z';
  const prior=[row('a',newer,'found'),row('b',older)];
  const merged=mergeRecoveryEvidence(prior,[row('a',older),{...row('a',newer,'superseded'),revision:1},row('c',newer,'missing')]);
  expect(merged).toHaveLength(4);expect(merged[0].canonical).toBe('found');
  expect(merged[1]).toEqual(prior[1]);expect(merged[2].revision).toBe(1);
  expect(merged[3].canonical).toBe('missing');expect(merged[3].serverAck).toBe('unconfirmed');
 });
 it('rejects payload text, unsafe identities and invalid persisted state',()=>{
  expect(validRecoveryEvidence({...row('a','2026-10-07T01:00:00Z'),prompt:'SENSITIVE'})).toBe(false);
  expect(validRecoveryEvidence(row('/private/path','2026-10-07T01:00:00Z'))).toBe(false);
  expect(()=>recoveryEvidenceBatch([],NaN)).toThrow('cursor_invalid');
  expect(()=>mergeRecoveryEvidence([row('a','invalid')],[])).toThrow('evidence_invalid');
 });
});
