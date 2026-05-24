"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFsPath = normalizeFsPath;
exports.isFileDocument = isFileDocument;
exports.getEditorEntity = getEditorEntity;
exports.summarizeTextChanges = summarizeTextChanges;
exports.getSelectionMetrics = getSelectionMetrics;
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
    let keystrokes = 0;
    for (const change of changes) {
        charsAdded += change.text.length;
        charsDeleted += change.rangeLength;
        keystrokes += Math.max(change.text.length, change.rangeLength, 1);
    }
    return { charsAdded, charsDeleted, keystrokes };
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