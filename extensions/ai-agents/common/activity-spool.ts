import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export interface ProducerObservation {
  schema_version: 1;
  scope_id: string;
  adapter_id: "kilo-code" | "opencode";
  execution_surface: "cli" | "ide";
  observation_id: string;
  observed_at: string;
  metadata: { hook_event_name: string; sessionID: string; callID: string; directory?: string };
}
function safe(target: string): void {
  for (let current = target; ; current = path.dirname(current)) {
    try {
      if (fs.lstatSync(current).isSymbolicLink() && !(process.platform === "darwin" && ["/var", "/tmp", "/etc"].includes(current) && fs.realpathSync(current) === `/private${current}`)) throw new Error("producer_symlink_refused");
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (path.dirname(current) === current) break;
  }
}
function write(file: string, value: unknown): void {
  safe(file); const fd = fs.openSync(file, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (process.platform !== "win32") { const parent = fs.openSync(path.dirname(file), "r"); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); } }
}
function syncDirectory(directory: string): void {
  if (process.platform === "win32") return;
  const fd = fs.openSync(directory, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
/** Called only at the real producer boundary. Side-stream is durable before
 * primary acceptance; replay sends these bytes, never asks Git again. */
function freezeContext(observedAt: string, metadata: Record<string, unknown>) {
  const session = metadata.session_id ?? metadata.sessionID;
  const directory = metadata.project_root ?? metadata.workspace_root ?? metadata.cwd ?? metadata.directory;
  const evidence: { context_version: number; native_session: string | null; repository: string | null; branch: string | null; commit_sha: string | null; reason: string | null; binding: Record<string, string> | null } = {context_version:1,native_session:typeof session === "string" && session.length > 0 && session.length <= 512 && !/[\x00-\x1f]/.test(session) ? session : null,repository:null,branch:null,commit_sha:null,reason:null,binding:null};
  const at=typeof metadata.occurred_at === "string" ? metadata.occurred_at : observedAt;
  const read=(args:string[])=>{try {return execFileSync("git",["-C", directory as string,...args],{encoding:"utf8",timeout:2000,maxBuffer:4096,stdio:["ignore","pipe","ignore"]}).trim();}catch{return undefined;}};
  if (!evidence.native_session) evidence.reason="native_session_unavailable";
  else if (typeof directory !== "string" || !path.isAbsolute(directory)) evidence.reason="workspace_evidence_unavailable";
  else if (!Number.isFinite(Date.parse(at)) || Math.abs(Date.now()-Date.parse(at))>30000) evidence.reason="historical_context_unavailable";
  else {
    const remote=read(["config","--local","--get","remote.origin.url"]);
    let coordinates:string|undefined;
    if (remote?.startsWith("git@github.com:")) coordinates=remote.slice(15);
    else if(remote) try {const url=new URL(remote); if(["https:","ssh:"].includes(url.protocol)&&url.hostname==="github.com"&&!url.port) coordinates=url.pathname.replace(/^\//,"");}catch{}
    coordinates=coordinates?.replace(/\/$/,"").replace(/\.git$/,"");
    if(coordinates && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(coordinates) && !coordinates.split("/").some(p=>[".",".."].includes(p))) {
      evidence.repository=coordinates.toLowerCase();
      const configuration=process.env.ATOAXIS_TEAM_CONTEXT_CONFIG;
      if(configuration) try {
        safe(configuration);
        if(fs.statSync(configuration).size>16*1024) throw new Error("context_configuration_limit");
        const settings=JSON.parse(fs.readFileSync(configuration,"utf8"));
        const fields=["origin","user_id","organization_id","collector_id","project_id","repository_id","repository"];
        const binding=Object.fromEntries(fields.map(key=>[key,settings[key]]));
        const origin=new URL(binding.origin);
        if(fields.slice(1,-1).every(key=>typeof binding[key]==="string"&&/^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$/.test(binding[key])) && ["https:","http:"].includes(origin.protocol) && !origin.username && !origin.password && !origin.search && !origin.hash && origin.pathname==="/" && binding.repository.toLowerCase()===evidence.repository) evidence.binding={...binding,repository:evidence.repository};
      }catch{}

      const branch=read(["symbolic-ref","--quiet","--short","HEAD"]);
      if(branch&&branch.length<=256&&!/[\x00-\x1f]/.test(branch)) evidence.branch=branch;
      const sha=read(["rev-parse","--verify","HEAD"]);
      if(sha&&/^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(sha)) evidence.commit_sha=sha.toLowerCase();
    } else evidence.reason="repository_evidence_unavailable";
  }
  return evidence;
}
function retainContext(record: { scope_id: string; adapter_id: string; execution_surface: string; observed_at: string; observation_id: string }, evidence: ReturnType<typeof freezeContext>, root: string): void {
  const context={...record,schema_version:2,observation_id:(()=>{const h=createHash("sha256").update(`${record.scope_id}:${record.observation_id}:context`).digest("hex").slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;})(),kind:"session_context",payload_hash:createHash("sha256").update(canonicalMetadata(evidence)).digest("hex"),metadata:evidence};
  const stage=path.join(root,`${context.observation_id}.context-stage`);
  write(stage,context);fs.renameSync(stage,path.join(root,`${context.observation_id}.json`));syncDirectory(root);
}
export function runProducerCli(cli: string, args: string[], payload?: unknown): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, { stdio: ["pipe", "pipe", "ignore"] });
    let bytes = ""; const timer = setTimeout(() => { child.kill(); reject(new Error("producer_cli_timeout")); }, 8000);
    child.stdout.on("data", chunk => { bytes += chunk.toString(); if (Buffer.byteLength(bytes) > 16384) { child.kill(); reject(new Error("producer_cli_ack_invalid")); } });
    child.stdin.on("error", () => reject(new Error("producer_cli_unavailable")));
    child.once("error", () => { clearTimeout(timer); reject(new Error("producer_cli_unavailable")); });
    child.once("close", code => { clearTimeout(timer); try { if (code !== 0) throw new Error(); resolve(JSON.parse(bytes)); } catch { reject(new Error("producer_cli_ack_invalid")); } });
    child.stdin.end(payload === undefined ? undefined : JSON.stringify(payload));
  });
}
/** Disk acceptance precedes handoff; only the shared Rust collector removes files.
 * Unconfirmed observations remain parked separately and are never rebound by name.
 */
