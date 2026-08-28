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
const activity_1 = require("./activity");
const STATUS_REFRESH_MS = 15_000;
function localTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }
    catch {
        return "UTC";
    }
}
function formatLiveDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}
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
    getApiKey;
    item;
    interval;
    authFailureReported = false;
    deliveryFailureReported = false;
    legacyCliReported = false;
    lastSnapshot;
    getBufferedSeconds = () => 0;
    getBufferedSegments = () => [];
    connectionState = "connecting";
    constructor(getConfig, cli, logger, getApiKey) {
        this.getConfig = getConfig;
        this.cli = cli;
        this.logger = logger;
        this.getApiKey = getApiKey;
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = "wakaclock.showToday";
        this.item.name = "Wakaclock";
    }
    setBufferedSecondsProvider(provider) {
        this.getBufferedSeconds = provider;
    }
    setBufferedSegmentsProvider(provider) {
        this.getBufferedSegments = provider;
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
    /** Repaint locally accumulated activity without making a network request. */
    handleActivity() {
        if (this.lastSnapshot) {
            this.render(this.lastSnapshot);
            return;
        }
        void this.refresh();
    }
    setConnectionState(state) {
        this.connectionState = state;
        if (state === "needs-api-key") {
            this.item.text = "$(plug) AtoAxis: Connect";
            this.item.tooltip = "Add an AtoAxis API key to start recording coding time.";
            this.item.command = "wakaclock.setApiKey";
            this.item.backgroundColor = undefined;
            this.item.show();
            return;
        }
        if (state === "connecting") {
            this.item.text = "$(sync~spin) AtoAxis: Connecting";
            this.item.tooltip = "Checking the AtoAxis server connection…";
            this.item.command = "wakaclock.setApiKey";
            this.item.show();
        }
    }
    async refresh() {
        if (!this.getConfig().statusBarEnabled) {
            this.item.hide();
            return;
        }
        if (this.getApiKey) {
            const key = await this.getApiKey();
            if (!key) {
                this.setConnectionState("needs-api-key");
                return;
            }
        }
        try {
            const snapshot = await this.cli.getToday(localTimezone());
            this.lastSnapshot = snapshot;
            // A refusal is not an outage and must not be reported as one. Reading today's
            // total is a GET and keeps working while POST /heartbeats returns 402, so this
            // branch is the *success* path even when nothing is being recorded — which is
            // exactly how an expired trial spent a day and a half looking like an idle one.
            // `queuedSeconds` cannot catch it either: it is scoped to today, so yesterday's
            // refused backlog reads zero.
            const refused = snapshot.delivery?.startsWith("REFUSED") ?? false;
            const backlog = snapshot.queuedHeartbeats ?? 0;
            this.connectionState = refused
                ? "subscription-required"
                : (snapshot.queuedSeconds && snapshot.queuedSeconds > 0) || backlog > 0
                    ? "offline-queued"
                    : "verified";
            if (refused && !this.deliveryFailureReported) {
                this.deliveryFailureReported = true;
                void vscode.window.showWarningMessage(`AtoAxis is not recording your time: ${snapshot.delivery}. ` +
                    `${backlog} heartbeat(s) are held locally and will be sent once the server accepts them.`);
            }
            if (!refused) {
                this.deliveryFailureReported = false;
            }
            this.render(snapshot);
            if (snapshot.legacyCli && !this.legacyCliReported) {
                this.legacyCliReported = true;
                void vscode.window.showWarningMessage("wakaclock-cli is too old for timezone-aware status totals. Upgrade the CLI to the current workspace version.");
            }
            this.item.backgroundColor = refused
                ? new vscode.ThemeColor("statusBarItem.warningBackground")
                : undefined;
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
                this.connectionState = /subscription|402/i.test(error instanceof Error ? error.message : String(error))
                    ? "subscription-required"
                    : "needs-api-key";
                this.item.show();
                this.reportAuthFailureOnce();
                return;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (/subscription|required.*plan|402/.test(errorMessage.toLowerCase())) {
                this.connectionState = "subscription-required";
                this.item.text = "$(warning) AtoAxis: Subscription required";
                this.item.tooltip =
                    "Your API key is valid, but this account needs an active AtoAxis subscription.";
                this.item.command = "wakaclock.setApiKey";
                this.item.show();
                return;
            }
            this.item.text = "$(clock) Wakaclock";
            const message = errorMessage;
            const cliUnavailable = /bundled.*cli|cli.*unavailable|unsupported.*platform/i.test(message);
            this.connectionState = cliUnavailable ? "cli-unavailable" : "offline-queued";
            this.item.text = cliUnavailable ? "$(error) AtoAxis: CLI unavailable" : "$(clock) Wakaclock";
            this.item.tooltip = cliUnavailable
                ? `${message}\nReinstall the platform-specific AtoAxis Extension or use the advanced cliPath override.`
                : "Unable to read today's total from the AtoAxis server; activity remains queued locally.";
            this.item.backgroundColor = undefined;
            this.item.command = "wakaclock.showToday";
            this.item.show();
            this.connectionState = "offline-queued";
        }
    }
    render(snapshot) {
        const bufferedSeconds = Math.max(this.getBufferedSeconds(), snapshot.bufferedSeconds ?? 0);
        const queued = snapshot.queuedSeconds ?? 0;
        const confirmed = snapshot.confirmedSeconds ?? Math.max(0, snapshot.totalSeconds - queued);
        const bufferedSegments = this.getBufferedSegments();
        const serverIntervals = snapshot.coveredIntervals ?? [];
        const totalSeconds = serverIntervals.length > 0
            ? (0, activity_1.unionSeconds)([...serverIntervals, ...bufferedSegments])
            : confirmed + queued + bufferedSeconds;
        const humanReadable = formatLiveDuration(totalSeconds);
        const agentState = snapshot.agentHealth &&
            typeof snapshot.agentHealth === "object" &&
            "state" in snapshot.agentHealth
            ? String(snapshot.agentHealth.state)
            : undefined;
        if (this.connectionState === "needs-api-key") {
            this.item.text = "$(plug) AtoAxis: Connect";
            this.item.command = "wakaclock.setApiKey";
        }
        else if (this.connectionState === "subscription-required") {
            this.item.text = `$(warning) AtoAxis: ${humanReadable}`;
            this.item.command = "wakaclock.setApiKey";
        }
        else if (this.connectionState === "offline-queued") {
            this.item.text = `$(cloud-offline) AtoAxis: ${humanReadable}`;
        }
        else {
            this.item.text = `$(clock) ${humanReadable}`;
        }
        this.item.tooltip =
            `Today: ${humanReadable}\nHeartbeats: ${snapshot.heartbeatCount}` +
                `\nConfirmed: ${formatLiveDuration(confirmed)}` +
                `\nOffline queued: ${formatLiveDuration(queued)}` +
                `\nLocal buffer: ${formatLiveDuration(bufferedSeconds)}` +
                (snapshot.lastIncrementSeconds === undefined
                    ? ""
                    : `\nLast increment: ${formatLiveDuration(snapshot.lastIncrementSeconds)}${snapshot.lastIncrementSource ? ` (${snapshot.lastIncrementSource})` : ""}`) +
                (snapshot.discardedSeconds && snapshot.discardedSeconds > 0
                    ? `\nDiscarded overlap/idle: ${formatLiveDuration(snapshot.discardedSeconds)}`
                    : "") +
                (snapshot.queuedHeartbeats
                    ? `\nHeld locally: ${snapshot.queuedHeartbeats} heartbeat(s)`
                    : "") +
                (snapshot.delivery ? `\nDelivery: ${snapshot.delivery}` : "") +
                (agentState ? `\nAgent: ${agentState}` : "");
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