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
class StatusBarController {
    getConfig;
    cli;
    logger;
    item;
    interval;
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
            this.item.show();
        }
        catch (error) {
            this.logger.warn("failed to refresh status bar", error);
            this.item.text = "$(clock) Wakaclock";
            this.item.tooltip = "Unable to read today's total from wakaclock-cli.";
            this.item.show();
        }
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