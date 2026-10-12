import { createHash } from "node:crypto";

/** Local cache proof binds a previously verified scope to this exact credential/origin.
 * The digest is private; neither credentials nor this record are diagnostics. */
export function rooProfileOwner(origin:string,key:string):string {
  if(!origin || !key) throw new Error("roo_owner_unconfirmed");
  return createHash("sha256").update(`${origin.replace(/\/$/,"")}\0${key}`).digest("hex");
}
export function cachedRooProfile(value:unknown,owner:string):{scope_id:string;cli_path:string} {
  const stored=value as {scope_id?:unknown;cli_path?:unknown;owner_binding?:unknown;contract?:unknown}|null;
  if(!stored || stored.owner_binding!==owner || stored.contract!=="roo_public_task_bridge_v1"
      || typeof stored.scope_id!=="string" || !/^[a-f0-9]{64}$/.test(stored.scope_id)
      || typeof stored.cli_path!=="string" || !stored.cli_path || /[\x00-\x1f]/.test(stored.cli_path))
    throw new Error("roo_owner_or_receiver_unconfirmed");
  return {scope_id:stored.scope_id,cli_path:stored.cli_path};
}

/** Read-only Roo 3.53.0 public events. Extra token/tool/message arguments are ignored. */
export interface RooPublicApi {
  on(event: string, listener: (taskId: unknown) => void): unknown;
  off(event: string, listener: (taskId: unknown) => void): unknown;
}
export interface RooSpool {
  retainRooMarker(profile: {scope_id:string;cli_path:string}, taskId:string, event:string): unknown;
  confirmRooProject(profile:{scope_id:string}, taskId:string, root:string, home?:string, expectedRevision?:number): unknown;
}
export class RooBridge {
  private listeners: [string,(task:unknown)=>void][]=[];
  private tasks=new Set<string>();
  private stopped=false;
  private lastDurableAt:string|undefined;
  private captureStatus="unconfirmed";
  private contextStatus="unresolved";
  public constructor(private api:RooPublicApi, private spool:RooSpool, private profile:{scope_id:string;cli_path:string}, public readonly providerVersion:string, private failure:()=>void) {
    if(providerVersion!=="3.53.0" || typeof api.on!=="function" || typeof api.off!=="function") throw new Error("roo_provider_contract_evidence_pending");
    try { for(const event of ["taskStarted","taskCompleted","taskAborted","taskUserMessage","taskToolFailed"]) {
      const listener=(task:unknown)=>{
        if(this.stopped || typeof task!=="string" || !task || task.length>512 || /[\x00-\x1f]/.test(task)) return;
        this.tasks.add(task);
        try {
          const retained=this.spool.retainRooMarker(this.profile,task,event) as {record?:{observed_at?:string;metadata?:{context_provenance?:string}}}|undefined;
          if(retained?.record) {this.lastDurableAt=retained.record.observed_at;this.captureStatus="observed";this.contextStatus=retained.record.metadata?.context_provenance==="user_confirmed"?"user_confirmed":"unresolved";}
          else {this.captureStatus="paused_by_user";}
        } catch { this.captureStatus="capture_failure";this.failure(); }
      };
      this.listeners.push([event,listener]);api.on(event,listener);
    }} catch { this.dispose(); throw new Error("roo_public_bridge_setup_failed"); }
  }
  public health() {return {adapter_id:"roo-code",execution_surface:"ide",provider_version:this.providerVersion,development_status:"implemented",runtime_status:this.stopped?"stopped":this.captureStatus,context_status:this.contextStatus,last_successful_observation:this.lastDurableAt??null,certification_status:"pending",delivery_status:"check_shared_spool_inbox_and_delivery_diagnostics"};}
  public observedTasks():string[] {return [...this.tasks].sort();}
  public confirm(task:string,root:string,revision:number):unknown {
    if(this.stopped || !this.tasks.has(task)) throw new Error("roo_task_identity_unconfirmed");
    return this.spool.confirmRooProject(this.profile,task,root,undefined,revision);
  }
  public dispose():void {this.stopped=true;for(const [event,listener] of this.listeners)this.api.off(event,listener);this.listeners=[];this.tasks.clear();}
}