export async function retainToolMarker(cli: string, input: { adapter: "kilo-code" | "opencode"; phase: "before" | "after" | "failure"; surface: "cli" | "ide"; sessionId: string; callId: string; directory?: string; observedAt?: string }, home = homedir()): Promise<{ file: string; observation: ProducerObservation } | undefined> {
  const observedAt = input.observedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("producer_timestamp_invalid");
  const base = path.join(home, ".wakaclock"); safe(base);
  const runtimeFile = path.join(base, "runtime-desired.json"); safe(runtimeFile);
  if (fs.existsSync(runtimeFile)) {
    const state = JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
    if (state.schema_version !== 1 || !state.desired || !Array.isArray(state.intervals)) throw new Error("producer_runtime_unconfirmed");
    if (state.desired.capture === false) return undefined;
  }
  const metadata = { hook_event_name: `tool.execute.${input.phase}`, sessionID: input.sessionId, callID: input.callId, ...(input.directory ? {directory:input.directory} : {}) };
  if (Object.values(metadata).some(value => typeof value !== "string" || value.length > 4096) || (input.directory !== undefined && !path.isAbsolute(input.directory))) throw new Error("producer_metadata_invalid");
  const frozenContext = freezeContext(observedAt,metadata);
  const bindings = path.join(base, "native-producer-bindings"); safe(bindings); fs.mkdirSync(bindings, { recursive: true, mode: 0o700 });
  const binding = path.join(bindings, `${input.adapter}-${input.surface}.json`); safe(binding);
  let scope: string | undefined;
  let fixed = false;
  if (fs.existsSync(binding)) {
    const existing = JSON.parse(fs.readFileSync(binding, "utf8"));
    if (!/^[a-f0-9]{64}$/.test(existing.scope_id ?? "")) throw new Error("producer_scope_unconfirmed");
    scope = existing.scope_id; fixed = existing.owner_fixed === true;
  }
  if (!fixed) try {
    const handshake = await runProducerCli(cli, ["journal-scope"]);
    if (handshake.schema_version !== 1 || handshake.owner_confirmed !== true || !/^[a-f0-9]{64}$/.test(handshake.scope_id ?? "") || !handshake.capabilities?.includes("activity_envelope_v3")) throw new Error();
    scope = handshake.scope_id;
    const stage = path.join(bindings, `${randomUUID()}.metadata`); write(stage, { scope_id: scope }); fs.renameSync(stage, binding);
    if (process.platform !== "win32") { const fd = fs.openSync(bindings, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
  } catch {
    if (fs.existsSync(binding)) { const existing = JSON.parse(fs.readFileSync(binding, "utf8")); if (/^[a-f0-9]{64}$/.test(existing.scope_id ?? "")) scope = existing.scope_id; }
  }
  const observation: ProducerObservation = { schema_version: 1, scope_id: scope ?? "unconfirmed", adapter_id: input.adapter, execution_surface: input.surface, observation_id: randomUUID(), observed_at: observedAt, metadata };
  const root = path.join(base, "native-producer-spool", observation.scope_id); safe(root); fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  for (const parent of [path.dirname(root), base, home]) syncDirectory(parent);
  retainContext(observation, frozenContext, root);
  const file = path.join(root, `${observation.observation_id}.json`); write(file, observation);
  if (!scope) throw new Error("producer_scope_unconfirmed_retained");
  try {
    await runProducerCli(cli, ["ai", "activity-hook", "--adapter", input.adapter, "--surface", input.surface, "--scope-id", scope, "--observation-id", observation.observation_id, "--observed-at", observation.observed_at], metadata);
  } catch { /* Already retained: the idle collector performs the durable reconciliation. */ }
  return { file, observation };
}

export type MetadataKind = "file_mutation" | "session_start" | "session_end" | "tool_before" | "tool_after" | "tool_abort";
const FILE_FIELDS = ["schema_version", "producer_version", "event_type", "event_id", "occurred_at", "entity", "project_root", "change_kind", "previous_entity", "agent", "provider", "model", "session_id", "source", "confidence", "lines_added", "lines_deleted", "active_seconds", "transport", "tool", "tool_event_id", "editor", "producer_surface"];
const SESSION_FIELDS = ["session_id", "agent", "provider", "model", "cwd", "source", "occurred_at"];
const TOOL_FIELDS = ["tool_event_id", "agent", "provider", "model", "session_id", "tool", "transport", "workspace_root", "cwd"];
export function canonicalMetadata(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])));
}
/** Fixed scalar contracts only; never retain native inputs, command arguments or outputs. */
export async function retainMetadata(cli: string, input: { adapter: string; surface: "cli" | "ide" | "desktop" | "unknown"; kind: MetadataKind; metadata: Record<string, unknown>; observedAt?: string }, home = homedir()) {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const fields = input.kind === "file_mutation" ? FILE_FIELDS : input.kind.startsWith("session_") ? SESSION_FIELDS : TOOL_FIELDS;
  if (!Number.isFinite(Date.parse(observedAt)) || Object.entries(input.metadata).some(([key, value]) => !fields.includes(key) || !(value === null || typeof value === "number" && Number.isFinite(value) || typeof value === "string" && value.length <= 4096 && !value.startsWith("{") && !value.startsWith("[")))) throw new Error("producer_metadata_invalid");
  const metadata = { ...input.metadata };
  if (input.kind.startsWith("session_") && metadata.occurred_at == null) metadata.occurred_at = observedAt;
  const base = path.join(home, ".wakaclock"); safe(base);
  const runtimeFile = path.join(base, "runtime-desired.json"); safe(runtimeFile);
  if (fs.existsSync(runtimeFile)) {
    const runtime = JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
    if (runtime.schema_version !== 1 || !runtime.desired || !Array.isArray(runtime.intervals)) throw new Error("producer_runtime_unconfirmed");
    if (runtime.desired.capture === false) return undefined;
  }
  const frozenContext = freezeContext(observedAt,metadata);
  const bindings = path.join(base, "native-producer-bindings"); safe(bindings); fs.mkdirSync(bindings, { recursive: true, mode: 0o700 });
  const binding = path.join(bindings, `${input.adapter}-${input.surface}.json`); safe(binding);
  let scope: string | undefined;
  let fixed = false;
  if (fs.existsSync(binding)) {
    const existing = JSON.parse(fs.readFileSync(binding, "utf8"));
    if (!/^[a-f0-9]{64}$/.test(existing.scope_id ?? "")) throw new Error("producer_scope_unconfirmed");
    scope = existing.scope_id; fixed = existing.owner_fixed === true;
  }
  if (!fixed) try {
    const handshake = await runProducerCli(cli, ["journal-scope"]);
    if (handshake.schema_version !== 1 || handshake.owner_confirmed !== true || !/^[a-f0-9]{64}$/.test(handshake.scope_id ?? "")) throw new Error();
    scope = handshake.scope_id;
    const stage = path.join(bindings, `${randomUUID()}.metadata`); write(stage, {scope_id:scope}); fs.renameSync(stage, binding); syncDirectory(bindings);
  } catch {
    if (fs.existsSync(binding)) { const old = JSON.parse(fs.readFileSync(binding, "utf8")); if (/^[a-f0-9]{64}$/.test(old.scope_id ?? "")) scope = old.scope_id; }
  }
  const { createHash } = await import("node:crypto");
  const record = {schema_version:2,scope_id:scope ?? "unconfirmed",adapter_id:input.adapter,execution_surface:input.surface,observation_id:randomUUID(),observed_at:observedAt,kind:input.kind,payload_hash:createHash("sha256").update(canonicalMetadata(metadata)).digest("hex"),metadata};
  const root = path.join(base, "native-producer-spool", record.scope_id); safe(root); fs.mkdirSync(root, {recursive:true,mode:0o700});
  for (const parent of [path.dirname(root), base, home]) syncDirectory(parent);
  retainContext(record, frozenContext, root);
  const file = path.join(root, `${record.observation_id}.json`); write(file, record);
  if (!scope) throw new Error("producer_scope_unconfirmed_retained");
  try { await runProducerCli(cli, ["ai","producer-batch","--json"], {schema_version:2,records:[record]}); } catch { /* Original stays until collector verifies the ID/hash ACK. */ }
  return {file,record};
}

