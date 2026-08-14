import * as vscode from "vscode";
import {
  detectAiAgents,
  setupDetectedAiAgents,
  syncAgentPluginsToStableDir
} from "./agentSetup";
import { HeartbeatBufferManager } from "./buffer";
import { WakaclockCliService } from "./cli";
import { registerCommands } from "./commands";
import type { AiIntegrationController } from "./commands";
import { WakaclockConfigService } from "./config";
import { registerEventSubscriptions } from "./events";
import { Logger } from "./logging";
import { getStoredApiKey } from "./secrets";
import { StatusBarController } from "./statusBar";

export function activate(context: vscode.ExtensionContext): void {
  console.log("[wakaclock] extension activated");
  const configService = new WakaclockConfigService();
  const logger = new Logger(() => configService.getSnapshot().debugLogging);
  const cliService = new WakaclockCliService(
    () => configService.getSnapshot(),
    logger,
    () => getStoredApiKey(context.secrets)
  );
  const statusBar = new StatusBarController(() => configService.getSnapshot(), cliService, logger);
  const bufferManager = new HeartbeatBufferManager(
    () => configService.getSnapshot(),
    cliService,
    logger,
    () => statusBar.handleHeartbeatSent()
  );

  const stableAgentDir = syncAgentPluginsToStableDir({
    extensionPath: context.extensionPath,
    extensionVersion: String(context.extension.packageJSON.version ?? "0.0.0"),
    logger
  });
  const aiIntegrations = {
    getStatus: () => detectAiAgents(),
    setup: async () => {
      const stableDir = await stableAgentDir;
      if (!stableDir) {
        throw new Error("Bundled AtoAxis AI integration resources are unavailable.");
      }
      return setupDetectedAiAgents({
        stableDir,
        cliPath: configService.getSnapshot().cliPath,
        logger
      });
    }
  };

  context.subscriptions.push(configService, statusBar);

  statusBar.start();
  registerCommands(context, configService, cliService, bufferManager, statusBar, aiIntegrations);
  registerEventSubscriptions(context, configService, bufferManager, logger);
  void vscode.commands.executeCommand("setContext", "wakaclock.enabled", true);

  // Surface the one-click setup once when a supported CLI is present. The user can
  // always rerun the command later; we never modify another tool's config silently.
  void maybeOfferAiSetup(context, aiIntegrations, logger);

  logger.debug("wakaclock extension activated");
}

async function maybeOfferAiSetup(
  context: vscode.ExtensionContext,
  aiIntegrations: AiIntegrationController,
  logger: Logger
): Promise<void> {
  if (context.globalState.get<boolean>("atoaxis.aiSetupPrompted")) {
    return;
  }

  try {
    const statuses = await aiIntegrations.getStatus();
    if (!statuses.some((status) => status.detected && !status.enabled)) {
      return;
    }
    await context.globalState.update("atoaxis.aiSetupPrompted", true);
    const choice = await vscode.window.showInformationMessage(
      "AtoAxis detected a supported AI coding tool. Enable AI attribution tracking?",
      "Set up now",
      "Later"
    );
    if (choice === "Set up now") {
      await vscode.commands.executeCommand("wakaclock.setupAiTracking");
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
