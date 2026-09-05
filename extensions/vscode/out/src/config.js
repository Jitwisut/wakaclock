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
exports.WakaclockConfigService = void 0;
const vscode = __importStar(require("vscode"));
const SECTION = "wakaclock";
const PRODUCTION_SERVER_URL = "https://api.atoaxis.com";
class WakaclockConfigService {
    emitter = new vscode.EventEmitter();
    configChangeSubscription;
    constructor() {
        this.configChangeSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration(SECTION)) {
                return;
            }
            this.emitter.fire(this.getSnapshot());
        });
    }
    get onDidChange() {
        return this.emitter.event;
    }
    getSnapshot() {
        const config = vscode.workspace.getConfiguration(SECTION);
        const configuredRate = config.inspect("heartbeatRateLimitSeconds");
        const legacyRate = config.get("sameFileHeartbeatMinutes", 2) * 60;
        const heartbeatRateSeconds = configuredRate?.globalValue === undefined &&
            configuredRate?.workspaceValue === undefined &&
            configuredRate?.workspaceFolderValue === undefined
            ? legacyRate
            : config.get("heartbeatRateLimitSeconds", 120);
        return {
            cliPath: this.resolveCliPath(config),
            serverUrl: this.resolveServerUrl(config),
            flushIntervalMs: Math.max(5, config.get("flushIntervalSeconds", 30)) * 1000,
            heartbeatRateLimitMs: Math.max(30, heartbeatRateSeconds) * 1000,
            sameFileHeartbeatMs: Math.max(1, config.get("sameFileHeartbeatMinutes", 2)) * 60 * 1000,
            // Kept in the snapshot for backwards-compatible consumers, but the timing engine
            // intentionally ignores it: all clients use the fixed strict 120-second gap.
            idleMs: Math.max(1, config.get("idleMinutes", 15)) * 60 * 1000,
            statusBarEnabled: config.get("statusBarEnabled", true),
            debugLogging: config.get("debugLogging", false),
            trackDebugSessions: config.get("trackDebugSessions", true),
            trackBuildTasks: config.get("trackBuildTasks", true),
            trackClipboardActions: config.get("trackClipboardActions", true),
            autoInstallAgentHooks: config.get("autoInstallAgentHooks", true)
        };
    }
    async updateSetting(key, value) {
        const config = vscode.workspace.getConfiguration(SECTION);
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
    dispose() {
        this.configChangeSubscription.dispose();
        this.emitter.dispose();
    }
    resolveCliPath(config) {
        // cliPath is intentionally a global-only emergency/development override. A
        // repository's .vscode/settings.json must not be able to replace the executable
        // that receives a user's API key.
        const configuredPath = config.inspect("cliPath")?.globalValue;
        return typeof configuredPath === "string" ? configuredPath.trim() : "";
    }
    resolveServerUrl(config) {
        const configured = config.inspect("serverUrl")?.globalValue;
        if (typeof configured !== "string" || !configured.trim()) {
            return PRODUCTION_SERVER_URL;
        }
        const value = configured.trim().replace(/\/+$/, "");
        try {
            const parsed = new URL(value);
            const loopback = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
            if (!['https:', 'http:'].includes(parsed.protocol)) {
                return PRODUCTION_SERVER_URL;
            }
            if (parsed.protocol === "http:" && !loopback.has(parsed.hostname)) {
                return PRODUCTION_SERVER_URL;
            }
            if ((parsed.pathname !== "/" && parsed.pathname !== "") ||
                parsed.search ||
                parsed.hash ||
                parsed.username ||
                parsed.password) {
                return PRODUCTION_SERVER_URL;
            }
            return value;
        }
        catch {
            return PRODUCTION_SERVER_URL;
        }
    }
}
exports.WakaclockConfigService = WakaclockConfigService;
//# sourceMappingURL=config.js.map