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
exports.registerEventSubscriptions = registerEventSubscriptions;
const vscode = __importStar(require("vscode"));
function registerEventSubscriptions(context, configService, bufferManager, logger) {
    let previousEditor = vscode.window.activeTextEditor;
    let timer = startFlushTimer();
    function workspaceProject(document) {
        if (!document) {
            return undefined;
        }
        return vscode.workspace.getWorkspaceFolder(document.uri)?.name;
    }
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
        const activeSelection = vscode.window.activeTextEditor?.document.uri.toString() === event.document.uri.toString()
            ? vscode.window.activeTextEditor.selection
            : undefined;
        void bufferManager.recordTextChange(event.document, event.contentChanges, activeSelection, Date.now(), workspaceProject(event.document));
    }), vscode.workspace.onDidSaveTextDocument((document) => {
        void bufferManager.recordSave(document, Date.now(), workspaceProject(document));
    }), vscode.window.onDidChangeActiveTextEditor((editor) => {
        const now = Date.now();
        // Observe the new editor first: that closes the previous file's WakaTime-style
        // interval before its buffer is flushed, avoiding a race that could discard the
        // time between the last edit and the editor switch.
        if (editor) {
            bufferManager.updateCursor(editor.document, editor.selection, workspaceProject(editor.document), now);
        }
        void bufferManager.recordEditorSwitch(previousEditor ?? undefined, editor ?? undefined, now);
        previousEditor = editor;
    }), 
    // Losing focus is the last moment the editor can prove the developer was here.
    // Without this the buffered tail of a session sat unflushed until the next edit —
    // which, if the session simply ended, never came.
    vscode.window.onDidChangeWindowState((windowState) => {
        if (windowState.focused) {
            return;
        }
        void bufferManager.flushDueBuffers("focus-lost");
    }), vscode.window.onDidChangeTextEditorSelection((event) => {
        bufferManager.updateCursor(event.textEditor.document, event.selections[0], workspaceProject(event.textEditor.document), Date.now());
    }), vscode.debug.onDidStartDebugSession(() => {
        if (!configService.getSnapshot().trackDebugSessions) {
            return;
        }
        void bufferManager.flushCurrentEditor(vscode.window.activeTextEditor, "debug-start", {
            category: "debugging",
            force: true
        }, workspaceProject(vscode.window.activeTextEditor?.document));
    }), vscode.debug.onDidTerminateDebugSession(() => {
        if (!configService.getSnapshot().trackDebugSessions) {
            return;
        }
        void bufferManager.flushCurrentEditor(vscode.window.activeTextEditor, "debug-stop", {
            category: "debugging",
            force: true
        }, workspaceProject(vscode.window.activeTextEditor?.document));
    }), vscode.tasks.onDidStartTaskProcess(() => {
        if (!configService.getSnapshot().trackBuildTasks) {
            return;
        }
        void bufferManager.flushCurrentEditor(vscode.window.activeTextEditor, "build-start", {
            category: "building",
            force: true
        }, workspaceProject(vscode.window.activeTextEditor?.document));
    }), vscode.tasks.onDidEndTaskProcess(() => {
        if (!configService.getSnapshot().trackBuildTasks) {
            return;
        }
        void bufferManager.flushCurrentEditor(vscode.window.activeTextEditor, "build-stop", {
            category: "building",
            force: true
        }, workspaceProject(vscode.window.activeTextEditor?.document));
    }), configService.onDidChange(() => {
        logger.debug("wakaclock config changed, restarting flush timer");
        clearInterval(timer);
        timer = startFlushTimer();
    }), {
        dispose: () => {
            clearInterval(timer);
            // VS Code shutdown: flush what is already measured instead of discarding it.
            void bufferManager.flushDueBuffers("shutdown");
        }
    });
    // Emit an initial marker for the editor that was already active when the extension
    // started. Without this, opening VS Code into an existing file produced no heartbeat
    // until the first text edit or cursor movement.
    if (previousEditor) {
        void bufferManager.recordEditorSwitch(undefined, previousEditor, Date.now());
    }
    function startFlushTimer() {
        return setInterval(() => {
            void bufferManager.flushDueBuffers("timer");
        }, configService.getSnapshot().flushIntervalMs);
    }
}
//# sourceMappingURL=events.js.map