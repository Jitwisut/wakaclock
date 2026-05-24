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
const buffer_1 = require("./buffer");
const cli_1 = require("./cli");
const commands_1 = require("./commands");
const config_1 = require("./config");
const events_1 = require("./events");
const logging_1 = require("./logging");
const statusBar_1 = require("./statusBar");
function activate(context) {
    console.log("[wakaclock] extension activated");
    const configService = new config_1.WakaclockConfigService();
    const logger = new logging_1.Logger(() => configService.getSnapshot().debugLogging);
    const cliService = new cli_1.WakaclockCliService(() => configService.getSnapshot(), logger);
    const statusBar = new statusBar_1.StatusBarController(() => configService.getSnapshot(), cliService, logger);
    const bufferManager = new buffer_1.HeartbeatBufferManager(() => configService.getSnapshot(), cliService, logger, () => statusBar.handleHeartbeatSent());
    context.subscriptions.push(configService, statusBar);
    statusBar.start();
    (0, commands_1.registerCommands)(context, configService, cliService, bufferManager, statusBar);
    (0, events_1.registerEventSubscriptions)(context, configService, bufferManager, logger);
    void vscode.commands.executeCommand("setContext", "wakaclock.enabled", true);
    logger.debug("wakaclock extension activated");
}
function deactivate() {
    // VS Code disposes subscriptions registered during activation.
}
//# sourceMappingURL=extension.js.map