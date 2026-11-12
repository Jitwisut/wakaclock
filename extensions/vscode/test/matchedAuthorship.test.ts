import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { AUTHORSHIP_TTL_MS, isAuthorshipAcknowledgement, reconcileAuthorship, type AuthorshipObservation } from "../src/matchedAuthorship";
import { AiAttributionStore, type AiEditEvent } from "../src/aiAttribution";
import { HeartbeatBufferManager } from "../src/buffer";
import { Logger } from "../src/logging";
const scope="a".repeat(64), fp=`sha256:${createHash("sha256").update("hello").digest("hex")}`;
const observation=():AuthorshipObservation=>({heartbeatId:"hb",revision:0,scope,entity:"/project/a.ts",timeMs:10_000,fingerprint:fp,expiresAt:100_000});
const event=(id="event"):AiEditEvent=>({event_id:id,owner_scope_id:scope,entity:"/project/a.ts",time:10,agent:"claude-code",lines_added:null,lines_deleted:null,authorship_fingerprint:fp,authorship_proof_version:1});
const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>fs.rm(d,{recursive:true,force:true})));});
describe("display authorship reconciliation",()=>{
 it("requires proof, owner, file and the unchanged 15 second window",()=>{
  for(const change of [{owner_scope_id:"b".repeat(64)},{entity:"/other"},{time:25.001},{authorship_fingerprint:undefined},{authorship_proof_version:undefined},{authorship_proof_version:2},{agent:"codex"}]) {
   expect(reconcileAuthorship([observation()],[{...event(),...change}],20_000)[0].request).toBeUndefined();
  }
  expect(reconcileAuthorship([observation()],[event()],20_000)[0].request?.proof).toBe("fingerprint");
 });
 it("accepts existing tool identity without a fingerprint and deduplicates one operation",()=>{
  const o={...observation(),fingerprint:undefined,toolId:"tool"};
  expect(reconcileAuthorship([o],[{...event(),tool_event_id:"tool"},{...event("duplicate"),tool_event_id:"tool"}],20_000)[0].request?.proof).toBe("tool_id");
 });
 it("uses one server evidence reference for hook and transcript copies",()=>{
  const hook={...event("hook"),session_id:"session",tool_event_id:"tool"};
  const transcript={...event("transcript"),session_id:"session",tool_event_id:"tool",
   canonical_operation_id:"alias",authorship_fingerprint:undefined,authorship_proof_version:undefined};
  const [first]=reconcileAuthorship([observation()],[hook],20_000);
  const [second]=reconcileAuthorship([{...observation(),heartbeatId:"second",toolId:"tool"}],[transcript],20_000);
  expect(first.request?.evidence_id).toMatch(/^claude-operation-[a-f0-9]{64}$/);
  expect(first.request?.evidence_id).toBe(second.request?.evidence_id);
  expect(first.request?.digest).not.toBe(second.request?.digest);
 });
 it("revokes late ambiguity and keeps the request until acknowledged",()=>{
  const first=reconcileAuthorship([observation()],[event()],20_000);
  const digest=first[0].request!.digest;
  expect(reconcileAuthorship(first,[event(),event("other")],21_000)[0].request).toMatchObject({digest,operation:"revoke"});
  const two=reconcileAuthorship([observation(),{...observation(),heartbeatId:"second"}],[event()],20_000);
  expect(two.every(o=>o.request?.operation==="revoke")).toBe(true);
  expect(reconcileAuthorship(first,[],100_000)[0].request).toMatchObject({digest,operation:"revoke"});
  expect(reconcileAuthorship([observation()],[event()],100_000)).toEqual([]);
  first[0].acknowledged = true;
  expect(reconcileAuthorship(first,[],100_000)).toEqual([]);
 });
 it("parks an unverified legacy request but preserves its original revoke",()=>{
  const [staged]=reconcileAuthorship([observation()],[event()],20_000);
  const original=structuredClone(staged.request!);
  delete staged.proofVersion;
  const [parked]=reconcileAuthorship([staged],[],100_000);
  expect(parked.request).toEqual(original);
  expect(parked.blockedReason).toBe("unverified_legacy_fingerprint");
  parked.request={...original,operation:"revoke"};
  expect(reconcileAuthorship([parked],[],100_000)[0].blockedReason).toBeUndefined();
  expect(isAuthorshipAcknowledgement(parked.request,{digest:original.digest,status:"matched"})).toBe(false);
  expect(isAuthorshipAcknowledgement(parked.request,{digest:original.digest,status:"revoked"})).toBe(true);
 });
 it.each(["text"])("retains the original %s payload and retries receipts after expiry and restart",async(mode)=>{
  const clock=vi.spyOn(Date,"now");
  clock.mockReturnValue(31_000);
  try {
  const home=await fs.mkdtemp(path.join(os.tmpdir(),"authorship-test-"));dirs.push(home);
  await fs.mkdir(path.join(home,".wakaclock"));
  const accepted:any[]=[];
  const send=vi.fn().mockImplementation(async(_scope,request)=>({status:"base_pending",digest:request.digest}));
  const cli={sendHeartbeat:vi.fn(),acceptJournalBatch:vi.fn(async(_scope,payloads)=>{accepted.push(...structuredClone(payloads));return payloads.map((p:any)=>({heartbeat_id:p.heartbeat_id,status:"accepted"}));}),sendMatchedAuthorship:send};
  const config=()=>({cliPath:"",flushIntervalMs:30000,heartbeatRateLimitMs:120000,sameFileHeartbeatMs:120000,idleMs:900000,statusBarEnabled:true,debugLogging:false,trackDebugSessions:true,trackBuildTasks:true,trackClipboardActions:true});
  const create=()=>{const m=new HeartbeatBufferManager(config,cli,new Logger(()=>false),undefined,new AiAttributionStore(home));m.setAttributionOwnerScopes([scope]);m.enableJournal(path.join(home,"journal"),scope);return m;};
  const doc=(text:string,version:number)=>({uri:{scheme:"file",fsPath:"/project/a.ts"},version,getText:()=>text}) as any;
  const first=create();
  if(mode==="external") {
   await first.recordExternalFileChange("/project/a.ts",{
    event_id:"external-heartbeat",content_fingerprint:fp,lines_added:1,lines_deleted:0
   },10_000);
   expect(accepted[0]).toMatchObject({heartbeat_id:"external-heartbeat",active_seconds:0});
  } else {
   first.updateCursor(doc("",0),undefined,undefined,10_000);
   await first.recordTextChange(doc("hello",1),[{text:"hello",rangeLength:0}],undefined,10_000);
   await first.flushDueBuffers("timer",31_000);
   expect(accepted[0]).toMatchObject({chars_added:5});
  }
  expect(accepted[0]).toMatchObject({actor_type:"unknown",unattributed_lines_added:1});
  const original=structuredClone(accepted[0]);
  await fs.writeFile(path.join(home,".wakaclock","ai-events.jsonl"),
    JSON.stringify({...event(), schema_version:2, stream_id:"broker", sequence:1,
      content_fingerprint:null, authorship_display_only:true})+"\n");
  await first.reconcileMatchedAuthorship();expect(send).toHaveBeenCalledTimes(1);
  const request=structuredClone(send.mock.calls[0][1]);first.closeJournal();
  clock.mockReturnValue(31_000+AUTHORSHIP_TTL_MS+1);
  const second=create();
  second.setAttributionOwnerScopes(["b".repeat(64)]);
  await second.reconcileMatchedAuthorship();
  expect(send).toHaveBeenCalledTimes(1);
  second.setAttributionOwnerScopes([scope]);
  send.mockImplementationOnce(async()=>({status:"matched",digest:"wrong"}));
  await second.reconcileMatchedAuthorship();
  send.mockImplementationOnce(async(_scope,r)=>({status:"matched",digest:r.digest}));
  await second.reconcileMatchedAuthorship();
  expect(send.mock.calls[2][1]).toEqual(request);
  await second.reconcileMatchedAuthorship();expect(send).toHaveBeenCalledTimes(3);
  expect(accepted).toEqual([original]);second.closeJournal();
  } finally { clock.mockRestore(); }
 });
});
