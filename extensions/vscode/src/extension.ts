import * as vscode from "vscode";
import { HeartbeatBufferManager } from "./buffer";
import { WakaclockCliService } from "./cli";
import { registerCommands } from "./commands";
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

  context.subscriptions.push(configService, statusBar);

  statusBar.start();
  registerCommands(context, configService, cliService, bufferManager, statusBar);
  registerEventSubscriptions(context, configService, bufferManager, logger);
  void vscode.commands.executeCommand("setContext", "wakaclock.enabled", true);
  logger.debug("wakaclock extension activated");
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered during activation.
}
