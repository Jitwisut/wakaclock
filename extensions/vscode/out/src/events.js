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
const clipboardTracking_1 = require("./clipboardTracking");
const externalFileObserver_1 = require("./externalFileObserver");
function registerEventSubscriptions(context, configService, bufferManager, logger) {
    let previousEditor = vscode.window.activeTextEditor;
    let timer = startFlushTimer();
    const clipboardTracker = new clipboardTracking_1.ClipboardActivityTracker();
    function workspaceProject(document) {
        if (!document) {
            return undefined;
        }
        return workspaceProjectForUri(document.uri);
    }
    function workspaceProjectForUri(uri) {
        return vscode.workspace.getWorkspaceFolder(uri)?.name;
    }
    const externalFileObserver = new externalFileObserver_1.ExternalFileObserver((entity, metadata, now, project, workspaceRoot) => bufferManager.recordExternalFileChange(entity, metadata, now, project, workspaceRoot), (uri) => workspaceProjectForUri(uri), (uri) => vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath, logger);
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        externalFileObserver.watchWorkspace(folder.uri);
    }
    for (const document of vscode.workspace.textDocuments) {
        externalFileObserver.seedDocument(document);
    }
    context.subscriptions.push(externalFileObserver, vscode.workspace.onDidChangeTextDocument((event) => {
        // A dirty document change is caused by an edit inside VS Code. External
        // reloads arrive with `isDirty === false`; leaving those unsuppressed is
        // what lets the watcher prove that an AI process changed the file.
        if (event.document.isDirty) {
            externalFileObserver.noteEditorChange(event.document.uri, safeDocumentText(event.document), true);
        }
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
        externalFileObserver.noteEditorChange(document.uri, safeDocumentText(document), false);
        void bufferManager.recordSave(document, Date.now(), workspaceProject(document));
    }), vscode.workspace.onDidRenameFiles((event) => {
        for (const file of event.files) {
            void externalFileObserver.observeRename(file.oldUri, file.newUri);
        }
    }), vscode.workspace.onDidCloseTextDocument((document) => {
        bufferManager.forgetDocument(document);
    }), vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.added) {
            externalFileObserver.watchWorkspace(folder.uri);
        }
        for (const folder of event.removed) {
            externalFileObserver.unwatchWorkspace(folder.uri);
        }
    }), vscode.window.onDidChangeActiveTextEditor((editor) => {
        const now = Date.now();
        // The switch method records and flushes the new editor's presence itself. Calling
        // updateCursor first would race two zero-duration heartbeats for one switch.
        void bufferManager.recordEditorSwitch(previousEditor ?? undefined, editor ?? undefined, now, workspaceProject(editor?.document));
        previousEditor = editor;
    }), 
    // Losing focus is the last moment the editor can prove the developer was here.
    // Without this the buffered tail of a session sat unflushed until the next edit —
    // which, if the session simply ended, never came.
    vscode.window.onDidChangeWindowState((windowState) => {
        if (windowState.focused) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                void bufferManager.updateCursor(editor.document, editor.selection, workspaceProject(editor.document), Date.now());
            }
            return;
        }
        void bufferManager.flushDueBuffers("focus-lost");
    }), vscode.window.onDidChangeTextEditorSelection((event) => {
        void bufferManager.updateCursor(event.textEditor.document, event.selections[0], workspaceProject(event.textEditor.document), Date.now());
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
        void bufferManager.recordEditorSwitch(undefined, previousEditor, Date.now(), workspaceProject(previousEditor.document));
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