"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localTimezone = localTimezone;
exports.normalizeFsPath = normalizeFsPath;
exports.isFileDocument = isFileDocument;
exports.getEditorEntity = getEditorEntity;
exports.summarizeTextChanges = summarizeTextChanges;
exports.getSelectionMetrics = getSelectionMetrics;
/**
 * The IANA timezone the CLI must scope "today" to. Every caller that reads or
 * displays today's total has to pass the *same* value — the status bar and the
 * "Show Today" command disagreed on the day boundary when only one of them did.
 */
function localTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }
    catch {
        return "UTC";
    }
}
function normalizeFsPath(fsPath) {
    return fsPath.replace(/\\/g, "/");
}
function isFileDocument(document) {
    return document.uri.scheme === "file";
}
function getEditorEntity(editor) {
    if (!editor || !isFileDocument(editor.document)) {
        return undefined;
    }
    return normalizeFsPath(editor.document.uri.fsPath);
}
function summarizeTextChanges(changes) {
    let charsAdded = 0;
    let charsDeleted = 0;
    let insertedTextLines = 0;
    for (const change of changes) {
        charsAdded += change.text.length;
        charsDeleted += change.rangeLength;
        if (change.text) {
            insertedTextLines += change.text.split("\n").length - (change.text.endsWith("\n") ? 1 : 0);
        }
    }
    return { charsAdded, charsDeleted, insertedTextLines };
}
function getSelectionMetrics(selection) {
    if (!selection) {
        return {};
    }
    return {
        lineNumber: selection.active.line + 1,
        cursorPosition: selection.active.character + 1
    };
}
//# sourceMappingURL=utils.js.map