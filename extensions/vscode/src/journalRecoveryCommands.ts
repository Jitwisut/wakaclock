import {mergeRecoveryEvidence, recoveryEvidenceBatch, type RecoveryEvidence} from "./journalEvidence";
import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { inspectJournal, prepareJournalRecovery, applyJournalRecovery, journalHistory, recordJournalHandoffObservation, acknowledgeJournalHistory, updateJournalReconciliation, type RecoveryManifest, type RecoveryPlan } from "./journalRecovery";
import { validateEditorCheckpoint } from "./journalCheckpoint";
import { scanJournal, journalHash } from "./journalScanner";
import type { WakaclockCliService } from "./cli";
import type { HeartbeatBufferManager } from "./buffer";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, v]) => [key, canonical(v)]));
  return value;
}
function payloads(directory: string): Record<string, unknown>[] {
  const state = scanJournal<Record<string, unknown>>(fs.readFileSync(path.join(directory, "metadata.jsonl")), validateEditorCheckpoint).state;
  if (!state) return [];
  const items = new Map<string, Record<string, unknown>>();
  const add = (payload: Record<string, unknown>) => {
    const id = String(payload.heartbeat_id);
    if (items.has(id) && JSON.stringify(canonical(items.get(id))) !== JSON.stringify(canonical(payload))) throw new Error("journal_recovery_identity_conflict");
    items.set(id, payload);
  };
  for (const [, p] of (state.externalPayloads ?? []) as [string, Record<string, unknown>][]) add(p);
  for (const [, snapshots] of state.retries as [string, { payload: Record<string, unknown> }[]][]) for (const s of snapshots) add(s.payload);
  return [...items.values()];
}
export function registerJournalRecoveryCommands(context: vscode.ExtensionContext, root: string, scope: string, cli: WakaclockCliService, buffer: HeartbeatBufferManager, identityChanged: () => boolean, verifiedRoots: { scope: string; directory: string }[] = []): void {
  const plans = new Map<string, RecoveryPlan>();
  const panel = vscode.window.createOutputChannel("AtoAxis Journal Recovery Metadata"); context.subscriptions.push(panel);
  let recoveryPanel:vscode.WebviewPanel|undefined;
  let selectedJournal:{directory:string;scope:string}|undefined;
  let refreshing=false;
  let workerCursor=0;
  const show = (value: unknown) => {
    panel.clear(); panel.appendLine(JSON.stringify(value,null,2));
    if(!recoveryPanel) {
      recoveryPanel=vscode.window.createWebviewPanel("atoaxisJournalRecovery","AtoAxis Journal Recovery",vscode.ViewColumn.Beside,{enableScripts:false,enableCommandUris:["wakaclock.prepareJournalRecovery","wakaclock.applyJournalRecovery","wakaclock.refreshJournalRecovery","wakaclock.acknowledgeJournalHistory","workbench.action.reloadWindow"]});
      recoveryPanel.onDidDispose(()=>{recoveryPanel=undefined;});context.subscriptions.push(recoveryPanel);
    }
    const escaped=JSON.stringify(value,null,2).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
    recoveryPanel.webview.html=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font-family:var(--vscode-font-family);padding:20px;color:var(--vscode-foreground)}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:var(--vscode-textLink-foreground);margin-right:20px}</style></head><body><h1>Journal recovery evidence</h1><p>Journal writable, CLI acceptance, server ingress and canonical readback are separate evidence. Acknowledged historical gaps remain incomplete.</p><p><a href="command:wakaclock.prepareJournalRecovery">Prepare</a><a href="command:wakaclock.applyJournalRecovery">Apply with confirmation</a><a href="command:wakaclock.refreshJournalRecovery">Refresh evidence</a><a href="command:wakaclock.acknowledgeJournalHistory">Acknowledge history</a><a href="command:workbench.action.reloadWindow">Reload if required</a></p><pre>${escaped}</pre></body></html>`;
  };
  const select = async () => {
    const entries = [{scope, directory: root}, ...verifiedRoots].flatMap(owner => {
      if (!fs.existsSync(owner.directory) || fs.lstatSync(owner.directory).isSymbolicLink()) return [];
      return fs.readdirSync(owner.directory, { withFileTypes: true }).filter(e => e.isDirectory() && !e.isSymbolicLink() && fs.existsSync(path.join(owner.directory, e.name, "metadata.jsonl"))).map(e => ({label: e.name, description: owner.scope === scope ? "Current verified scope" : "Prior owner-verified scope", directory: path.join(owner.directory, e.name), scope: owner.scope}));
    });
    const choice = await vscode.window.showQuickPick(entries, { title: "AtoAxis: Select a retained journal in this account and workspace" });
    return choice;
  };
  const receipts = async (directory: string, selectedScope: string, mappings?: RecoveryManifest["recordMappings"]) => {
    const items = mappings ? mappings.slice(0,500).map(m=>({heartbeat_id:m.heartbeatId,input_hash:m.inputHash})) : payloads(directory).slice(0,500);
    if (!items.length) return { accepted: 0, missing: 0, conflicts: 0, unsnapshotted: "unconfirmed" };
    const results = await cli.journalReceipts(selectedScope, items.map(p => String(p.heartbeat_id)));
    const hashes = new Map(items.map(p => [p.heartbeat_id, ("input_hash" in p ? String(p.input_hash) : journalHash(JSON.stringify(canonical(p))))]));
    return { accepted: results.filter(r => r.status === "accepted" && r.input_hash === hashes.get(r.heartbeat_id)).length, missing: results.filter(r => r.status === "missing").length, conflicts: results.filter(r => r.status === "accepted" && r.input_hash !== hashes.get(r.heartbeat_id)).length, unsnapshotted: "unconfirmed" };
  };
  const reconcile = async (directory:string,selectedScope:string,incident:RecoveryManifest) => {
    const mappings=incident.recordMappings;
    const batch=recoveryEvidenceBatch(mappings ?? [],incident.evidenceCursor ?? 0);
    const selected=batch.records;
    let handoff:Awaited<ReturnType<typeof cli.journalReceipts>>|undefined;
    let evidence:Awaited<ReturnType<typeof cli.journalEvidence>>|undefined;
    if(selected.length) {
      try {handoff=await cli.journalReceipts(selectedScope,selected.map(m=>m.heartbeatId));} catch { /* Unconfirmed, never zero. */ }
      try {evidence=await cli.journalEvidence(selectedScope,selected.map(m=>({heartbeat_id:m.heartbeatId,revision:m.revision})));} catch { /* Old/offline server remains unconfirmed. */ }
    }
    if (identityChanged()) throw new Error("journal_recovery_scope_changed");
    const proof = await cli.journalScope();
    if (!proof.owner_confirmed || proof.scope_id !== scope || (selectedScope !== scope && !proof.recoverable_scope_ids?.includes(selectedScope))) throw new Error("journal_recovery_scope_unconfirmed");
    const now=new Date().toISOString();
    const updates:RecoveryEvidence[]=selected.map(mapping=>{
      const local=handoff?.find(row=>row.heartbeat_id===mapping.heartbeatId);
      const remote=evidence?.find(row=>row.heartbeat_id===mapping.heartbeatId&&row.revision===mapping.revision);
      return {heartbeatId:mapping.heartbeatId,revision:mapping.revision,observedAt:now,
        cliStatus:local?.status==='accepted' ? (local.input_hash===mapping.inputHash?'accepted':'conflict') : local?.status ?? 'unconfirmed',
        serverAck:remote?.server_ack==='ingress_accepted'?'ingress_accepted':'unconfirmed',
        canonical:(remote?.canonical_readback ?? 'unavailable') as RecoveryEvidence['canonical']};
    });
    const rows=mergeRecoveryEvidence(incident.recordEvidence ?? [],updates);
    const confirmed=rows.filter(row=>['found','superseded'].includes(row.canonical)).length;
    const oldest=rows.reduce((old,row)=>Date.parse(row.observedAt)<Date.parse(old)?row.observedAt:old,now);
    return updateJournalReconciliation(directory,incident.recoveryId,selectedScope,{recordEvidence:updates,evidenceCursor:batch.nextCursor,
      reconciliation:{observedAt:oldest,journalWritable:!inspectJournal(directory,validateEditorCheckpoint).errorCode,
        cliAccepted:rows.length?rows.filter(row=>row.cliStatus==='accepted').length:null,
        serverAccepted:rows.length?rows.filter(row=>row.serverAck==='ingress_accepted').length:null,
        canonicalFound:rows.length?confirmed:null,
        unconfirmed:Math.max(0,(mappings?.length ?? incident.verifiedPending)-confirmed),
        conflicts:rows.filter(row=>row.cliStatus==='conflict'||row.canonical==='conflict').length}});
  };
  // Read-only reconciliation continues during idle with no panel or activity.
  // One incident and at most 100 identities per tick keep requests bounded.
  const timer=setInterval(()=>{
    if(refreshing || identityChanged()) return;
    refreshing=true;
    void (async()=>{
      const proof=await cli.journalScope();
      if(!proof.owner_confirmed || proof.scope_id!==scope || !proof.capabilities.includes("journal_evidence_read_v1")) return;
      const owners=[{scope,directory:root},...verifiedRoots].filter(owner=>owner.scope===scope || proof.recoverable_scope_ids?.includes(owner.scope));
      const work=owners.flatMap(owner=>{
        if(!fs.existsSync(owner.directory) || fs.lstatSync(owner.directory).isSymbolicLink()) return [];
        return fs.readdirSync(owner.directory,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&!entry.isSymbolicLink()).flatMap(entry=>{
          const directory=path.join(owner.directory,entry.name);
          try { return journalHistory(directory).filter(incident=>incident.phase==="activated" && incident.recordMappings?.length).map(incident=>({directory,scope:owner.scope,incident})); }
          catch { return []; } // A damaged manifest does not stall other journals.
        });
      });
      if(!work.length) return;
      const selected=work[workerCursor%work.length]; workerCursor=(workerCursor+1)%work.length;
      const updated=await reconcile(selected.directory,selected.scope,selected.incident);
      if(recoveryPanel?.visible && selectedJournal?.directory===selected.directory) show(updated);
    })().catch(()=>{ /* Keep prior evidence unconfirmed; no repeated toast. */ }).finally(()=>{refreshing=false;});
  },15000);
  context.subscriptions.push({dispose:()=>clearInterval(timer)});
  for (const action of ["inspectJournal", "prepareJournalRecovery", "applyJournalRecovery", "journalRecoveryHistory", "acknowledgeJournalHistory", "refreshJournalRecovery"] as const) {
    context.subscriptions.push(vscode.commands.registerCommand(`wakaclock.${action}`, async () => {
      try {
        const selected = await select(); if (!selected) return;
        const { directory, scope: selectedScope } = selected;
        selectedJournal={directory,scope:selectedScope};
        if (action === "inspectJournal") { show(inspectJournal(directory, validateEditorCheckpoint)); return; }
        if (action === "journalRecoveryHistory") { show(journalHistory(directory)); return; }
        const identity = await cli.journalScope();
        if (identityChanged() || !identity.owner_confirmed || identity.scope_id !== scope || !identity.capabilities.includes("editor_receipts_read_v1") || (selectedScope !== scope && !identity.recoverable_scope_ids?.includes(selectedScope))) throw new Error("journal_recovery_scope_unconfirmed");
        if (action === "acknowledgeJournalHistory") {
          const incidents = journalHistory(directory).filter(m=>m.phase === "activated" && !m.acknowledgement);
          const incident = await vscode.window.showQuickPick(incidents.map(m=>({label:m.recoveryId,description:"History remains incomplete",manifest:m})), {title:"AtoAxis: Choose incomplete historical incident"});
          if (!incident) return;
          const confirm = await vscode.window.showWarningMessage("Acknowledge unavailable historical evidence and stop repeated alerts for this incident? Original evidence and incomplete totals remain retained.", {modal:true}, "Acknowledge History");
          if (confirm !== "Acknowledge History") return;
          const proof = await cli.journalScope();
          if (identityChanged() || !proof.owner_confirmed || proof.scope_id !== scope || (selectedScope !== scope && !proof.recoverable_scope_ids?.includes(selectedScope))) throw new Error("journal_recovery_scope_unconfirmed");
          show(acknowledgeJournalHistory(directory,incident.manifest.recoveryId,selectedScope,proof.scope_id)); return;
        }
        if (action === "refreshJournalRecovery") {
          const refreshed = [];
          for (const incident of journalHistory(directory).filter(m=>m.phase === "activated").slice(0,5)) {
            refreshed.push(await reconcile(directory,selectedScope,incident));
          }
          show(refreshed); return;
        }
        if (action === "prepareJournalRecovery") {
          const prior = journalHistory(directory).find(m => m.phase !== "activated" && m.ownershipHash && m.sourceHash === inspectJournal(directory, validateEditorCheckpoint).sourceHash);
          const plan = prior ?? prepareJournalRecovery(directory, selectedScope, validateEditorCheckpoint);
          plans.set(directory, plan);
          let handoff: unknown;
          try { handoff = await receipts(directory, selectedScope); } catch { handoff = { status: "unavailable" }; }
          show({ plan, handoff, next: "Review this plan, then run Apply Journal Recovery. Unknown historical records remain incomplete." }); return;
        }
        const plan = plans.get(directory); if (!plan) throw new Error("journal_prepare_required");
        const handoff = await receipts(directory, selectedScope); if (handoff.conflicts) throw new Error("journal_recovery_receipt_conflict");
        const confirmation = await vscode.window.showWarningMessage(`AtoAxis: recover ${plan.verifiedPending} verified pending units? The damaged original will be backed up; the unknown tail remains unresolved.`, { modal: true }, "Apply Recovery");
        if (confirmation !== "Apply Recovery") return;
        const preflight = await cli.journalScope();
        if (identityChanged() || !preflight.owner_confirmed || preflight.scope_id !== scope || (selectedScope !== scope && !preflight.recoverable_scope_ids?.includes(selectedScope))) throw new Error("journal_recovery_scope_unconfirmed");
        await buffer.parkJournalForRecovery(directory);
        const activated = applyJournalRecovery(directory, plan, selectedScope, validateEditorCheckpoint);
        updateJournalReconciliation(directory,activated.recoveryId,selectedScope,{runtimeDisposition:"resume_required",recordMappings:payloads(directory).map(p=>({heartbeatId:String(p.heartbeat_id),revision:Number(p.revision ?? 0),inputHash:journalHash(JSON.stringify(canonical(p)))}))});
        let resumed = false;
        try { resumed = await buffer.resumeRecoveredJournal(directory); } catch { /* Preserve resume_required and offer Reload. */ }
        if (resumed) {
          updateJournalReconciliation(directory,activated.recoveryId,selectedScope,{runtimeDisposition:"writer_resumed"});
          await buffer.flushAllBuffers("shutdown");
        }
        const result = recordJournalHandoffObservation(directory, activated.recoveryId, {observedAt:new Date().toISOString(), acceptedSnapshots:handoff.accepted, missingSnapshots:handoff.missing, conflictingSnapshots:handoff.conflicts, unsnapshotted:"unconfirmed"});
        show({ ...result, handoff, next: resumed ? "Writer resumed and verified records handed to the durable pipeline. Server and canonical evidence remain separately unconfirmed." : "resume_required: Reload the window; historical completeness remains unconfirmed." });
        if (!resumed) void vscode.window.showInformationMessage("AtoAxis: verified checkpoint restored. Reload the window; unresolved history is retained.", "Reload Window").then(choice => { if (choice) void vscode.commands.executeCommand("workbench.action.reloadWindow"); });
      } catch (error) {
        const code = error instanceof Error && /^journal_[a-z_]+$/.test(error.message) ? error.message : "journal_recovery_unconfirmed";
        show({status:"unconfirmed",errorCode:code});
        void vscode.window.showErrorMessage("AtoAxis: journal recovery was not confirmed. Preserve the journal; inspect ownership, receipts and the prepared plan. Capture remains parked if Apply started.");
      }
    }));
  }
}
