import * as vscode from "vscode";
import type { AiAgentId, AiAgentSetupResult, AiAgentStatus } from "./agentSetup";
import { formatAiDetectionReport, runAiDetectionSelfTest } from "./aiDetectionSelfTest";
import type { HeartbeatBufferManager } from "./buffer";
import type { WakaclockCliService } from "./cli";
import type { WakaclockConfigService } from "./config";
import {
  clearPendingApiKey,
  clearStoredApiKey,
  getPendingApiKey,
  getStoredApiKey,
  setPendingApiKey,
  setStoredApiKey,
} from "./secrets";
import type { StatusBarController } from "./statusBar";
import { localTimezone } from "./utils";

export interface AiIntegrationController {
  getStatus(): Promise<AiAgentStatus[]>;
  setup(selectedIds?: AiAgentId[]): Promise<AiAgentSetupResult>;
}

/**
 * planai2.md Phase 0.2b: install the per-user OS service, then confirm it is
 * *actually* running before trusting it. `broker install` can exit 0 while
 * launchd / systemd / Task Scheduler silently declines to keep the process up
 * (sandboxed hosts, a disabled user manager, a denied Task Scheduler policy) —
 * previously only a thrown `installAgent()` triggered the Extension-Host-owned
 * fallback, and only on remote or Linux. This checks `broker status` on every
 * platform and falls back whenever the service is not up.
 */
export interface BrokerEnsureDeps {
  installAgent(): Promise<unknown>;
  getBrokerStatus(): Promise<{ running?: boolean }>;
  startExtensionOwnedAgent(): Promise<{ dispose(): void }>;
}

export interface BrokerEnsureOutcome {
  /** A watcher is up — either the OS service or the extension-owned child. */
  running: boolean;
  /** The extension-owned child is what is keeping it up. */
  viaFallback: boolean;
  /** Present only when `viaFallback` — push onto `context.subscriptions`. */
  disposable?: { dispose(): void };
  /** Why the OS service was not usable, when a fallback was needed or failed. */
  error?: string;
}

export async function ensureBrokerRunning(
  deps: BrokerEnsureDeps,
): Promise<BrokerEnsureOutcome> {
  let installError: string | undefined;
  try {
    await deps.installAgent();
  } catch (error) {
    installError = error instanceof Error ? error.message : String(error);
  }

  if (!installError) {
    try {
      const status = await deps.getBrokerStatus();
      if (status.running === true) {
        return { running: true, viaFallback: false };
      }
    } catch {
      // Status unreadable — treat exactly like "not running" and fall back.
    }
  }

  try {
    const disposable = await deps.startExtensionOwnedAgent();
    return { running: true, viaFallback: true, disposable, error: installError };
  } catch (fallbackError) {
    const fallbackMessage =
      fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    return {
      running: false,
      viaFallback: false,
      error: [installError, fallbackMessage].filter(Boolean).join("; "),
    };
  }
}

