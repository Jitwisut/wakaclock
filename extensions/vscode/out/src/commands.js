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
function registerCommands(context, configService, cliService, bufferManager, statusBar) {
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
    }));
}
//# sourceMappingURL=commands.js.map