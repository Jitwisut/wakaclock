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
    let keystrokes = 0;
    let linesAdded = 0;
    let linesDeleted = 0;
    for (const change of changes) {
        charsAdded += change.text.length;
        charsDeleted += change.rangeLength;
        keystrokes += Math.max(change.text.length, change.rangeLength, 1);
        linesAdded += countChangedLines(change.text);
        if (change.range) {
            linesDeleted += Math.max(0, change.range.end.line - change.range.start.line);
        }
    }
    return { charsAdded, charsDeleted, keystrokes, linesAdded, linesDeleted };
}
/** Count logical lines in inserted text without sending source content anywhere. */
function countChangedLines(text) {
    if (!text) {
        return 0;
    }
    const newlineCount = (text.match(/\n/g) ?? []).length;
    if (newlineCount > 0) {
        return newlineCount + (text.endsWith("\n") ? 0 : 1);
    }
    // VS Code reports ordinary typing one character at a time. Counting every such
    // event as a new line would turn a 40-character line into 40 human lines. A multi-
    // character paste/AI insertion is still represented as one changed line when it
    // has no newline boundary.
    return text.length > 1 ? 1 : 0;
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