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
const externalFileObserver_1 = require("./externalFileObserver");
const clipboardTracking_1 = require("./clipboardTracking");
function registerEventSubscriptions(context, configService, bufferManager, logger) {
    let previousEditor = vscode.window.activeTextEditor;
    let timer = startFlushTimer();
    const clipboardTracker = new clipboardTracking_1.ClipboardActivityTracker();
    function workspaceProject(document) {
        if (!document) {
            return undefined;
        }
        return vscode.workspace.getWorkspaceFolder(document.uri)?.name;
    }
    // VS Code's document events cover typing inside the editor, but a file written by
    // Codex Desktop (or another process) may only produce an OS file-system event. Keep
    // a workspace-scoped receiver alive for that second path and feed it into the same
    // CLI/queue adapter used by the normal buffer.
    const externalFileObserver = new externalFileObserver_1.ExternalFileObserver((entity, metadata, now, project, workspaceRoot) => bufferManager.recordExternalFileChange(entity, metadata, now, project, workspaceRoot), (uri) => vscode.workspace.getWorkspaceFolder(uri)?.name, (uri) => vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath, logger);
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        externalFileObserver.watchWorkspace(folder.uri);
    }
    for (const document of vscode.workspace.textDocuments) {
        externalFileObserver.seedDocument(document);
    }
    context.subscriptions.push(externalFileObserver, vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.added)
            externalFileObserver.watchWorkspace(folder.uri);
        for (const folder of event.removed)
            externalFileObserver.unwatchWorkspace(folder.uri);
    }), vscode.workspace.onDidCloseTextDocument((document) => bufferManager.forgetDocument(document)), vscode.workspace.onDidChangeTextDocument((event) => {
        // The file watcher reports a second notification for many saves. Recording the
        // current in-memory fingerprint lets it suppress that duplicate while still
        // allowing an external writer with different bytes through.
        externalFileObserver.noteEditorChange(event.document.uri, safeDocumentText(event.document), event.document.isDirty);
        const activeSelection = vscode.window.activeTextEditor?.document.uri.toString() === event.document.uri.toString()
            ? vscode.window.activeTextEditor.selection
            : undefined;
        const paste = configService.getSnapshot().trackClipboardActions
            ? clipboardTracker.consumePaste(event.document, event.contentChanges, event.reason, Date.now())
            : undefined;
        void bufferManager.recordTextChange(event.document, event.contentChanges, activeSelection, Date.now(), workspaceProject(event.document), event.reason, paste);
    }), vscode.languages.registerDocumentPasteEditProvider({ scheme: "file" }, {
        prepareDocumentPaste(document, ranges, dataTransfer) {
            if (!configService.getSnapshot().trackClipboardActions) {
                return;
            }
            const workspace = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
            const prepared = clipboardTracker.prepareCopy(document, ranges, workspace);
            dataTransfer.set(clipboardTracking_1.ATOAXIS_CLIPBOARD_MIME, new vscode.DataTransferItem(prepared.token));
            void bufferManager.recordClipboardCopy(document, prepared.metrics, Date.now(), workspaceProject(document));
        },
        async provideDocumentPasteEdits(document, ranges, dataTransfer) {
            if (!configService.getSnapshot().trackClipboardActions) {
                return undefined;
            }
            const tokenItem = dataTransfer.get(clipboardTracking_1.ATOAXIS_CLIPBOARD_MIME);
            const token = tokenItem ? await tokenItem.asString() : undefined;
            const workspace = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
            clipboardTracker.preparePaste(document, ranges, workspace, token);
            return undefined;
        }
    }, {
        providedPasteEditKinds: [],
        copyMimeTypes: [clipboardTracking_1.ATOAXIS_CLIPBOARD_MIME],
        pasteMimeTypes: [clipboardTracking_1.ATOAXIS_CLIPBOARD_MIME, "text/plain"]
    }), vscode.workspace.onDidSaveTextDocument((document) => {
        externalFileObserver.noteEditorChange(document.uri, safeDocumentText(document), document.isDirty);
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
function safeDocumentText(document) {
    try {
        return document.getText();
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=events.js.map