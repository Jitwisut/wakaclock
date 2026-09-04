import * as vscode from "vscode";
import * as os from "node:os";
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

export function activate(context: vscode.ExtensionContext): void {
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
    `wakaclock-vscode/${extensionVersion}`
  );
  const statusBar = new StatusBarController(
    () => configService.getSnapshot(),
    cliService,
    logger,
    async () => (await getStoredApiKey(context.secrets)) ?? (await getPendingApiKey(context.secrets))
  );
  const bufferManager = new HeartbeatBufferManager(
    () => configService.getSnapshot(),
    cliService,
    logger,
    () => statusBar.handleHeartbeatSent(),
    undefined,
    () => statusBar.handleActivity()
  );
  statusBar.setBufferedSecondsProvider(() => bufferManager.getBufferedSeconds());
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

  // The broker is a separate process and may start before VS Code emits its
  // first configuration-change event. Persist the initial setting as well so a
  // user who has disabled automatic hook installation is protected immediately
  // on activation, including after an extension update or broker restart.
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
    () => void initializeConnection(context, cliService, aiIntegrations, logger),
  );
  registerEventSubscriptions(context, configService, bufferManager, logger);
  void vscode.commands.executeCommand("setContext", "wakaclock.enabled", true);

  // AI discovery/setup is deliberately detached from the editor heartbeat pipeline.
  // It starts only after an authenticated key is available and never blocks the
  // event listeners or their serialized buffer snapshots.
  void initializeConnection(context, cliService, aiIntegrations, logger);

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

async function initializeConnection(
  context: vscode.ExtensionContext,
  cliService: Pick<WakaclockCliService, "verifyApiKey" | "installAgent" | "getStatus">,
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
        // Existing consent survives extension updates. Re-installing the per-user
        // manifest points it at the newly managed binary before an old version can be
        // removed, without adding a new integration or prompting again.
        const statuses = await aiIntegrations.getStatus();
        if (statuses.some((status) => status.enabled)) {
          void cliService.installAgent().catch((error) =>
            logger.warn("could not refresh the existing AtoAxis agent service", {
              error: error instanceof Error ? error.message : String(error)
            })
          );
        }
        void cliService.getStatus().catch(() => undefined);
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

export function deactivate(): void {
  // VS Code disposes subscriptions registered during activation.
}
