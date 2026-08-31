"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureBrokerRunning = ensureBrokerRunning;
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const secrets_1 = require("./secrets");
const utils_1 = require("./utils");
async function ensureBrokerRunning(deps) {
    let installError;
    try {
        await deps.installAgent();
    }
    catch (error) {
        installError = error instanceof Error ? error.message : String(error);
    }
    if (!installError) {
        try {
            const status = await deps.getBrokerStatus();
            if (status.running === true) {
                return { running: true, viaFallback: false };
            }
        }
        catch {
            // Status unreadable — treat exactly like "not running" and fall back.
        }
    }
    try {
        const disposable = await deps.startExtensionOwnedAgent();
        return { running: true, viaFallback: true, disposable, error: installError };
    }
    catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        return {
            running: false,
            viaFallback: false,
            error: [installError, fallbackMessage].filter(Boolean).join("; "),
        };
    }
}
function registerCommands(context, configService, cliService, bufferManager, statusBar, aiIntegrations, onVerifiedApiKey) {
    function workspaceProject(editor) {
        if (!editor) {
            return undefined;
        }
        return vscode.workspace.getWorkspaceFolder(editor.document.uri)?.name;
    }
    context.subscriptions.push(vscode.commands.registerCommand("wakaclock.configureCliPath", async () => {
        const value = await vscode.window.showInputBox({
            prompt: "Absolute path to wakaclock-cli",
            placeHolder: "C:/path/to/wakaclock-cli.exe"
        });
        if (value === undefined) {
            return;
        }
        await configService.updateSetting("cliPath", value.trim());
        await vscode.window.showInformationMessage("Wakaclock CLI path updated.");
    }), vscode.commands.registerCommand("wakaclock.showToday", async () => {
        try {
            // Must match the timezone the status bar passes, or the popup and the
            // status bar describe two different 24-hour windows — which is how the
            // bar could read "0s" while this popup read "11m 46s".
            const today = await cliService.getToday((0, utils_1.localTimezone)());
            await vscode.window.showInformationMessage(`Today: ${today.humanReadable} (${today.heartbeatCount} heartbeats)`);
        }
        catch (error) {
            await vscode.window.showErrorMessage(error instanceof Error ? error.message : "Unable to load today's total.");
        }
    }), vscode.commands.registerCommand("wakaclock.sendHeartbeatNow", async () => {
        await bufferManager.flushCurrentEditor(vscode.window.activeTextEditor, "manual", {
            force: true
        }, workspaceProject(vscode.window.activeTextEditor));
        await statusBar.refresh();
    }), vscode.commands.registerCommand("wakaclock.toggleStatusBar", async () => {
        const current = configService.getSnapshot().statusBarEnabled;
        await configService.updateSetting("statusBarEnabled", !current);
        statusBar.applyVisibility();
        await statusBar.refresh();
    }), vscode.commands.registerCommand("wakaclock.setApiKey", async () => {
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
            await vscode.window.showErrorMessage(`AtoAxis rejected this API key; your previous key was kept. ${result.verifyError ?? ""}`.trim());
            return;
        }
        if (result.status === "subscription_required") {
            await (0, secrets_1.setStoredApiKey)(context.secrets, trimmed);
            await (0, secrets_1.clearPendingApiKey)(context.secrets);
            await statusBar.refresh();
            await vscode.window.showWarningMessage("This API key is valid, but the account needs an active AtoAxis subscription before time can be uploaded.");
            return;
        }
        if (result.status === "unreachable" || result.status === "server_error") {
            // A pending identity is useful for offline queueing. It is safe to retain in
            // SecretStorage, but do not mirror it to the background agent until verified.
            const existing = await (0, secrets_1.getStoredApiKey)(context.secrets);
            await (0, secrets_1.setPendingApiKey)(context.secrets, trimmed);
            if (!existing) {
                await (0, secrets_1.setStoredApiKey)(context.secrets, trimmed);
            }
            await statusBar.refresh();
            void retryPendingVerification(context, cliService, statusBar);
            await vscode.window.showWarningMessage("AtoAxis is unreachable right now. The key is stored securely and editor activity will be queued offline; verification will retry automatically.");
            return;
        }
        if (!result.verified || result.status !== "verified") {
            await vscode.window.showErrorMessage(`AtoAxis connection is incompatible with this Extension: ${result.verifyError ?? "upgrade the bundled CLI/server"}`);
            return;
        }
        await (0, secrets_1.setStoredApiKey)(context.secrets, trimmed);
        await (0, secrets_1.clearPendingApiKey)(context.secrets);
        await statusBar.refresh();
        // The activation bootstrap may already have returned because no key was
        // available at startup. Re-run it after verification so an existing AI
        // consent immediately refreshes the broker service, and a newly eligible
        // integration can receive the normal consent prompt.
        onVerifiedApiKey?.();
        await vscode.window.showInformationMessage("AtoAxis API key verified and saved securely. Time tracking is now active.");
    }), vscode.commands.registerCommand("wakaclock.clearApiKey", async () => {
        const existing = await (0, secrets_1.getStoredApiKey)(context.secrets);
        if (!existing) {
            await vscode.window.showInformationMessage("No Wakaclock API key is currently set.");
            return;
        }
        await (0, secrets_1.clearStoredApiKey)(context.secrets);
        await (0, secrets_1.clearPendingApiKey)(context.secrets);
        await statusBar.refresh();
        await vscode.window.showInformationMessage("Wakaclock API key cleared — heartbeats will use the unauthenticated user_id again.");
        try {
            await cliService.clearApiKey();
        }
        catch (error) {
            await vscode.window.showWarningMessage(`Cleared for VS Code, but couldn't clear the key from wakaclock-cli's config: ${error instanceof Error ? error.message : String(error)}`);
        }
    }), vscode.commands.registerCommand("wakaclock.showAiTrackingStatus", async () => {
        try {
            const statuses = await aiIntegrations.getStatus();
            await showAiStatus(statuses);
        }
        catch (error) {
            await vscode.window.showErrorMessage(error instanceof Error ? error.message : "Unable to inspect AI integrations.");
        }
    }), vscode.commands.registerCommand("wakaclock.showBrokerStatus", async () => {
        try {
            const status = await cliService.getBrokerStatus();
            const inbox = status.inbox;
            const lastError = inbox?.last_error_message;
            await vscode.window.showInformationMessage(`Broker ${status.running ? "running" : "stopped"}; ` +
                `pending ${inbox?.pending ?? 0}, retry ${inbox?.retry ?? 0}, ` +
                `dead-letter ${inbox?.dead_letter ?? 0}, outbound ${status.outbound_queue_count ?? 0}.` +
                (lastError ? ` Last error: ${lastError}` : ""));
        }
        catch (error) {
            await vscode.window.showErrorMessage(error instanceof Error ? error.message : "Unable to inspect the local AI broker.");
        }
    }), vscode.commands.registerCommand("wakaclock.setupAiTracking", async () => {
        return setupAiTracking(aiIntegrations, cliService, context);
    }), vscode.commands.registerCommand("wakaclock.repairAiIntegrations", async () => {
        return setupAiTracking(aiIntegrations, cliService, context, true);
    }));
}
async function setupAiTracking(aiIntegrations, cliService, context, repairing = false) {
    try {
        const selectedIds = await chooseAiAgents(aiIntegrations, context, repairing);
        if (!selectedIds || selectedIds.length === 0) {
            return false;
        }
        const key = await (0, secrets_1.getStoredApiKey)(context.secrets);
        if (!key || (await cliService.verifyApiKey(key)).status !== "verified") {
            await vscode.window.showWarningMessage("Verify an AtoAxis API key before enabling AI tracking. Editor heartbeats remain available offline.");
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
            const key = await (0, secrets_1.getStoredApiKey)(context.secrets);
            if (key) {
                await cliService.persistApiKey(key).catch(() => undefined);
            }
            const broker = await ensureBrokerRunning(cliService);
            const serviceInstalled = broker.running;
            if (broker.disposable) {
                context.subscriptions.push(broker.disposable);
            }
            if (broker.running && broker.viaFallback) {
                await vscode.window.showInformationMessage(`${prefix}; the Extension Host will keep the transcript watcher running while this workspace is open.`);
            }
            if (!broker.running) {
                await vscode.window.showWarningMessage(`${prefix}, but the always-on transcript agent could not be started. Upgrade wakaclock-cli if this persists: ${broker.error ?? "unknown error"}`);
            }
            if (failed > 0) {
                await vscode.window.showWarningMessage(`${prefix}: ${configured} configured, ${failed} failed.${serviceInstalled ? "" : " The always-on agent also needs an upgrade or repair."} Run “AtoAxis: Show AI Tracking Status” for details.`);
                return false;
            }
            if (serviceInstalled) {
                await vscode.window.showInformationMessage(`${prefix}: ${configured} AI tool(s) enabled.`);
            }
            return serviceInstalled;
        }
        else {
            await vscode.window.showInformationMessage("No supported AI CLI was detected. Install Claude Code, Codex CLI or Gemini CLI and run setup again.");
            return false;
        }
    }
    catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : "Unable to configure AI integrations.");
        return false;
    }
}
/** Ask per detected tool; no integration is changed until the user confirms. */
async function chooseAiAgents(aiIntegrations, context, repairing = false) {
    const statuses = await aiIntegrations.getStatus();
    const candidates = statuses.filter((status) => status.detected && (repairing || !status.enabled));
    if (candidates.length === 0) {
        await vscode.window.showInformationMessage(repairing
            ? "No configured supported AI coding tool was detected. Install Claude Code, Codex CLI or Gemini CLI and run repair again."
            : "No new supported AI coding tool was detected. Install Claude Code, Codex CLI or Gemini CLI and run setup again.");
        return undefined;
    }
    const picked = await vscode.window.showQuickPick(candidates.map((status) => ({
        label: status.label,
        description: status.id,
        detail: "Adds an AtoAxis hook when supported and enables the background transcript watcher. Prompts and source code are never uploaded.",
        id: status.id,
    })), {
        title: repairing
            ? "Choose AI tools to repair for AtoAxis"
            : "Choose AI tools for AtoAxis tracking",
        placeHolder: "Select one or more detected tools",
        canPickMany: true,
        ignoreFocusOut: true,
    });
    if (!picked || picked.length === 0) {
        return undefined;
    }
    const action = await vscode.window.showQuickPick(repairing
        ? ["Repair selected", "Cancel"]
        : ["Enable selected", "Not now", "Don't ask again"], {
        title: repairing ? "Confirm AI integration repair" : "Confirm AI tracking setup",
        placeHolder: repairing
            ? "Reinstall hooks, broker service and token permissions"
            : "Choose when to install the selected integrations",
        ignoreFocusOut: true,
    });
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
async function showAiStatus(statuses) {
    const items = statuses.map((status) => ({
        label: `${status.detected ? "$(check)" : "$(circle-slash)"} ${status.label}`,
        description: status.detected
            ? status.enabled
                ? "detected · tracking enabled"
                : "detected · setup required"
            : "not detected",
        detail: status.reason
    }));
    await vscode.window.showQuickPick(items, {
        title: "AtoAxis AI Tracking Status",
        placeHolder: "Supported CLI integrations"
    });
}
async function retryPendingVerification(context, cliService, statusBar) {
    let delayMs = 5_000;
    for (;;) {
        const pending = await (0, secrets_1.getPendingApiKey)(context.secrets);
        if (!pending) {
            return;
        }
        const result = await cliService.verifyApiKey(pending);
        if (result.status === "verified") {
            await (0, secrets_1.setStoredApiKey)(context.secrets, pending);
            await (0, secrets_1.clearPendingApiKey)(context.secrets);
            await statusBar.refresh();
            void cliService.getStatus().catch(() => undefined);
            await vscode.window.showInformationMessage("AtoAxis is connected again; pending activity will be uploaded once.");
            return;
        }
        if (result.status !== "unreachable" && result.status !== "server_error") {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * 2, 5 * 60_000);
    }
}
//# sourceMappingURL=commands.js.map