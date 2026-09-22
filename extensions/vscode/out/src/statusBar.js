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
const singleFlight_1 = require("./singleFlight");
const utils_1 = require("./utils");
const STATUS_REFRESH_MS = 15_000;
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
/**
 * Server state for a CLI that predates `connection` in `today --json`. Only the
 * CLI's own delivery verdict and explicit HTTP status shapes are read; an old CLI
 * printed "REFUSED" for a connection failure too, so anything that is not a proven
 * 401/402 refusal is treated as offline rather than as a subscription problem.
 */
function legacyServerState(snapshot) {
    const delivery = snapshot.delivery;
    if (!delivery) {
        return undefined;
    }
    if (delivery.startsWith("RETRYING")) {
        return "retryable_server_error";
    }
    if (!delivery.startsWith("REFUSED")) {
        return "offline";
    }
    if (/HTTP status 40[13]\b|API key was rejected|authentication failed/i.test(delivery)) {
        return "auth_rejected";
    }
    if (/HTTP status 402\b|trial expired|subscription inactive/i.test(delivery)) {
        return "subscription_required";
    }
    return "offline";
}
/** Map the server state to what the status bar shows. Queue depth is supporting
 *  detail: it never turns an online server into "offline" or the reverse. */
function uiStateFor(server, queued) {
    switch (server) {
        case "offline":
            return queued ? "offline-queued" : "offline";
        case "auth_rejected":
            return "key-rejected";
        case "subscription_required":
            return "subscription-required";
        case "retryable_server_error":
            return "service-degraded";
        case "online":
        case "validation_rejected":
        case "unknown_error":
            return "verified";
        default:
            // Legacy CLI without a verdict: the historical queue heuristic.
            return queued ? "offline-queued" : "verified";
    }
}
function availableNumber(measurement) {
    return measurement?.availability === "available" && typeof measurement.value === "number"
        ? measurement.value
        : undefined;
}
function epochSecondsToIso(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return undefined;
    return new Date(value * 1000).toISOString();
}
function summarizeAdapterCoverage(snapshot) {
    const detected = snapshot.adapters.filter((adapter) => adapter.detected.availability === "available" && adapter.detected.value === true);
    const enabled = detected.filter((adapter) => adapter.enabled.availability === "available" && adapter.enabled.value === true);
    const verified = enabled.filter((adapter) => adapter.verification === "verified");
    const verification = verified.length > 0 ? ` · ${verified.length} verified` : "";
    return `${enabled.length}/${detected.length} detected adapters enabled${verification}`;
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
    lastBrokerStatus;
    lastAiDiagnostics;
    getBufferedSeconds = () => 0;
    getBufferedSegments = () => [];
    connectionState = "connecting";
    /** One refresh at a time, with at most one queued follow-up (OFF-07). */
    inFlight = new singleFlight_1.SingleFlight();
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
            // A tick during a slow refresh queues one follow-up instead of spawning
            // another CLI process.
            void this.refresh();
        }, STATUS_REFRESH_MS);
    }
    /**
     * The API key, server URL or timezone changed: results still in flight
     * describe the old scope and must not be applied.
     */
    invalidateScope() {
        this.inFlight.invalidate();
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
        await this.inFlight.run(() => this.refreshOnce());
    }
    async refreshOnce() {
        if (!this.getConfig().statusBarEnabled) {
            this.item.hide();
            return;
        }
        // Everything read after this point belongs to this scope; a key change
        // while the CLI runs makes the result stale.
        const generation = this.inFlight.current();
        if (this.getApiKey) {
            const key = await this.getApiKey();
            if (!key) {
                this.setConnectionState("needs-api-key");
                return;
            }
        }
        // On-demand sync status is local and remains useful while the hosted API is
        // offline. Older embedded CLI adapters may not expose it, so this is additive.
        await this.refreshAiStatus();
        try {
            const snapshot = await this.cli.getToday((0, utils_1.localTimezone)());
            if (!this.inFlight.isCurrent(generation)) {
                this.logger.debug("discarded a status result from a previous scope");
                return;
            }
            this.lastSnapshot = snapshot;
            // Reading today's total is a GET and keeps working while POST /heartbeats is
            // refused, so a refusal arrives on this success path. The CLI's typed
            // `connection.state` decides what it means; a network outage is never shown
            // as a subscription problem.
            const backlog = snapshot.queuedHeartbeats ?? 0;
            const queued = (snapshot.queuedSeconds ?? 0) > 0 || backlog > 0;
            const server = snapshot.connection?.state ?? legacyServerState(snapshot);
            this.connectionState = uiStateFor(server, queued);
            const subscription = this.connectionState === "subscription-required";
            const keyRejected = this.connectionState === "key-rejected";
            if (subscription && !this.deliveryFailureReported) {
                this.deliveryFailureReported = true;
                void vscode.window.showWarningMessage(`AtoAxis is not recording your time: ${snapshot.delivery ?? "the account needs an active subscription"}. ` +
                    `${backlog} heartbeat(s) are held locally and will be sent once the server accepts them.`);
            }
            if (!subscription) {
                this.deliveryFailureReported = false;
            }
            this.render(snapshot);
            if (snapshot.legacyCli && !this.legacyCliReported) {
                this.legacyCliReported = true;
                void vscode.window.showWarningMessage("wakaclock-cli is too old for timezone-aware status totals. Upgrade the CLI to the current workspace version.");
            }
            this.item.backgroundColor =
                subscription || keyRejected
                    ? new vscode.ThemeColor("statusBarItem.warningBackground")
                    : undefined;
            this.item.command = keyRejected ? "wakaclock.setApiKey" : "wakaclock.showToday";
            if (keyRejected) {
                this.reportAuthFailureOnce();
            }
            else {
                this.authFailureReported = false;
            }
            this.item.show();
        }
        catch (error) {
            if (!this.inFlight.isCurrent(generation)) {
                this.logger.debug("discarded a status failure from a previous scope");
                return;
            }
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
                this.connectionState = "key-rejected";
                this.item.show();
                this.reportAuthFailureOnce();
                return;
            }
            const message = error instanceof Error ? error.message : String(error);
            const cliUnavailable = /bundled.*cli|cli.*unavailable|unsupported.*platform/i.test(message);
            this.connectionState = cliUnavailable ? "cli-unavailable" : "offline";
            this.item.text = cliUnavailable ? "$(error) AtoAxis: CLI unavailable" : "$(clock) Wakaclock";
            this.item.tooltip = cliUnavailable
                ? `${message}\nReinstall the platform-specific AtoAxis Extension or use the advanced cliPath override.`
                : "Unable to read today's total from the AtoAxis server; activity remains queued locally.";
            this.item.backgroundColor = undefined;
            this.item.command = "wakaclock.showToday";
            this.item.show();
        }
    }
    render(snapshot) {
        // Keep the number shown in the status bar on the same contract as the
        // `Show Today` command and the dashboard: `snapshot.totalSeconds` is the
        // CLI's authoritative total for this timezone/day. Local editor activity
        // has not been accepted by the CLI yet, so it belongs in the tooltip as a
        // pending amount rather than silently changing the meaning of "Today".
        const bufferedSeconds = Math.max(this.getBufferedSeconds(), (0, activity_1.unionSeconds)(this.getBufferedSegments()), snapshot.bufferedSeconds ?? 0);
        const queued = snapshot.queuedSeconds ?? 0;
        const confirmed = snapshot.confirmedSeconds ?? Math.max(0, snapshot.totalSeconds - queued);
        const totalSeconds = Math.max(0, snapshot.totalSeconds ?? 0);
        const humanReadable = formatLiveDuration(totalSeconds);
        const agentState = snapshot.agentHealth &&
            typeof snapshot.agentHealth === "object" &&
            "state" in snapshot.agentHealth
            ? String(snapshot.agentHealth.state)
            : undefined;
        const brokerState = this.lastAiDiagnostics
            ? `on-demand · pending ${availableNumber(this.lastAiDiagnostics.broker.pending) ?? "unknown"} · retry ${availableNumber(this.lastAiDiagnostics.broker.retry) ?? "unknown"} · dead-letter ${availableNumber(this.lastAiDiagnostics.broker.dead_letter) ?? "unknown"}`
            : this.lastBrokerStatus
                ? `on-demand · pending ${this.lastBrokerStatus.inbox?.pending ?? 0} · retry ${this.lastBrokerStatus.inbox?.retry ?? 0} · dead-letter ${this.lastBrokerStatus.inbox?.dead_letter ?? 0}`
                : undefined;
        const lastSyncAt = this.lastAiDiagnostics?.broker.last_delivery_at ??
            epochSecondsToIso(this.lastBrokerStatus?.last_delivery_at ??
                this.lastBrokerStatus?.last_processed_at ??
                this.lastBrokerStatus?.last_received_at);
        const adapterCoverage = this.lastAiDiagnostics
            ? summarizeAdapterCoverage(this.lastAiDiagnostics)
            : undefined;
        const brokerError = this.lastBrokerStatus?.inbox?.last_error_message;
        if (this.connectionState === "needs-api-key") {
            this.item.text = "$(plug) AtoAxis: Connect";
            this.item.command = "wakaclock.setApiKey";
        }
        else if (this.connectionState === "key-rejected") {
            this.item.text = "$(warning) Wakaclock: key rejected";
            this.item.command = "wakaclock.setApiKey";
        }
        else if (this.connectionState === "subscription-required") {
            this.item.text = `$(warning) AtoAxis: ${humanReadable}`;
            this.item.command = "wakaclock.setApiKey";
        }
        else if (this.connectionState === "offline" ||
            this.connectionState === "offline-queued" ||
            this.connectionState === "service-degraded") {
            this.item.text = `$(cloud-offline) AtoAxis: ${humanReadable}`;
        }
        else {
            this.item.text = `$(clock) ${humanReadable}`;
        }
        const stateLine = this.connectionState === "offline" || this.connectionState === "offline-queued"
            ? "Offline: the AtoAxis server is unreachable; activity stays queued locally.\n"
            : this.connectionState === "service-degraded"
                ? "Service degraded: the AtoAxis server asked to retry later; activity stays queued locally.\n"
                : this.connectionState === "key-rejected"
                    ? "The server rejected this API key, so coding time is not being recorded.\nRun \"Wakaclock: Set API Key\" with a fresh key from Settings → API key.\n"
                    : this.connectionState === "subscription-required"
                        ? "Your API key is valid, but this account needs an active AtoAxis subscription.\n"
                        : "";
        this.item.tooltip =
            stateLine +
                `Today: ${humanReadable}\nHeartbeats: ${snapshot.heartbeatCount}` +
                `\nConfirmed: ${formatLiveDuration(confirmed)}` +
                `\nOffline queued: ${formatLiveDuration(queued)}` +
                `\nLocal pending: ${formatLiveDuration(bufferedSeconds)}` +
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
                (agentState ? `\nAgent: ${agentState}` : "") +
                (brokerState ? `\nAI sync: ${brokerState}` : "") +
                (brokerState ? `\nAI last sync: ${lastSyncAt ?? "never"}` : "") +
                (adapterCoverage ? `\nAI adapter coverage: ${adapterCoverage}` : "") +
                (brokerError ? `\nAI sync last error: ${brokerError}` : "");
    }
    async refreshAiStatus() {
        if (this.cli.getAiDiagnosticsSnapshot) {
            try {
                this.lastAiDiagnostics = await this.cli.getAiDiagnosticsSnapshot();
                this.lastBrokerStatus = undefined;
                return;
            }
            catch (error) {
                this.lastAiDiagnostics = undefined;
                this.logger.debug("failed to read AI diagnostics status", {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        if (!this.cli.getBrokerStatus)
            return;
        try {
            this.lastBrokerStatus = await this.cli.getBrokerStatus();
        }
        catch (error) {
            this.logger.debug("failed to read local broker status", {
                error: error instanceof Error ? error.message : String(error),
            });
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
            this.interval = undefined;
        }
        // Anything still running resolves into a disposed controller; its result is
        // dropped rather than repainting an item that is going away.
        this.inFlight.dispose();
        this.item.dispose();
    }
}
exports.StatusBarController = StatusBarController;
//# sourceMappingURL=statusBar.js.map