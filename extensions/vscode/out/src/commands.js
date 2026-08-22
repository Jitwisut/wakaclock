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
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const secrets_1 = require("./secrets");
function registerCommands(context, configService, cliService, bufferManager, statusBar, aiIntegrations) {
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
            const today = await cliService.getToday();
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
        // Stored via SecretStorage (OS keychain), never in settings.json. Written first
        // so the verification below authenticates with the key the user just entered.
        await (0, secrets_1.setStoredApiKey)(context.secrets, trimmed);
        // Mirror into wakaclock-cli's config.toml (the only channel AI agent hooks can
        // read a key from) and confirm the server accepts it, rather than reporting
        // "saved" for a key that silently fails on every heartbeat from here on.
        const result = await cliService.syncAndVerifyApiKey(trimmed);
        if (!result.verified) {
            await vscode.window.showErrorMessage(`Wakaclock API key saved, but the server rejected it — heartbeats will not be recorded. ${result.verifyError ?? ""}`.trim());
            return;
        }
        if (!result.mirroredToCliConfig) {
            await vscode.window.showWarningMessage(`Wakaclock API key saved and verified for VS Code, but it couldn't be written to wakaclock-cli's config, so AI agent integrations (Claude Code, Codex, Gemini CLI) will not be able to authenticate: ${result.mirrorError ?? ""}`.trim());
            return;
        }
        await vscode.window.showInformationMessage("Wakaclock API key saved, verified with the server, and synced to wakaclock-cli for AI agent integrations.");
    }), vscode.commands.registerCommand("wakaclock.clearApiKey", async () => {
        const existing = await (0, secrets_1.getStoredApiKey)(context.secrets);
        if (!existing) {
            await vscode.window.showInformationMessage("No Wakaclock API key is currently set.");
            return;
        }
        await (0, secrets_1.clearStoredApiKey)(context.secrets);
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
    }), vscode.commands.registerCommand("wakaclock.setupAiTracking", async () => {
        return setupAiTracking(aiIntegrations);
    }), vscode.commands.registerCommand("wakaclock.repairAiIntegrations", async () => {
        return setupAiTracking(aiIntegrations, true);
    }));
}
async function setupAiTracking(aiIntegrations, repairing = false) {
    try {
        const result = await aiIntegrations.setup();
        const configured = result.configured.length;
        const failed = result.failed.length;
        const prefix = repairing ? "AI integrations repaired" : "AI tracking configured";
        if (failed > 0) {
            await vscode.window.showWarningMessage(`${prefix}: ${configured} configured, ${failed} failed. Run “AtoAxis: Show AI Tracking Status” for details.`);
            return false;
        }
        else if (configured > 0) {
            await vscode.window.showInformationMessage(`${prefix}: ${configured} AI tool(s) enabled.`);
            return true;
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
//# sourceMappingURL=commands.js.map