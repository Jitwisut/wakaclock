import { retainToolMarker } from "../../common/activity-spool.ts";
import { isAbsolute } from "node:path";
import { homedir } from "node:os";

type RecordValue = Record<string, any>;
type Sink = typeof retainToolMarker;
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 4096;
function metadata(event: RecordValue, directory: unknown, contract: "v1" | "v2", phase: "before" | "after" | "failure") {
  const call = contract === "v1" ? event.callID : event.id;
  if (!text(event.sessionID) || !text(call) || !text(directory) || !isAbsolute(directory)) throw new Error("opencode_activity_identity_unresolved");
  return { adapter: "opencode" as const, surface: "cli" as const, phase, sessionId: event.sessionID, callId: call, directory };
}
function sinkOptions() { return { cli: process.env.WAKACLOCK_CLI_PATH || "wakaclock", home: process.env.ATOAXIS_PRODUCER_HOME || homedir() }; }
function failure(): void { console.warn("AtoAxis: opencode_activity_pending_or_unresolved; inspect capture health"); }
/** V1 1.19.0 public hook types: sessionID/callID, context scoped directory.
 * No args, output, tool name, model usage or elapsed interval is inferred.
 */
export async function server(ctx: RecordValue, sink: Sink = retainToolMarker) {
  const emit = async (input: RecordValue, phase: "before" | "after") => {
    try { const options = sinkOptions(); await sink(options.cli, metadata(input, ctx.directory, "v1", phase), options.home); }
    catch { failure(); }
  };
  return { "tool.execute.before": (input: RecordValue) => emit(input, "before"), "tool.execute.after": (input: RecordValue) => emit(input, "after") };
}
/** V2 2.0.26 public types use id (not callID). Read the actual session's
 * location for each event; ctx.location only identifies the plugin instance.
 */
export async function setup(ctx: RecordValue, sink: Sink = retainToolMarker, lookupTimeoutMs = 1000) {
  if (typeof ctx.tool?.hook !== "function" || typeof ctx.session?.get !== "function") throw new Error("opencode_contract_incompatible");
  const emit = async (event: RecordValue, phase: "before" | "after" | "failure") => {
    const observedAt = new Date().toISOString();
    try {
      if (!text(event.sessionID)) throw new Error("opencode_activity_identity_unresolved");
      // A stalled provider API must not strand known task/call evidence in RAM.
      // The deadline changes only lookup readiness, never the event timestamp.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const session = await Promise.race([
        Promise.resolve().then(() => ctx.session.get({ sessionID: event.sessionID })),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("opencode_session_lookup_unavailable")), lookupTimeoutMs); })
      ]).finally(() => { if (timer) clearTimeout(timer); });
      if (session?.id !== event.sessionID) throw new Error("opencode_session_identity_conflict");
      const options = sinkOptions(); await sink(options.cli, { ...metadata(event, session.location?.directory, "v2", phase), observedAt }, options.home);
    } catch {
      // The native task/call and observation time remain evidence even when
      // project lookup fails. Persist them without today's plugin workspace.
      if (text(event.sessionID) && text(event.id)) {
        const options=sinkOptions();
        await sink(options.cli,{adapter:"opencode",surface:"cli",phase,sessionId:event.sessionID,callId:event.id,observedAt},options.home).catch(()=>{});
      }
      failure();
    }
  };
  await ctx.tool.hook("execute.before", (event: RecordValue) => emit(event, "before"));
  await ctx.tool.hook("execute.after", (event: RecordValue) => {
    if (!["completed", "error"].includes(event.status)) { failure(); return; }
    return emit(event, event.status === "error" ? "failure" : "after");
  });
}
// Object-form V1 is documented from 1.18.29; the installer chooses an explicit
// entrypoint. V2 never receives a V1 factory mislabeled as a V2 implementation.
export default { id: "atoaxis.opencode.activity", setup, server };
