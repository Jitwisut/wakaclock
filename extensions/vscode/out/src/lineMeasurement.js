"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDITOR_LINE_METRIC_VERSION = void 0;
exports.measureLineDelta = measureLineDelta;
/** Source snapshots stay in this object only; returned diagnostics contain metadata. */
exports.EDITOR_LINE_METRIC_VERSION = "editor-before-after-v1";
const MAX_DOCUMENT_CHARS = 512 * 1024;
const MAX_DOCUMENT_LINES = 20_000;
const MAX_DIFF_CELLS = 1_000_000;
function logicalLines(text) {
    if (!text)
        return [];
    const result = text.split(/\r?\n/);
    if (result[result.length - 1] === "")
        result.pop();
    return result;
}
/** Bounded LCS gives minimal line additions/deletions without retaining source. */
function measureLineDelta(before, after) {
    if (before.length > MAX_DOCUMENT_CHARS || after.length > MAX_DOCUMENT_CHARS) {
        return { status: "unavailable", reason: "document_too_large" };
    }
    const a = logicalLines(before);
    const b = logicalLines(after);
    if (a.length > MAX_DOCUMENT_LINES || b.length > MAX_DOCUMENT_LINES) {
        return { status: "unavailable", reason: "document_too_large" };
    }
    let start = 0;
    let aEnd = a.length;
    let bEnd = b.length;
    while (start < aEnd && start < bEnd && a[start] === b[start])
        start += 1;
    while (aEnd > start && bEnd > start && a[aEnd - 1] === b[bEnd - 1]) {
        aEnd -= 1;
        bEnd -= 1;
    }
    const aLength = aEnd - start;
    const bLength = bEnd - start;
    if (aLength * bLength > MAX_DIFF_CELLS) {
        return { status: "unavailable", reason: "diff_budget_exceeded" };
    }
    const row = new Uint32Array(bLength + 1);
    for (let i = start; i < aEnd; i += 1) {
        let diagonal = 0;
        for (let j = 1; j <= bLength; j += 1) {
            const previous = row[j];
            row[j] =
                a[i] === b[start + j - 1]
                    ? diagonal + 1
                    : Math.max(row[j], row[j - 1]);
            diagonal = previous;
        }
    }
    return {
        status: "measured",
        linesAdded: bLength - row[bLength],
        linesDeleted: aLength - row[bLength],
    };
}
//# sourceMappingURL=lineMeasurement.js.map