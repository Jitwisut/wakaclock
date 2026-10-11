import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { inspectJournal, prepareJournalRecovery, applyJournalRecovery, journalHistory, recordJournalHandoffObservation, type RecoveryPlan } from "./journalRecovery";
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
  const show = (value: unknown) => { panel.clear(); panel.appendLine(JSON.stringify(value, null, 2)); panel.show(true); };
  const select = async () => {
    const entries = [{scope, directory: root}, ...verifiedRoots].flatMap(owner => {
      if (!fs.existsSync(owner.directory) || fs.lstatSync(owner.directory).isSymbolicLink()) return [];
      return fs.readdirSync(owner.directory, { withFileTypes: true }).filter(e => e.isDirectory() && !e.isSymbolicLink() && fs.existsSync(path.join(owner.directory, e.name, "metadata.jsonl"))).map(e => ({label: e.name, description: owner.scope === scope ? "Current verified scope" : "Prior owner-verified scope", directory: path.join(owner.directory, e.name), scope: owner.scope}));
    });
    const choice = await vscode.window.showQuickPick(entries, { title: "AtoAxis: Select a retained journal in this account and workspace" });
    return choice;
  };
  const receipts = async (directory: string, selectedScope: string) => {
    const items = payloads(directory);
    if (!items.length) return { accepted: 0, missing: 0, conflicts: 0, unsnapshotted: "unconfirmed" };
    const results = await cli.journalReceipts(selectedScope, items.map(p => String(p.heartbeat_id)));
    const hashes = new Map(items.map(p => [p.heartbeat_id, journalHash(JSON.stringify(canonical(p)))]));
    return { accepted: results.filter(r => r.status === "accepted" && r.input_hash === hashes.get(r.heartbeat_id)).length, missing: results.filter(r => r.status === "missing").length, conflicts: results.filter(r => r.status === "accepted" && r.input_hash !== hashes.get(r.heartbeat_id)).length, unsnapshotted: "unconfirmed" };
  };
  for (const action of ["inspectJournal", "prepareJournalRecovery", "applyJournalRecovery", "journalRecoveryHistory"] as const) {
    context.subscriptions.push(vscode.commands.registerCommand(`wakaclock.${action}`, async () => {
      try {
        const selected = await select(); if (!selected) return;
        const { directory, scope: selectedScope } = selected;
        if (action === "inspectJournal") { show(inspectJournal(directory, validateEditorCheckpoint)); return; }
        if (action === "journalRecoveryHistory") { show(journalHistory(directory)); return; }
        const identity = await cli.journalScope();
        if (identityChanged() || !identity.owner_confirmed || identity.scope_id !== scope || !identity.capabilities.includes("editor_receipts_read_v1") || (selectedScope !== scope && !identity.recoverable_scope_ids?.includes(selectedScope))) throw new Error("journal_recovery_scope_unconfirmed");
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
        const result = recordJournalHandoffObservation(directory, activated.recoveryId, {observedAt:new Date().toISOString(), acceptedSnapshots:handoff.accepted, missingSnapshots:handoff.missing, conflictingSnapshots:handoff.conflicts, unsnapshotted:"unconfirmed"});
        show({ ...result, handoff, next: "Reload the window to resume through the durable pipeline; check server delivery separately. Historical completeness remains unconfirmed." });
        void vscode.window.showInformationMessage("AtoAxis: verified checkpoint restored. Reload the window; unresolved history is retained.", "Reload Window").then(choice => { if (choice) void vscode.commands.executeCommand("workbench.action.reloadWindow"); });
      } catch {
        void vscode.window.showErrorMessage("AtoAxis: journal recovery was not confirmed. Preserve the journal; inspect ownership, receipts and the prepared plan. Capture remains parked if Apply started.");
      }
    }));
  }
}
