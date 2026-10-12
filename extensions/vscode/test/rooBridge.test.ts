import { EventEmitter } from "node:events";
import { describe,it,expect,vi } from "vitest";
import { cachedRooProfile, rooProfileOwner, RooBridge } from "../src/rooBridge";
describe("Roo public bridge",()=>{
  it("detaches a partially registered API when installation fails",()=>{
    const api=new EventEmitter();const on=api.on.bind(api);api.on=((event:string,listener:(...args:any[])=>void)=>{if(event==="taskAborted")throw Error("provider unavailable");return on(event,listener);}) as typeof api.on;
    expect(()=>new RooBridge(api,{retainRooMarker:vi.fn(),confirmRooProject:vi.fn()},{scope_id:"a".repeat(64),cli_path:"fixture"},"3.53.0",vi.fn())).toThrow("setup_failed");
    expect(api.eventNames()).toEqual([]);
  });
  it("retains actual task identity, ignores extra sensitive arguments and never reads workspace",()=>{
    const api=new EventEmitter();const spool={retainRooMarker:vi.fn(),confirmRooProject:vi.fn()};
    const bridge=new RooBridge(api,spool,{scope_id:"a".repeat(64),cli_path:"missing"},"3.53.0",vi.fn());
    api.emit("taskStarted","native-task","PRIVATE_SOURCE");api.emit("taskCompleted","native-task",{prompt:"PRIVATE_PROMPT"},{source:"PRIVATE_SOURCE"});
    expect(spool.retainRooMarker.mock.calls.map(c=>c.slice(1))).toEqual([["native-task","taskStarted"],["native-task","taskCompleted"]]);
    expect(()=>bridge.confirm("guessed-task","/fixture",0)).toThrow("identity_unconfirmed");
    bridge.confirm("native-task","/explicit-confirmation",0);expect(spool.confirmRooProject).toHaveBeenCalledWith(expect.any(Object),"native-task","/explicit-confirmation",undefined,0);
    bridge.dispose();api.emit("taskStarted","late-task");expect(spool.retainRooMarker).toHaveBeenCalledTimes(2);expect(bridge.observedTasks()).toEqual([]);
  });
  it("fails visibly on durable write failure, rejects unverified versions and detaches listeners",()=>{
    const api=new EventEmitter();const failure=vi.fn();const spool={retainRooMarker:vi.fn(()=>{throw Error("write denied");}),confirmRooProject:vi.fn()};
    expect(()=>new RooBridge(api,spool,{scope_id:"a".repeat(64),cli_path:"fixture"},"unknown",failure)).toThrow("evidence_pending");
    const bridge=new RooBridge(api,spool,{scope_id:"a".repeat(64),cli_path:"fixture"},"3.53.0",failure);
    api.emit("taskToolFailed","task","tool","SENSITIVE ERROR");expect(failure).toHaveBeenCalledOnce();expect(bridge.health().runtime_status).toBe("capture_failure");
    api.emit("taskStarted",{});expect(spool.retainRooMarker).toHaveBeenCalledOnce();bridge.dispose();expect(api.listenerCount("taskStarted")).toBe(0);
  });
});

it("offline cache never adopts another account, origin or unsupported contract",()=>{
 const owner=rooProfileOwner("https://fixture.invalid/","fixture-key");
 const record={scope_id:"a".repeat(64),cli_path:"/fixture/CLI",owner_binding:owner,contract:"roo_public_task_bridge_v1"};
 expect(cachedRooProfile(record,rooProfileOwner("https://fixture.invalid","fixture-key"))).toEqual({scope_id:record.scope_id,cli_path:record.cli_path});
 for(const other of [rooProfileOwner("https://other.invalid","fixture-key"),rooProfileOwner("https://fixture.invalid","changed-key")]) expect(()=>cachedRooProfile(record,other)).toThrow("roo_owner_or_receiver_unconfirmed");
 for(const bad of [{...record,contract:"legacy"},{...record,scope_id:"unknown"},{...record,cli_path:""}]) expect(()=>cachedRooProfile(bad,owner)).toThrow();
 expect(JSON.stringify(record)).not.toContain("fixture-key");
});
