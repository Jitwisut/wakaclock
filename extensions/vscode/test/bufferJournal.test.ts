import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { HeartbeatBufferManager } from "../src/buffer";
import { Logger } from "../src/logging";
import type { WakaclockConfigSnapshot } from "../src/types";
const directories: string[]=[];
const config=():WakaclockConfigSnapshot=>({cliPath:"",flushIntervalMs:30000,heartbeatRateLimitMs:120000,sameFileHeartbeatMs:120000,idleMs:900000,statusBarEnabled:true,debugLogging:false,trackDebugSessions:true,trackBuildTasks:true,trackClipboardActions:true});
afterEach(async()=>{await Promise.all(directories.splice(0).map(dir=>fs.rm(dir,{recursive:true,force:true})));});
describe("editor durable recovery",()=>{
  it("retains a rejected original while accepting a good sibling and preserves the dead letter after restart",async()=>{
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),"editor-dead-letter-"));directories.push(directory);
    const accept=vi.fn().mockImplementation(async(_scope,payloads)=>payloads.map((payload:any)=>({heartbeat_id:payload.heartbeat_id,status:payload.heartbeat_id==="bad-original"?"permanent_rejection":"accepted",error_code:payload.heartbeat_id==="bad-original"?"invalid_metadata":undefined})));
    const create=()=>new HeartbeatBufferManager(config,{sendHeartbeat:vi.fn(),acceptJournalBatch:accept},new Logger(()=>false));
    const first=create();first.enableJournal(directory,"scope");
    await first.recordExternalFileChange("/historical/bad.ts",{event_id:"bad-original",change_kind:"modify",lines_added:1},10000);
    await first.recordExternalFileChange("/historical/good.ts",{event_id:"good-original",change_kind:"modify",lines_added:1},10001);
    expect(first.getJournalHealth()?.deadLetter).toBe(1);expect(first.getJournalHealth()?.pending).toBeGreaterThan(0);first.closeJournal();
    const recovered=create();recovered.enableJournal(directory,"scope");
    accept.mockClear();await recovered.flushAllBuffers("shutdown",900000);
    expect(accept).not.toHaveBeenCalled();expect(recovered.getJournalHealth()?.deadLetter).toBe(1);expect(recovered.getJournalHealth()?.pending).toBeGreaterThan(0);recovered.closeJournal();
  });
  it("replays the original ID, timestamp and payload after the CLI response is lost",async()=>{
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),"editor-durable-"));directories.push(directory);
    const accept=vi.fn().mockRejectedValueOnce(new Error("response lost")).mockImplementation(async(_scope,payloads)=>payloads.map((payload:any)=>({heartbeat_id:payload.heartbeat_id,status:"duplicate"})));
    const cli={sendHeartbeat:vi.fn(),acceptJournalBatch:accept};
    const first=new HeartbeatBufferManager(config,cli,new Logger(()=>false));first.enableJournal(directory,"original-scope");
    await first.recordExternalFileChange("/historical/project/file.ts",{event_id:"original-event",change_kind:"modify",lines_added:2,lines_deleted:1},10000,"historical-project");
    expect(first.getJournalHealth()?.pending).toBe(1);
    const original=structuredClone(accept.mock.calls[0][1]);first.closeJournal();
    const recovered=new HeartbeatBufferManager(config,cli,new Logger(()=>false));recovered.enableJournal(directory,"original-scope");
    await recovered.flushAllBuffers("shutdown",900000);
    expect(accept.mock.calls[1][1]).toEqual(original);
    expect(cli.sendHeartbeat).not.toHaveBeenCalled();expect(recovered.getJournalHealth()?.pending).toBe(0);recovered.closeJournal();
  });
  it("retains other scopes unless an owner-verified recovery directory is supplied",async()=>{
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),"editor-scope-"));directories.push(directory);
    const old=path.join(directory,"old");const current=path.join(directory,"new");
    const failed=vi.fn().mockRejectedValue(new Error("offline"));const producer=new HeartbeatBufferManager(config,{sendHeartbeat:vi.fn(),acceptJournalBatch:failed},new Logger(()=>false));producer.enableJournal(old,"old-scope");
    await producer.recordExternalFileChange("/historical/file.ts",{event_id:"old-event",change_kind:"modify",lines_added:1},10000);producer.closeJournal();
    const accept=vi.fn().mockImplementation(async(_scope,payloads)=>payloads.map((payload:any)=>({heartbeat_id:payload.heartbeat_id,status:"accepted"})));
    const unrelated=new HeartbeatBufferManager(config,{sendHeartbeat:vi.fn(),acceptJournalBatch:accept},new Logger(()=>false));unrelated.enableJournal(current,"other-account");await unrelated.flushAllBuffers("shutdown",900000);expect(accept).not.toHaveBeenCalled();unrelated.closeJournal();
    const owner=new HeartbeatBufferManager(config,{sendHeartbeat:vi.fn(),acceptJournalBatch:accept},new Logger(()=>false));owner.enableJournal(current,"verified-new-key",[old]);await owner.flushAllBuffers("shutdown",900000);
    expect(accept).toHaveBeenCalledWith("verified-new-key",expect.arrayContaining([expect.objectContaining({heartbeat_id:"old-event",time:10})]));owner.closeJournal();
  });
});
