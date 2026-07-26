import * as vscode from "vscode";
import type { HeartbeatBufferManager } from "./buffer";
import type { WakaclockCliService } from "./cli";
import type { WakaclockConfigService } from "./config";
import { clearStoredApiKey, getStoredApiKey, setStoredApiKey } from "./secrets";
import type { StatusBarController } from "./statusBar";

export function registerCommands(
  context: vscode.ExtensionContext,
  configService: WakaclockConfigService,
  cliService: Pick<WakaclockCliService, "getToday">,
  bufferManager: Pick<HeartbeatBufferManager, "flushCurrentEditor">,
  statusBar: Pick<StatusBarController, "applyVisibility" | "refresh">
): void {
  function workspaceProject(editor?: vscode.TextEditor): string | undefined {
    if (!editor) {
      return undefined;
    }
    return vscode.workspace.getWorkspaceFolder(editor.document.uri)?.name;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("wakaclock.configureCliPath", async () => {
      const value = await vscode.window.showInputBox({
        prompt: "Absolute path to wakaclock-cli",
        placeHolder: "C:/path/to/wakaclock-cli.exe"
      });

      if (value === undefined) {
        return;
      }

      await configService.updateSetting("cliPath", value.trim());
      await vscode.window.showInformationMessage("Wakaclock CLI path updated.");
    }),
    vscode.commands.registerCommand("wakaclock.showToday", async () => {
      try {
        const today = await cliService.getToday();
        await vscode.window.showInformationMessage(
          `Today: ${today.humanReadable} (${today.heartbeatCount} heartbeats)`
        );
      } catch (error) {
        await vscode.window.showErrorMessage(
          error instanceof Error ? error.message : "Unable to load today's total."
        );
      }
    }),
    vscode.commands.registerCommand("wakaclock.sendHeartbeatNow", async () => {
      await bufferManager.flushCurrentEditor(
        vscode.window.activeTextEditor,
        "manual",
        {
          force: true
        },
        workspaceProject(vscode.window.activeTextEditor)
      );
      await statusBar.refresh();
    }),
    vscode.commands.registerCommand("wakaclock.toggleStatusBar", async () => {
      const current = configService.getSnapshot().statusBarEnabled;
      await configService.updateSetting("statusBarEnabled", !current);
      statusBar.applyVisibility();
      await statusBar.refresh();
    }),
    vscode.commands.registerCommand("wakaclock.setApiKey", async () => {
      const value = await vscode.window.showInputBox({
        prompt: "API key generated from the Wakaclock dashboard (Settings → API key)",
        placeHolder: "wcl_...",
        password: true,
        ignoreFocusOut: true
      });

      if (value === undefined) {
        return;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        await vscode.window.showWarningMessage("No API key entered — nothing was saved.");
        return;
      }

      // Stored via SecretStorage (OS keychain), never in settings.json.
      await setStoredApiKey(context.secrets, trimmed);
      await vscode.window.showInformationMessage("Wakaclock API key saved.");
    }),
    vscode.commands.registerCommand("wakaclock.clearApiKey", async () => {
      const existing = await getStoredApiKey(context.secrets);
      if (!existing) {
        await vscode.window.showInformationMessage("No Wakaclock API key is currently set.");
        return;
      }

      await clearStoredApiKey(context.secrets);
      await vscode.window.showInformationMessage(
        "Wakaclock API key cleared — heartbeats will use the unauthenticated user_id again."
      );
    })
  );
}
