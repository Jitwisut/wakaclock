import * as vscode from "vscode";
import * as os from "node:os";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  detectAiAgents,
  setupDetectedAiAgents,
  syncAgentPluginsToStableDir,
  writeHookAutoInstallPolicy
} from "./agentSetup";
import type { AiAgentId } from "./agentSetup";
import { HeartbeatBufferManager } from "./buffer";
import { WakaclockCliService } from "./cli";
import { registerCommands } from "./commands";
import type { AiIntegrationController } from "./commands";
import { WakaclockConfigService } from "./config";
import { registerEventSubscriptions } from "./events";
import { Logger } from "./logging";
import { ManagedCliManager } from "./managedCli";
import {
  clearPendingApiKey,
  getPendingApiKey,
  getStoredApiKey,
  setStoredApiKey,
} from "./secrets";
import { StatusBarController } from "./statusBar";
import { SingleFlight } from "./singleFlight";
import { RooBridge, cachedRooProfile, rooProfileOwner, type RooSpool, type RooPublicApi } from "./rooBridge";
import { registerJournalRecoveryCommands } from "./journalRecoveryCommands";

let activeBufferManager: HeartbeatBufferManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log("[wakaclock] extension activated");
  const configService = new WakaclockConfigService();
  const logger = new Logger(() => configService.getSnapshot().debugLogging);
  void warnIgnoredWorkspaceOverrides(context, logger);
  const managedCli = new ManagedCliManager(
    {
      extensionPath: context.extensionPath,
      globalStoragePath: context.globalStorageUri.fsPath,
      extensionVersion: String(context.extension.packageJSON.version ?? "0.0.0")
    },
    () => configService.getSnapshot(),
    logger
  );

  const extensionVersion = String(context.extension.packageJSON.version ?? "0.0.0");
  const cliService = new WakaclockCliService(
    () => configService.getSnapshot(),
    logger,
    async () => (await getStoredApiKey(context.secrets)) ?? (await getPendingApiKey(context.secrets)),
    managedCli,
    `wakaclock-vscode/${extensionVersion}`,
    vscode.env.remoteName ? "remote_extension" : undefined
  );
  context.subscriptions.push(vscode.commands.registerCommand("wakaclock.rollbackManagedCli", async () => {
    try { const binary = await managedCli.rollback(); void vscode.window.showInformationMessage(`AtoAxis: previous managed CLI selected (${binary}). Queue and journal IDs are retained.`); }
    catch { void vscode.window.showErrorMessage("AtoAxis: rollback failed. Check the previous binary, custom CLI path and runtime diagnostics."); }
  }));
  context.subscriptions.push(vscode.commands.registerCommand("wakaclock.upgradeManagedCli", async () => {
    try {
      await managedCli.upgrade();
      void vscode.window.showInformationMessage("AtoAxis: managed CLI selection updated. Check runtime status before upgrading background workers.");
    } catch {
      void vscode.window.showErrorMessage("AtoAxis: managed CLI upgrade failed. The existing selection and queues are retained.");
    }
  }));
  const statusBar = new StatusBarController(
    () => configService.getSnapshot(),
    cliService,
    logger,
    async () => (await getStoredApiKey(context.secrets)) ?? (await getPendingApiKey(context.secrets))
  );
  const presenceHeartbeat = createPresenceHeartbeatPing(configService, cliService);
  const bufferManager = new HeartbeatBufferManager(
    () => configService.getSnapshot(),
    cliService,
    logger,
    () => {
      statusBar.handleHeartbeatSent();
      presenceHeartbeat();
      void cliService.syncAiActivity().catch((error) =>
        logger.debug("on-demand AI sync after heartbeat was deferred", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    },
    undefined,
    () => statusBar.handleActivity()
  );
  activeBufferManager = bufferManager;
  const journalKey = (await getStoredApiKey(context.secrets)) ?? (await getPendingApiKey(context.secrets));
  let journalScope: string;
  let verifiedJournalScopes: string[] = [];
  let sidecarScopes: string[] = [];
  try {
    const scope = await cliService.journalScope();
    journalScope = scope.scope_id;
    verifiedJournalScopes = scope.recoverable_scope_ids ?? [];
    if (scope.owner_confirmed) sidecarScopes=[journalScope,...verifiedJournalScopes];
  } catch {
    const server = (configService.getSnapshot().serverUrl ?? "").replace(/\/$/, "");
    const owner = journalKey ? `key:${createHash("sha256").update(journalKey).digest("hex")}` : "unconfirmed";
    journalScope = createHash("sha256").update(`${server}\0${owner}`).digest("hex");
    void vscode.window.showWarningMessage("AtoAxis: CLI durable ACK is unavailable. Activity stays in the private journal until the CLI is updated and identity verified.");
  }
  const workspaceId = createHash("sha256").update(context.storageUri?.fsPath ?? "no-workspace").digest("hex");
  bufferManager.setAttributionOwnerScopes(sidecarScopes);
  bufferManager.enableJournal(path.join(context.globalStorageUri.fsPath, "editor-journals", journalScope, workspaceId), journalScope, verifiedJournalScopes.filter(scope => scope !== journalScope).map(scope => path.join(context.globalStorageUri.fsPath, "editor-journals", scope, workspaceId)));
  const journalCollectorId = randomUUID();
  let journalPublication: Promise<void> | undefined;
  let journalFault: string | undefined;
  let healthHandoffFailed = false;
  const publishJournal = () => {
    if (journalPublication) return;
    const health = bufferManager.getJournalHealth();
    if (health) {
      const fault = health.status !== "ready" ? `${health.status}:${health.errorCode ?? ""}` : health.deadLetter ? "journal_dead_letter" : health.historicalIncomplete && (health.unacknowledgedIncidents ?? 1)>0 ? "journal_historical_incomplete" : undefined;
      if (fault !== journalFault) {
        if (fault) void vscode.window.showWarningMessage("AtoAxis: activity journal needs attention. Capture cannot confirm complete data; open runtime diagnostics. Retained records are preserved.");
        else if (journalFault && journalFault !== "journal_historical_incomplete") void vscode.window.showInformationMessage(health.historicalIncomplete ? "AtoAxis: journal writer recovered; historical data remains incomplete. Delivery evidence is checked separately." : "AtoAxis: activity journal recovered. Delivery completeness is checked separately.");
        journalFault = fault;
      }
      journalPublication = cliService.publishJournalHealth(journalScope, journalCollectorId, health)
        .then(() => { healthHandoffFailed = false; })
        .catch(() => { if (!healthHandoffFailed) logger.warn("Editor journal health handoff unavailable; private activity remains retained."); healthHandoffFailed = true; })
        .finally(() => { journalPublication = undefined; });
    }
  };
  const journalHealthTimer = setInterval(publishJournal, 15_000);
  context.subscriptions.push({ dispose: () => clearInterval(journalHealthTimer) });
  finalJournalPublication = async () => {
    clearInterval(journalHealthTimer);
    await journalPublication;
    const health = bufferManager.getJournalHealth();
    if (health) await cliService.publishJournalHealth(journalScope, journalCollectorId,
      { ...health, status: health.status === "ready" && health.pending === 0 && !health.historicalIncomplete ? "stopped" : health.status });
  };
  publishJournal();
  try {
    const runtime = await cliService.runtime("status");
    bufferManager.setCapturePaused(runtime.desired.desired.capture === false);
  } catch {
    bufferManager.setCapturePaused(true);
    logger.warn("Runtime desired state is unavailable; capture is parked until intent can be verified.");
  }
  let identityChanged = false;
  registerJournalRecoveryCommands(context, path.join(context.globalStorageUri.fsPath, "editor-journals", journalScope, workspaceId), journalScope, cliService, bufferManager, () => identityChanged, verifiedJournalScopes.map(scope => ({scope, directory:path.join(context.globalStorageUri.fsPath, "editor-journals", scope, workspaceId)})));
  const parkChangedIdentity = () => {
    if (identityChanged) return;
    identityChanged = true;
    bufferManager.setCapturePaused(true);
    void vscode.window.showWarningMessage("AtoAxis: account or server changed. Capture is parked and the previous journal is retained in its original scope. Reload the window to verify the new identity.");
  };
  const originalServer = configService.getSnapshot().serverUrl;
  context.subscriptions.push(context.secrets.onDidChange(event => {
    if (event.key !== "wakaclock.apiKey" && event.key !== "wakaclock.pendingApiKey") return;
    void (async () => {
      const current = (await getStoredApiKey(context.secrets)) ?? (await getPendingApiKey(context.secrets));
      if (current !== journalKey) parkChangedIdentity();
    })();
  }));
  context.subscriptions.push(configService.onDidChange(snapshot => {
    if (snapshot.serverUrl !== originalServer) parkChangedIdentity();
  }));
  for (const action of ["pause", "resume"] as const) {
    context.subscriptions.push(vscode.commands.registerCommand(`wakaclock.runtime${action === "pause" ? "Pause" : "Resume"}`, async () => {
      const component = await vscode.window.showQuickPick(["capture", "delivery", "backend-local", "all"], { title: `AtoAxis: ${action} runtime` });
      if (!component) return;
      try {
        const runtime = await cliService.runtime(action, component);
        bufferManager.setCapturePaused(identityChanged || runtime.desired.desired.capture === false);
        void vscode.window.showInformationMessage(`AtoAxis: ${component} ${action === "pause" ? "paused by you" : "resumed"}. Pending data is retained.`);
      } catch { void vscode.window.showErrorMessage("AtoAxis: runtime change failed; use metadata diagnostics to check configuration and identity."); }
    }));
  }
  context.subscriptions.push(vscode.commands.registerCommand("wakaclock.manageRuntime", async () => {
    const action = await vscode.window.showQuickPick(["status", "install", "upgrade", "rollback", "uninstall"] as const, { title: "AtoAxis: Manage background runtime (queues are retained)" });
    if (!action) return;
    try {
      if (action === "status") { const state = await cliService.runtime("status"); const panel = vscode.window.createOutputChannel("AtoAxis Runtime Metadata"); context.subscriptions.push(panel); panel.appendLine(JSON.stringify(state, null, 2)); panel.show(true); void vscode.window.showInformationMessage("AtoAxis: runtime metadata is available in the AtoAxis output panel."); return; }
      const component = await vscode.window.showQuickPick(["capture", "delivery"] as const, { title: `AtoAxis: ${action} per-user service` });
      if (!component) return;
      await cliService.manageRuntime(action as "install" | "upgrade" | "rollback" | "uninstall", component as "capture" | "delivery");
      void vscode.window.showInformationMessage(`AtoAxis: ${component} ${action} completed. Queue and journal IDs are retained.`);
    } catch { void vscode.window.showErrorMessage("AtoAxis: service change could not be confirmed. Check runtime metadata; pending data is retained."); }
  }));
  context.subscriptions.push(vscode.commands.registerCommand("wakaclock.retryJournalRejection", async () => {
    if (identityChanged) { void vscode.window.showWarningMessage("AtoAxis: reload and verify the current identity before journal recovery."); return; }
    const entries = bufferManager.rejectedJournalItems();
    if (!entries.length) { void vscode.window.showInformationMessage("AtoAxis: no rejected editor journal records are available."); return; }
    const selected = await vscode.window.showQuickPick(entries.map(item => ({ label: item.id, description: item.errorCode, item })), { title: "AtoAxis: Retry one retained rejection with its original ID and timestamp" });
    if (!selected) return;
    try {
      const accepted = await bufferManager.retryRejectedJournalItem(selected.item.id);
      void vscode.window.showInformationMessage(accepted ? "AtoAxis: record accepted into the durable CLI queue. Server delivery is checked separately." : "AtoAxis: record remains retained and needs further recovery.");
    } catch { void vscode.window.showErrorMessage("AtoAxis: journal retry was not confirmed; the original ID and record remain retained."); }
  }));
  context.subscriptions.push(vscode.commands.registerCommand("wakaclock.setupNativeActivity", async () => {
    const adapter = await vscode.window.showQuickPick(["claude-code", "gemini-cli", "cursor", "copilot", "cline", "kimi-code-cli", "opencode", "antigravity"], { title: "AtoAxis: Enable native metadata activity hooks (live certification pending)" });
    if (!adapter) return;
    try {
      let contract: string | undefined;
      if (adapter === "opencode") {
        contract = await vscode.window.showQuickPick(["opencode-v1-1.19.0", "opencode-v2-2.0.26"], { title: "AtoAxis: Choose the installed OpenCode contract; CLI verifies the exact version" });
        if (!contract) return;
      } else if (adapter === "cline" && process.platform === "win32") {
        const installed=vscode.extensions.getExtension("saoudrizwan.claude-dev");
        if(installed?.packageJSON.version!=="4.1.23") throw new Error("cline_provider_contract_evidence_pending");
        contract="cline-vscode-4.1.23-powershell";
      } else if (adapter === "copilot") {
        const surface = await vscode.window.showQuickPick(["VS Code", "Copilot CLI"], { title: "AtoAxis: Choose Copilot surface (daily metrics and inline are separate)" });
        if (!surface) return;
        if (surface === "Copilot CLI") contract = "copilot-cli-vscode-compatible-v1";
      }
      const result = await cliService.setupNativeActivity(adapter, false, contract);
      if (result.status !== "configured") throw new Error("Native hook setup was not confirmed.");
      if (adapter === "copilot" && result.hook_location) {
        const hooks = vscode.workspace.getConfiguration("chat").get<Record<string, boolean>>("hookFilesLocations", {});
        await vscode.workspace.getConfiguration("chat").update("hookFilesLocations", { ...hooks, [result.hook_location]: true }, vscode.ConfigurationTarget.Global);
      }
      void vscode.window.showInformationMessage(`AtoAxis: ${adapter} activity hooks configured. Tool intervals and unavailable metrics require separate evidence. ${result.next_step ?? ""}`);
    } catch { void vscode.window.showErrorMessage("AtoAxis: activity hooks could not be configured; user hooks remain preserved. Check consent and runtime metadata."); }
  }));
  let rooBridge: RooBridge | undefined;
  let rooGeneration=0;
  const stopRoo=()=>{rooGeneration++;rooBridge?.dispose();rooBridge=undefined;};
  const startRoo=async()=>{
    stopRoo();
    const generation=rooGeneration;
    if(!vscode.workspace.getConfiguration("wakaclock").get<boolean>("rooTrackingEnabled",false)) return;
    const extension=vscode.extensions.getExtension<RooPublicApi>("RooVeterinaryInc.roo-cline");
    if(!extension || extension.packageJSON.version!=="3.53.0") { logger.warn("Roo capture: provider contract evidence pending.");return; }
    try {
      const key=await getStoredApiKey(context.secrets);
      const origin=configService.getSnapshot().serverUrl;
      if(!key || !origin) throw new Error("roo_owner_unconfirmed");
      const ownerBinding=rooProfileOwner(origin,key);
      let profile:{scope_id:string;cli_path:string};
      try {
        profile=await cliService.nativeProducerProfile("roo_public_task_bridge_v1");
        if(generation!==rooGeneration)return;
        await context.globalState.update(`roo-profile:${ownerBinding}`,{...profile,owner_binding:ownerBinding,contract:"roo_public_task_bridge_v1"});
      }catch {
        // A previously verified profile stays fixed to this exact key/origin.
        // Missing CLI during restart must not discard native producer observations.
        profile=cachedRooProfile(context.globalState.get(`roo-profile:${ownerBinding}`),ownerBinding);
      }
      const api=extension.isActive ? extension.exports : await extension.activate();
      if(generation!==rooGeneration)return;
      const spool = require(path.join(context.extensionPath,"resources","ai-agents","common","activity-spool.js")) as RooSpool;
      rooBridge=new RooBridge(api,spool,profile,extension.packageJSON.version,()=>logger.warn("Roo capture: durable spool write unconfirmed; check capture diagnostics."));
    } catch { logger.warn("Roo capture: setup or durable producer unavailable."); }
  };
  context.subscriptions.push({dispose:stopRoo});
  context.subscriptions.push(context.secrets.onDidChange(()=>stopRoo()));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration("wakaclock")) stopRoo();}));
  context.subscriptions.push(vscode.commands.registerCommand("wakaclock.setupRooTracking",async()=>{
    const choice=await vscode.window.showQuickPick(["Enable read-only task markers","Disable bridge"],{title:"AtoAxis Roo: metadata only; project requires explicit confirmation; live certification pending"});
    if(!choice) return;
    await configService.updateSetting("rooTrackingEnabled",choice.startsWith("Enable"));await startRoo();
    void vscode.window.showInformationMessage(rooBridge?"AtoAxis: Roo task bridge ready. Confirm a project's actual task before attribution.":"AtoAxis: Roo bridge stopped or provider/setup evidence pending.");
  }));
  context.subscriptions.push(vscode.commands.registerCommand("wakaclock.confirmRooProject",async()=>{
    const task=await vscode.window.showQuickPick(rooBridge?.observedTasks()??[],{title:"AtoAxis: Select a task observed from Roo's public API"});if(!task || !rooBridge) return;
    const roots=await vscode.window.showOpenDialog({canSelectFiles:false,canSelectFolders:true,canSelectMany:false,openLabel:"Confirm repository folder for future task activity"});if(!roots?.[0])return;
    const revision=await vscode.window.showInputBox({prompt:"Expected mapping revision (0 for the first confirmation)",value:"0",validateInput:value=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?undefined:"Enter a non-negative revision"});if(revision===undefined)return;
    const confirm=await vscode.window.showWarningMessage("This user-confirmed mapping applies to future events only. It does not verify historical Git context or link a PR.",{modal:true},"Confirm mapping");if(confirm!=="Confirm mapping")return;
    try {rooBridge.confirm(task,roots[0].fsPath,Number(revision));void vscode.window.showInformationMessage("AtoAxis: task project confirmation recorded. Prior unresolved records remain retained.");}
    catch {void vscode.window.showErrorMessage("AtoAxis: mapping not applied; reload identity/revision and verify ownership.");}
  }));
  const rooOutput=vscode.window.createOutputChannel("AtoAxis Roo Capture");context.subscriptions.push(rooOutput);
  context.subscriptions.push(vscode.commands.registerCommand("wakaclock.inspectRooTracking",()=>{
    const health=rooBridge?.health()??{adapter_id:"roo-code",execution_surface:"ide",runtime_status:"stopped_or_evidence_pending",certification_status:"pending"};
    rooOutput.clear();rooOutput.appendLine(JSON.stringify(health,null,2));rooOutput.show();
  }));
  void startRoo();
  statusBar.setBufferedSecondsProvider(() => bufferManager.getBufferedSeconds());
  statusBar.setJournalHealthProvider(() => bufferManager.getJournalHealth());
  statusBar.setBufferedSegmentsProvider(() => bufferManager.getBufferedSegments());

  const stableAgentDir = syncAgentPluginsToStableDir({
    extensionPath: context.extensionPath,
    extensionVersion,
    logger
  });
  const aiIntegrations = {
    getStatus: () => detectAiAgents(),
    setup: async (selectedIds?: AiAgentId[]) => {
      const stableDir = await stableAgentDir;
      if (!stableDir) {
        throw new Error("Bundled AtoAxis AI integration resources are unavailable.");
      }
      return setupDetectedAiAgents({
        stableDir,
        cliPath: await managedCli.ensureReady(),
        logger,
        selectedIds
      });
    }
  };

  context.subscriptions.push(
    configService,
    statusBar,
    configService.onDidChange((snapshot) => {
      void writeHookAutoInstallPolicy(os.homedir(), snapshot.autoInstallAgentHooks ?? true).catch((error) =>
        logger.debug("agentSetup: could not persist automatic hook policy", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }),
  );

  // Persist the hook policy on activation so a user who has disabled automatic
  // hook installation is protected immediately after an extension update.
  void writeHookAutoInstallPolicy(
    os.homedir(),
    configService.getSnapshot().autoInstallAgentHooks ?? true,
  ).catch((error) =>
    logger.debug("agentSetup: could not persist initial automatic hook policy", {
      error: error instanceof Error ? error.message : String(error),
    }),
  );

  void (async () => {
    const key =
      (await getStoredApiKey(context.secrets)) ??
      (await getPendingApiKey(context.secrets));
    statusBar.setConnectionState(key ? "connecting" : "needs-api-key");
  })();
  statusBar.start();
  registerCommands(
    context,
    configService,
    cliService,
    bufferManager,
    statusBar,
    aiIntegrations,
    () => startConnectionBootstrap(context, cliService, aiIntegrations, logger),
  );
  registerEventSubscriptions(context, configService, bufferManager, logger);
  void vscode.commands.executeCommand("setContext", "wakaclock.enabled", true);

  // AI discovery/setup is deliberately detached from the editor heartbeat pipeline.
  // It starts only after an authenticated key is available and never blocks the
  // event listeners or their serialized buffer snapshots.
  startConnectionBootstrap(context, cliService, aiIntegrations, logger);

  logger.debug("wakaclock extension activated");
}

async function warnIgnoredWorkspaceOverrides(
  context: vscode.ExtensionContext,
  logger: Logger,
): Promise<void> {
  const configuration = vscode.workspace.getConfiguration("wakaclock");
  const ignored = ["cliPath", "serverUrl"].filter((key) => {
    const inspected = configuration.inspect<string>(key);
    return inspected?.workspaceValue !== undefined || inspected?.workspaceFolderValue !== undefined;
  });
  if (ignored.length === 0 || context.globalState.get<boolean>("atoaxis.workspaceOverrideWarning")) {
    return;
  }
  await context.globalState.update("atoaxis.workspaceOverrideWarning", true);
  logger.warn("ignored workspace-level AtoAxis security settings", { keys: ignored });
  void vscode.window.showWarningMessage(
    "AtoAxis ignores workspace cliPath/serverUrl settings for security. Configure these values globally only.",
  );
}

/**
 * One verification retry loop per extension context.
 *
 * The loop below retries an unreachable server with a growing delay and never
 * returns while the outage lasts. Activation starts one, and the "reconnect"
 * command starts another — so each invocation used to add a loop that outlived
 * it, each one spawning its own CLI. A second trigger now queues exactly one
 * follow-up run instead.
 */
const connectionBootstrap = new SingleFlight();

function startConnectionBootstrap(
  context: vscode.ExtensionContext,
  cliService: Pick<WakaclockCliService, "verifyApiKey" | "getStatus" | "syncAiActivity">,
  aiIntegrations: AiIntegrationController,
  logger: Logger,
): void {
  void connectionBootstrap.run(() =>
    initializeConnection(context, cliService, aiIntegrations, logger),
  );
}

async function initializeConnection(
  context: vscode.ExtensionContext,
  cliService: Pick<WakaclockCliService, "verifyApiKey" | "getStatus" | "syncAiActivity">,
  aiIntegrations: AiIntegrationController,
  logger: Logger
): Promise<void> {
  try {
    let retryDelayMs = 5_000;
    for (;;) {
      const primaryKey = await getStoredApiKey(context.secrets);
      const pendingKey = await getPendingApiKey(context.secrets);
      const candidates = [primaryKey, pendingKey].filter(
        (candidate, index, all): candidate is string =>
          Boolean(candidate) && all.indexOf(candidate) === index,
      );
      if (candidates.length === 0) {
        return;
      }
      let verification = await cliService.verifyApiKey(candidates[0]);
      let verifiedKey = verification.status === "verified" ? candidates[0] : undefined;
      if (!verifiedKey && candidates[1]) {
        verification = await cliService.verifyApiKey(candidates[1]);
        if (verification.status === "verified") {
          verifiedKey = candidates[1];
        }
      }
      if (verification.status === "verified") {
        if (verifiedKey && verifiedKey !== primaryKey) {
          await setStoredApiKey(context.secrets, verifiedKey);
        }
        await clearPendingApiKey(context.secrets);
        void cliService.getStatus().catch(() => undefined);
        void cliService.syncAiActivity().catch((error) =>
          logger.debug("on-demand AI sync at extension activation was deferred", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        await maybeOfferAiSetup(context, aiIntegrations, logger);
        return;
      }
      if (verification.status !== "unreachable" && verification.status !== "server_error") {
        logger.warn("stored AtoAxis API key is not currently verified", {
          status: verification.status,
          error: verification.error
        });
        return;
      }
      logger.warn("AtoAxis verification pending; retrying in the background", {
        status: verification.status,
        retryInMs: retryDelayMs
      });
      await delay(retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, 5 * 60_000);
    }
  } catch (error) {
    // A disconnected server must not prevent normal editor activity from being
    // buffered locally. Verification retries on the next activation/refresh.
    logger.warn("AtoAxis connection bootstrap failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Throttles presence liveness pings to piggyback on real heartbeat sends rather than
 * running its own timer. A heartbeat only fires when the buffer actually flushes
 * accumulated activity, so this naturally pings only while the user is coding and never
 * while idle. The throttle keeps it well under the 45-second room lease
 * (`VIEWER_LEASE_SECONDS` in redis_presence.rs) without sending on every single flush.
 */
function createPresenceHeartbeatPing(
  configService: WakaclockConfigService,
  cliService: Pick<WakaclockCliService, "sendPresenceHeartbeat">
): () => void {
  const throttleMs = 30_000;
  let lastSentAt = 0;
  return () => {
    if (!configService.getSnapshot().presenceAutoJoinEnabled) {
      return;
    }
    const now = Date.now();
    if (now - lastSentAt < throttleMs) {
      return;
    }
    lastSentAt = now;
    void cliService.sendPresenceHeartbeat();
  };
}

async function maybeOfferAiSetup(
  context: vscode.ExtensionContext,
  aiIntegrations: AiIntegrationController,
  logger: Logger
): Promise<void> {
  if (!vscode.workspace.getConfiguration("wakaclock").get<boolean>("autoInstallAgentHooks", true)) {
    return;
  }
  const lastPromptedAt = context.globalState.get<number>("atoaxis.aiSetupPromptedAt");
  const promptSnoozeMs = 7 * 24 * 60 * 60 * 1000;
  if (lastPromptedAt && Date.now() - lastPromptedAt < promptSnoozeMs) {
    return;
  }

  try {
    const statuses = await aiIntegrations.getStatus();
    const eligible = statuses.some((status) => {
      if (!status.detected || status.enabled) {
        return false;
      }
      const consent = context.globalState.get<{ state?: string; updatedAt?: number }>(
        `atoaxis.aiConsent.${status.id}`
      );
      if (consent?.state === "denied") {
        return false;
      }
      if (
        consent?.state === "deferred" &&
        consent.updatedAt &&
        Date.now() - consent.updatedAt < promptSnoozeMs
      ) {
        return false;
      }
      return true;
    });
    if (!eligible) {
      return;
    }
    const choice = await vscode.window.showInformationMessage(
      "AtoAxis detected a supported AI coding tool. Enable AI attribution tracking?",
      "Set up now",
      "Later"
    );
    if (choice === "Set up now") {
      const configured = await vscode.commands.executeCommand<boolean>(
        "wakaclock.setupAiTracking"
      );
      if (!configured) {
        // A failed/partial setup remains eligible on the next activation. The command
        // already showed the actionable error, so do not immediately show another prompt.
        return;
      }
    } else {
      // "Later" means later, not never. Keep the seven-day snooze separate from the
      // per-agent consent records written by the multi-select command.
      await context.globalState.update("atoaxis.aiSetupPromptedAt", Date.now());
    }
  } catch (error) {
    logger.warn("AI setup detection failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

let finalJournalPublication: (() => Promise<void>) | undefined;

export function deactivate(): Thenable<void> | undefined {
  const bufferManager = activeBufferManager;
  activeBufferManager = undefined;
  return bufferManager?.flushAllBuffers("shutdown").finally(async () => {
    try { await finalJournalPublication?.(); } finally { finalJournalPublication = undefined; bufferManager.closeJournal(); }
  });
}