/** Public Roo events supply task identity only. Project mapping is an explicit,
 * scoped user confirmation effective from now; never infer active workspace. */
export function retainRooMarker(profile: {scope_id:string;cli_path:string}, taskId:string, eventName:string, home=homedir(), observedAt=new Date().toISOString()) {
  if (!Number.isFinite(Date.parse(observedAt)) || !/^[a-f0-9]{64}$/.test(profile.scope_id) || !taskId || taskId.length>512 || /[\x00-\x1f]/.test(taskId) || !["taskStarted","taskCompleted","taskAborted","taskUserMessage","taskToolFailed"].includes(eventName)) throw new Error("roo_contract_invalid");
  const base=path.join(home,".wakaclock"); safe(base);
  const desired=path.join(base,"runtime-desired.json");safe(desired);
  if(fs.existsSync(desired)) { const state=JSON.parse(fs.readFileSync(desired,"utf8")); if(state.schema_version!==1 || !state.desired) throw new Error("producer_runtime_unconfirmed"); if(state.desired.capture===false) return undefined; }
  const mappingPath=rooMappingPath(home,profile.scope_id,taskId);safe(mappingPath);
  let project: string|undefined; let effective:string|undefined;
  if(fs.existsSync(mappingPath)) { const binding=readRooMapping(mappingPath);
    if(binding.scope_id!==profile.scope_id || binding.task_id!==taskId || binding.provenance!=="user_confirmed") throw new Error("roo_mapping_scope_invalid");
    if(Date.parse(binding.effective_at)<=Date.parse(observedAt)) { project=binding.project_root; effective=binding.effective_at; }
  }
  const metadata={eventName,taskId,timestamp:observedAt,provider_version:"3.53.0",...(project?{project_root:project,context_provenance:"user_confirmed",context_effective_at:effective}:{})};
  const record={schema_version:1,scope_id:profile.scope_id,adapter_id:"roo-code",execution_surface:"ide",observation_id:randomUUID(),observed_at:observedAt,metadata};
  const root=path.join(base,"native-producer-spool",profile.scope_id);safe(root);fs.mkdirSync(root,{recursive:true,mode:0o700});
  for(const parent of [path.dirname(root),base,home]) syncDirectory(parent);
  const context={...freezeContext(observedAt,{session_id:taskId,...(project?{project_root:project}:{})}),...(project?{project_provenance:"user_confirmed",project_effective_at:effective}:{})};
  // Repository context is frozen at the public event, never refreshed during replay.
  retainContext(record,context,root);
  // Missing project context is retained, not acknowledged as captured activity.
  const file=path.join(root,`${record.observation_id}.json`);write(file,record);
  return {file,record};
}
function readRooMapping(file:string) {
  safe(file); if(fs.statSync(file).size>1024*1024) throw new Error("roo_mapping_limit");
  const b=JSON.parse(fs.readFileSync(file,"utf8"));
  if(b.schema_version!==1 || !Number.isSafeInteger(b.revision) || b.revision<1 || !Number.isFinite(Date.parse(b.effective_at)) || typeof b.project_root!=="string" || b.project_root.length>4096 || !path.isAbsolute(b.project_root) || !Array.isArray(b.history)) throw new Error("roo_mapping_invalid");
  return b;
}
function rooMappingPath(home:string,scope:string,taskId:string) { return path.join(home,".wakaclock","roo-project-bindings",scope,createHash("sha256").update(taskId).digest("hex")+".json"); }
export function confirmRooProject(profile:{scope_id:string},taskId:string,project:string,home=homedir(),expectedRevision=0) {
  if(!Number.isSafeInteger(expectedRevision) || expectedRevision<0 || expectedRevision>=Number.MAX_SAFE_INTEGER || !/^[a-f0-9]{64}$/.test(profile.scope_id) || !taskId || taskId.length>512 || /[\x00-\x1f]/.test(taskId) || !path.isAbsolute(project) || project.length>4096) throw new Error("roo_mapping_invalid");
  safe(project);if(!fs.statSync(project).isDirectory()) throw new Error("roo_mapping_invalid");
  const file=rooMappingPath(home,profile.scope_id,taskId);safe(file);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  for(const parent of [path.dirname(path.dirname(file)),path.join(home,".wakaclock"),home]) syncDirectory(parent);
  const lock=file+".lock";safe(lock); const handle=fs.openSync(lock,"wx",0o600);
  try { const previous=fs.existsSync(file)?readRooMapping(file):undefined;
    if((previous?.revision??0)!==expectedRevision || previous && (previous.scope_id!==profile.scope_id || previous.task_id!==taskId)) throw new Error("roo_mapping_revision_conflict");
    const binding={schema_version:1,scope_id:profile.scope_id,task_id:taskId,project_root:project,provenance:"user_confirmed",revision:expectedRevision+1,effective_at:new Date().toISOString()};
    const stage=file+"."+randomUUID()+".stage";write(stage,{...binding,history:[...(previous?.history??[]),...(previous?[{revision:previous.revision,effective_at:previous.effective_at,project_root:previous.project_root}]:[])]});fs.renameSync(stage,file);syncDirectory(path.dirname(file));return binding;
  } finally { fs.closeSync(handle);fs.unlinkSync(lock); }
}