export function registerCommands(
  context: vscode.ExtensionContext,
  configService: WakaclockConfigService,
  cliService: Pick<
    WakaclockCliService,
    | "getToday"
    | "setApiKey"
    | "persistApiKey"
    | "clearApiKey"
    | "syncAndVerifyApiKey"
    | "installAgent"
    | "startExtensionOwnedAgent"
    | "verifyApiKey"
    | "getStatus"
    | "getBrokerStatus"
  >,
  bufferManager: Pick<HeartbeatBufferManager, "flushCurrentEditor">,
  statusBar: Pick<StatusBarController, "applyVisibility" | "refresh">,
  aiIntegrations: AiIntegrationController,
  onVerifiedApiKey?: () => void,
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
        // Must match the timezone the status bar passes, or the popup and the
        // status bar describe two different 24-hour windows — which is how the
        // bar could read "0s" while this popup read "11m 46s".
        const today = await cliService.getToday(localTimezone());
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

      // Verify the candidate before replacing an existing key. The candidate is
      // passed to the managed CLI through an environment variable, never argv or
      // settings.json.
      const result = await cliService.syncAndVerifyApiKey(trimmed);

      if (result.status === "invalid_key") {
        await vscode.window.showErrorMessage(
          `AtoAxis rejected this API key; your previous key was kept. ${
            result.verifyError ?? ""
          }`.trim()
        );
        return;
      }

      if (result.status === "subscription_required") {
        await setStoredApiKey(context.secrets, trimmed);
        await clearPendingApiKey(context.secrets);
        await statusBar.refresh();
        await vscode.window.showWarningMessage(
          "This API key is valid, but the account needs an active AtoAxis subscription before time can be uploaded."
        );
        return;
      }

      if (result.status === "unreachable" || result.status === "server_error") {
        // A pending identity is useful for offline queueing. It is safe to retain in
        // SecretStorage, but do not mirror it to the background agent until verified.
        const existing = await getStoredApiKey(context.secrets);
        await setPendingApiKey(context.secrets, trimmed);
        if (!existing) {
          await setStoredApiKey(context.secrets, trimmed);
        }
        await statusBar.refresh();
        void retryPendingVerification(context, cliService, statusBar);
        await vscode.window.showWarningMessage(
          "AtoAxis is unreachable right now. The key is stored securely and editor activity will be queued offline; verification will retry automatically."
        );
        return;
      }

      if (!result.verified || result.status !== "verified") {
        await vscode.window.showErrorMessage(
          `AtoAxis connection is incompatible with this Extension: ${result.verifyError ?? "upgrade the bundled CLI/server"}`
        );
        return;
      }

      await setStoredApiKey(context.secrets, trimmed);
      await clearPendingApiKey(context.secrets);
      await statusBar.refresh();
      // The activation bootstrap may already have returned because no key was
      // available at startup. Re-run it after verification so an existing AI
      // consent immediately refreshes the broker service, and a newly eligible
      // integration can receive the normal consent prompt.
      onVerifiedApiKey?.();

      await vscode.window.showInformationMessage(
        "AtoAxis API key verified and saved securely. Time tracking is now active."
      );
    }),
    vscode.commands.registerCommand("wakaclock.clearApiKey", async () => {
      const existing = await getStoredApiKey(context.secrets);
      if (!existing) {
        await vscode.window.showInformationMessage("No Wakaclock API key is currently set.");
        return;
      }

      await clearStoredApiKey(context.secrets);
      await clearPendingApiKey(context.secrets);
      await statusBar.refresh();
      await vscode.window.showInformationMessage(
        "Wakaclock API key cleared — heartbeats will use the unauthenticated user_id again."
      );

      try {
        await cliService.clearApiKey();
      } catch (error) {
        await vscode.window.showWarningMessage(
          `Cleared for VS Code, but couldn't clear the key from wakaclock-cli's config: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),
    vscode.commands.registerCommand("wakaclock.showAiTrackingStatus", async () => {
      try {
        const statuses = await aiIntegrations.getStatus();
        await showAiStatus(statuses);
      } catch (error) {
        await vscode.window.showErrorMessage(
          error instanceof Error ? error.message : "Unable to inspect AI integrations."
        );
      }
    }),
    vscode.commands.registerCommand("wakaclock.showBrokerStatus", async () => {
      try {
        const status = await cliService.getBrokerStatus();
        const inbox = status.inbox;
        const lastError = inbox?.last_error_message;
        await vscode.window.showInformationMessage(
          `Broker ${status.running ? "running" : "stopped"}; ` +
            `pending ${inbox?.pending ?? 0}, retry ${inbox?.retry ?? 0}, ` +
            `dead-letter ${inbox?.dead_letter ?? 0}, outbound ${status.outbound_queue_count ?? 0}.` +
            (lastError ? ` Last error: ${lastError}` : "")
        );
      } catch (error) {
        await vscode.window.showErrorMessage(
          error instanceof Error ? error.message : "Unable to inspect the local AI broker."
        );
      }
    }),
    vscode.commands.registerCommand("wakaclock.setupAiTracking", async () => {
      return setupAiTracking(aiIntegrations, cliService, context);
    }),
    vscode.commands.registerCommand("wakaclock.repairAiIntegrations", async () => {
      return setupAiTracking(aiIntegrations, cliService, context, true);
    }),
    vscode.commands.registerCommand("wakaclock.testAiDetection", async () => {
      try {
        const report = await runAiDetectionSelfTest({
          getBrokerStatus: () => cliService.getBrokerStatus(),
          getAiAgentStatuses: () => aiIntegrations.getStatus(),
        });
        const body = formatAiDetectionReport(report);
        if (report.verdict === "ok") {
          await vscode.window.showInformationMessage(body, { modal: false });
        } else {
          await vscode.window.showWarningMessage(body, { modal: false });
        }
      } catch (error) {
        await vscode.window.showErrorMessage(
          error instanceof Error ? error.message : "Unable to run the AI detection self-test."
        );
      }
    })
  );
}

async function setupAiTracking(
  aiIntegrations: AiIntegrationController,
  cliService: Pick<
    WakaclockCliService,
    | "installAgent"
    | "persistApiKey"
    | "startExtensionOwnedAgent"
    | "verifyApiKey"
    | "getStatus"
    | "getBrokerStatus"
  >,
  context: vscode.ExtensionContext,
  repairing = false
): Promise<boolean> {
  try {
    const selectedIds = await chooseAiAgents(aiIntegrations, context, repairing);
    if (!selectedIds || selectedIds.length === 0) {
      return false;
    }
    const key = await getStoredApiKey(context.secrets);
    if (!key || (await cliService.verifyApiKey(key)).status !== "verified") {
      await vscode.window.showWarningMessage(
        "Verify an AtoAxis API key before enabling AI tracking. Editor heartbeats remain available offline.",
      );
      return false;
    }
    const result = await aiIntegrations.setup(selectedIds);
    for (const id of result.configured) {
      await context.globalState.update(`atoaxis.aiConsent.${id}`, {
        state: "enabled",
        integrationVersion: "1",
        updatedAt: Date.now(),
      });
    }
    const configured = result.configured.length;
    const failed = result.failed.length;
    const prefix = repairing ? "AI integrations repaired" : "AI tracking configured";
    if (configured > 0) {
      const key = await getStoredApiKey(context.secrets);
      if (key) {
        await cliService.persistApiKey(key).catch(() => undefined);
      }
      const broker = await ensureBrokerRunning(cliService);
      const serviceInstalled = broker.running;
      if (broker.disposable) {
        context.subscriptions.push(broker.disposable);
      }
      if (broker.running && broker.viaFallback) {
        await vscode.window.showInformationMessage(
          `${prefix}; the Extension Host will keep the transcript watcher running while this workspace is open.`,
        );
      }
      if (!broker.running) {
        await vscode.window.showWarningMessage(
          `${prefix}, but the always-on transcript agent could not be started. Upgrade wakaclock-cli if this persists: ${
            broker.error ?? "unknown error"
          }`,
        );
      }
      if (failed > 0) {
        await vscode.window.showWarningMessage(
          `${prefix}: ${configured} configured, ${failed} failed.${
            serviceInstalled ? "" : " The always-on agent also needs an upgrade or repair."
          } Run “AtoAxis: Show AI Tracking Status” for details.`
        );
        return false;
      }
      if (serviceInstalled) {
        await vscode.window.showInformationMessage(`${prefix}: ${configured} AI tool(s) enabled.`);
      }
      return serviceInstalled;
    } else {
      await vscode.window.showInformationMessage(
        "No supported AI CLI was detected. Install a supported integration and run setup again."
      );
      return false;
    }
  } catch (error) {
    await vscode.window.showErrorMessage(
      error instanceof Error ? error.message : "Unable to configure AI integrations."
    );
    return false;
  }
}

/** Ask per detected tool; no integration is changed until the user confirms. */
async function chooseAiAgents(
  aiIntegrations: AiIntegrationController,
  context: vscode.ExtensionContext,
  repairing = false,
): Promise<AiAgentId[] | undefined> {
  const statuses = await aiIntegrations.getStatus();
  const candidates = statuses.filter(
    (status) => status.detected && (repairing || !status.enabled),
  );
  if (candidates.length === 0) {
    await vscode.window.showInformationMessage(
      repairing
        ? "No configured supported AI coding tool was detected. Install a supported integration and run repair again."
        : "No new supported AI coding tool was detected. Install a supported integration and run setup again.",
    );
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    candidates.map((status) => ({
      label: status.label,
      description: status.id,
      detail:
        "Adds an AtoAxis hook when supported and enables the background transcript watcher. Only explicit hook/transcript evidence can name an agent; process/filesystem checks are diagnostics-only. Prompts and source code are never uploaded.",
      id: status.id,
    })),
    {
      title: repairing
        ? "Choose AI tools to repair for AtoAxis"
        : "Choose AI tools for AtoAxis tracking",
      placeHolder: "Select one or more detected tools",
      canPickMany: true,
      ignoreFocusOut: true,
    },
  );
  if (!picked || picked.length === 0) {
    return undefined;
  }
  const action = await vscode.window.showQuickPick(
    repairing
      ? ["Repair selected", "Cancel"]
      : ["Enable selected", "Not now", "Don't ask again"],
    {
      title: repairing ? "Confirm AI integration repair" : "Confirm AI tracking setup",
      placeHolder: repairing
        ? "Reinstall hooks, broker service and token permissions"
        : "Choose when to install the selected integrations",
      ignoreFocusOut: true,
    },
  );
  if (action !== (repairing ? "Repair selected" : "Enable selected")) {
    if (repairing) {
      return undefined;
    }
    const state = action === "Don't ask again" ? "denied" : "deferred";
    for (const item of picked) {
      await context.globalState.update(`atoaxis.aiConsent.${item.id}`, {
        state,
        integrationVersion: "1",
        updatedAt: Date.now(),
      });
    }
    return undefined;
  }
  return picked.map((item) => item.id);
}

async function showAiStatus(statuses: AiAgentStatus[]): Promise<void> {
  const items = statuses.map((status) => ({
    label: `${status.detected ? "$(check)" : "$(circle-slash)"} ${status.label}`,
    description: status.detected
      ? status.enabled
        ? "detected · capture configured (live certification shown separately)"
        : "detected · setup required"
      : "not detected",
    detail: status.reason
  }));

  await vscode.window.showQuickPick(items, {
    title: "AtoAxis AI Tracking Status",
    placeHolder: "Supported CLI integrations"
  });
}

async function retryPendingVerification(
  context: vscode.ExtensionContext,
  cliService: Pick<WakaclockCliService, "verifyApiKey" | "getStatus">,
  statusBar: Pick<StatusBarController, "refresh">,
): Promise<void> {
  let delayMs = 5_000;
  for (;;) {
    const pending = await getPendingApiKey(context.secrets);
    if (!pending) {
      return;
    }
    const result = await cliService.verifyApiKey(pending);
    if (result.status === "verified") {
      await setStoredApiKey(context.secrets, pending);
      await clearPendingApiKey(context.secrets);
      await statusBar.refresh();
      void cliService.getStatus().catch(() => undefined);
      await vscode.window.showInformationMessage(
        "AtoAxis is connected again; pending activity will be uploaded once.",
      );
      return;
    }
    if (result.status !== "unreachable" && result.status !== "server_error") {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 2, 5 * 60_000);
  }
}
