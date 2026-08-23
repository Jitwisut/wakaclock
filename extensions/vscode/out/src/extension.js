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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const agentSetup_1 = require("./agentSetup");
const buffer_1 = require("./buffer");
const cli_1 = require("./cli");
const commands_1 = require("./commands");
const config_1 = require("./config");
const events_1 = require("./events");
const logging_1 = require("./logging");
const managedCli_1 = require("./managedCli");
const secrets_1 = require("./secrets");
const statusBar_1 = require("./statusBar");
function activate(context) {
    console.log("[wakaclock] extension activated");
    const configService = new config_1.WakaclockConfigService();
    const logger = new logging_1.Logger(() => configService.getSnapshot().debugLogging);
    void warnIgnoredWorkspaceOverrides(context, logger);
    const managedCli = new managedCli_1.ManagedCliManager({
        extensionPath: context.extensionPath,
        globalStoragePath: context.globalStorageUri.fsPath,
        extensionVersion: String(context.extension.packageJSON.version ?? "0.0.0")
    }, () => configService.getSnapshot(), logger);
    const extensionVersion = String(context.extension.packageJSON.version ?? "0.0.0");
    const cliService = new cli_1.WakaclockCliService(() => configService.getSnapshot(), logger, async () => (await (0, secrets_1.getStoredApiKey)(context.secrets)) ?? (await (0, secrets_1.getPendingApiKey)(context.secrets)), managedCli, `wakaclock-vscode/${extensionVersion}`);
    const statusBar = new statusBar_1.StatusBarController(() => configService.getSnapshot(), cliService, logger, async () => (await (0, secrets_1.getStoredApiKey)(context.secrets)) ?? (await (0, secrets_1.getPendingApiKey)(context.secrets)));
    const bufferManager = new buffer_1.HeartbeatBufferManager(() => configService.getSnapshot(), cliService, logger, () => statusBar.handleHeartbeatSent(), undefined, () => statusBar.handleActivity());
    statusBar.setBufferedSecondsProvider(() => bufferManager.getBufferedSeconds());
    statusBar.setBufferedSegmentsProvider(() => bufferManager.getBufferedSegments());
    const stableAgentDir = (0, agentSetup_1.syncAgentPluginsToStableDir)({
        extensionPath: context.extensionPath,
        extensionVersion,
        logger
    });
    const aiIntegrations = {
        getStatus: () => (0, agentSetup_1.detectAiAgents)(),
        setup: async (selectedIds) => {
            const stableDir = await stableAgentDir;
            if (!stableDir) {
                throw new Error("Bundled AtoAxis AI integration resources are unavailable.");
            }
            return (0, agentSetup_1.setupDetectedAiAgents)({
                stableDir,
                cliPath: await managedCli.ensureReady(),
                logger,
                selectedIds
            });
        }
    };
    context.subscriptions.push(configService, statusBar);
    void (async () => {
        const key = (await (0, secrets_1.getStoredApiKey)(context.secrets)) ??
            (await (0, secrets_1.getPendingApiKey)(context.secrets));
        statusBar.setConnectionState(key ? "connecting" : "needs-api-key");
    })();
    statusBar.start();
    (0, commands_1.registerCommands)(context, configService, cliService, bufferManager, statusBar, aiIntegrations);
    (0, events_1.registerEventSubscriptions)(context, configService, bufferManager, logger);
    void vscode.commands.executeCommand("setContext", "wakaclock.enabled", true);
    // AI discovery/setup is deliberately detached from the editor heartbeat pipeline.
    // It starts only after an authenticated key is available and never blocks the
    // event listeners or their serialized buffer snapshots.
    void initializeConnection(context, cliService, aiIntegrations, logger);
    logger.debug("wakaclock extension activated");
}
async function warnIgnoredWorkspaceOverrides(context, logger) {
    const configuration = vscode.workspace.getConfiguration("wakaclock");
    const ignored = ["cliPath", "serverUrl"].filter((key) => {
        const inspected = configuration.inspect(key);
        return inspected?.workspaceValue !== undefined || inspected?.workspaceFolderValue !== undefined;
    });
    if (ignored.length === 0 || context.globalState.get("atoaxis.workspaceOverrideWarning")) {
        return;
    }
    await context.globalState.update("atoaxis.workspaceOverrideWarning", true);
    logger.warn("ignored workspace-level AtoAxis security settings", { keys: ignored });
    void vscode.window.showWarningMessage("AtoAxis ignores workspace cliPath/serverUrl settings for security. Configure these values globally only.");
}
async function initializeConnection(context, cliService, aiIntegrations, logger) {
    try {
        let retryDelayMs = 5_000;
        for (;;) {
            const primaryKey = await (0, secrets_1.getStoredApiKey)(context.secrets);
            const pendingKey = await (0, secrets_1.getPendingApiKey)(context.secrets);
            const candidates = [primaryKey, pendingKey].filter((candidate, index, all) => Boolean(candidate) && all.indexOf(candidate) === index);
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
                    await (0, secrets_1.setStoredApiKey)(context.secrets, verifiedKey);
                }
                await (0, secrets_1.clearPendingApiKey)(context.secrets);
                // Existing consent survives extension updates. Re-installing the per-user
                // manifest points it at the newly managed binary before an old version can be
                // removed, without adding a new integration or prompting again.
                const statuses = await aiIntegrations.getStatus();
                if (statuses.some((status) => status.enabled)) {
                    void cliService.installAgent().catch((error) => logger.warn("could not refresh the existing AtoAxis agent service", {
                        error: error instanceof Error ? error.message : String(error)
                    }));
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
    }
    catch (error) {
        // A disconnected server must not prevent normal editor activity from being
        // buffered locally. Verification retries on the next activation/refresh.
        logger.warn("AtoAxis connection bootstrap failed", {
            error: error instanceof Error ? error.message : String(error)
        });
    }
}
function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function maybeOfferAiSetup(context, aiIntegrations, logger) {
    const lastPromptedAt = context.globalState.get("atoaxis.aiSetupPromptedAt");
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
            const consent = context.globalState.get(`atoaxis.aiConsent.${status.id}`);
            if (consent?.state === "denied") {
                return false;
            }
            if (consent?.state === "deferred" &&
                consent.updatedAt &&
                Date.now() - consent.updatedAt < promptSnoozeMs) {
                return false;
            }
            return true;
        });
        if (!eligible) {
            return;
        }
        const choice = await vscode.window.showInformationMessage("AtoAxis detected a supported AI coding tool. Enable AI attribution tracking?", "Set up now", "Later");
        if (choice === "Set up now") {
            const configured = await vscode.commands.executeCommand("wakaclock.setupAiTracking");
            if (!configured) {
                // A failed/partial setup remains eligible on the next activation. The command
                // already showed the actionable error, so do not immediately show another prompt.
                return;
            }
        }
        else {
            // "Later" means later, not never. Keep the seven-day snooze separate from the
            // per-agent consent records written by the multi-select command.
            await context.globalState.update("atoaxis.aiSetupPromptedAt", Date.now());
        }
    }
    catch (error) {
        logger.warn("AI setup detection failed", {
            error: error instanceof Error ? error.message : String(error)
        });
    }
}
function deactivate() {
    // VS Code disposes subscriptions registered during activation.
}
//# sourceMappingURL=extension.js.map