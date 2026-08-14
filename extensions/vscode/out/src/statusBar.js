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
exports.StatusBarController = void 0;
const vscode = __importStar(require("vscode"));
const STATUS_REFRESH_MS = 60_000;
/**
 * Recognise the CLI's rejected-key failure. Matched on the wording
 * `ApiClient::reject_unauthorized` produces plus the server's own 401 body, since the
 * CLI surfaces failures as an exit code and a message rather than a typed error.
 */
function isAuthFailure(error) {
    const message = error instanceof Error ? error.message : String(error);
    return /API key was rejected|authentication required/i.test(message);
}
class StatusBarController {
    getConfig;
    cli;
    logger;
    item;
    interval;
    authFailureReported = false;
    constructor(getConfig, cli, logger) {
        this.getConfig = getConfig;
        this.cli = cli;
        this.logger = logger;
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = "wakaclock.showToday";
        this.item.name = "Wakaclock";
    }
    start() {
        this.applyVisibility();
        void this.refresh();
        this.interval = setInterval(() => {
            void this.refresh();
        }, STATUS_REFRESH_MS);
    }
    handleHeartbeatSent() {
        void this.refresh();
    }
    async refresh() {
        if (!this.getConfig().statusBarEnabled) {
            this.item.hide();
            return;
        }
        try {
            const snapshot = await this.cli.getToday();
            this.item.text = `$(clock) ${snapshot.humanReadable}`;
            this.item.tooltip = `Today: ${snapshot.humanReadable}\nHeartbeats: ${snapshot.heartbeatCount}`;
            this.item.backgroundColor = undefined;
            this.item.command = "wakaclock.showToday";
            this.authFailureReported = false;
            this.item.show();
        }
        catch (error) {
            this.logger.warn("failed to refresh status bar", error);
            // A rejected key and an unreachable server both surfaced as the same neutral
            // "Wakaclock" label, so a key revoked or regenerated after setup looked like a
            // transient blip while every heartbeat silently went unrecorded. This refresh
            // already makes an authenticated request every minute, so it is the one place
            // that notices — it just has to say what it found.
            if (isAuthFailure(error)) {
                this.item.text = "$(warning) Wakaclock: key rejected";
                this.item.tooltip =
                    "The server rejected this API key, so coding time is not being recorded.\nRun \"Wakaclock: Set API Key\" with a fresh key from Settings → API key.";
                this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
                this.item.command = "wakaclock.setApiKey";
                this.item.show();
                this.reportAuthFailureOnce();
                return;
            }
            this.item.text = "$(clock) Wakaclock";
            this.item.tooltip = "Unable to read today's total from wakaclock-cli.";
            this.item.backgroundColor = undefined;
            this.item.command = "wakaclock.showToday";
            this.item.show();
        }
    }
    /**
     * Notify on the transition into the failed state only. The refresh runs every
     * minute, and a popup per tick would train the user to dismiss it on sight.
     */
    reportAuthFailureOnce() {
        if (this.authFailureReported) {
            return;
        }
        this.authFailureReported = true;
        void vscode.window
            .showErrorMessage("Wakaclock is not recording coding time: the server rejected your API key. Regenerating a key on the dashboard invalidates the previous one.", "Set API Key")
            .then((choice) => {
            if (choice === "Set API Key") {
                void vscode.commands.executeCommand("wakaclock.setApiKey");
            }
        });
    }
    applyVisibility() {
        if (this.getConfig().statusBarEnabled) {
            this.item.show();
            return;
        }
        this.item.hide();
    }
    dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.item.dispose();
    }
}
exports.StatusBarController = StatusBarController;
//# sourceMappingURL=statusBar.js.map