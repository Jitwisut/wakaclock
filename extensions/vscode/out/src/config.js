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
        return {
            cliPath: this.resolveCliPath(config),
            flushIntervalMs: Math.max(5, config.get("flushIntervalSeconds", 30)) * 1000,
            sameFileHeartbeatMs: Math.max(1, config.get("sameFileHeartbeatMinutes", 2)) * 60 * 1000,
            idleMs: Math.max(1, config.get("idleMinutes", 5)) * 60 * 1000,
            statusBarEnabled: config.get("statusBarEnabled", true),
            debugLogging: config.get("debugLogging", false),
            trackDebugSessions: config.get("trackDebugSessions", true),
            trackBuildTasks: config.get("trackBuildTasks", true)
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
        const configuredPath = config.get("cliPath", "").trim();
        return configuredPath || "wakaclock-cli";
    }
}
exports.WakaclockConfigService = WakaclockConfigService;
//# sourceMappingURL=config.js.map