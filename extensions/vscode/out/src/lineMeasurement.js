"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentLineMeasurements = exports.EDITOR_LINE_METRIC_VERSION = void 0;
exports.measureLineDelta = measureLineDelta;
/** Source snapshots stay in this object only; returned diagnostics contain metadata. */
exports.EDITOR_LINE_METRIC_VERSION = "editor-before-after-v1";
const MAX_DOCUMENT_CHARS = 512 * 1024;
const MAX_DOCUMENT_LINES = 20_000;
const MAX_DIFF_CELLS = 1_000_000;
const MAX_TRACKED_DOCUMENTS = 16;
function read(document) {
    if (!document.getText)
        return { reason: "document_unavailable" };
    try {
        const text = document.getText();
        if (text.length > MAX_DOCUMENT_CHARS)
            return { reason: "document_too_large", version: document.version };
        return { text, version: document.version };
    }
    catch {
        return { reason: "document_unavailable" };
    }
}
/** Logical lines match patch semantics: a terminating newline adds no empty line. */
function lines(text) {
    if (!text)
        return [];
    const result = text.split(/\r?\n/);
    if (result[result.length - 1] === "")
        result.pop();
    return result;
}
/** Bounded LCS gives minimal additions/deletions; large dissimilar inputs are unknown. */
function measureLineDelta(before, after) {
    if (before.length > MAX_DOCUMENT_CHARS || after.length > MAX_DOCUMENT_CHARS) {
        return { status: "unavailable", reason: "document_too_large" };
    }
    const a = lines(before);
    const b = lines(after);
    if (a.length > MAX_DOCUMENT_LINES || b.length > MAX_DOCUMENT_LINES)
        return { status: "unavailable", reason: "document_too_large" };
    let start = 0;
    let aEnd = a.length;
    let bEnd = b.length;
    while (start < aEnd && start < bEnd && a[start] === b[start])
        start++;
    while (aEnd > start && bEnd > start && a[aEnd - 1] === b[bEnd - 1]) {
        aEnd--;
        bEnd--;
    }
    const aLength = aEnd - start;
    const bLength = bEnd - start;
    if (aLength * bLength > MAX_DIFF_CELLS)
        return { status: "unavailable", reason: "diff_budget_exceeded" };
    const row = new Uint32Array(bLength + 1);
    for (let i = start; i < aEnd; i++) {
        let diagonal = 0;
        for (let j = 1; j <= bLength; j++) {
            const previous = row[j];
            row[j] = a[i] === b[start + j - 1] ? diagonal + 1 : Math.max(row[j], row[j - 1]);
            diagonal = previous;
        }
    }
    return { status: "measured", linesAdded: bLength - row[bLength], linesDeleted: aLength - row[bLength] };
}
class DocumentLineMeasurements {
    windows = new Map();
    observe(entity, document) {
        const snapshot = read(document);
        const existing = this.windows.get(entity);
        if (existing) {
            // A cursor/save observing content without the corresponding change notification
            // cannot retroactively supply the missing before-version.
            if (existing.after.text !== snapshot.text || existing.after.version !== snapshot.version) {
                existing.invalid = "version_discontinuity";
                existing.after = snapshot;
            }
            return;
        }
        if (this.windows.size >= MAX_TRACKED_DOCUMENTS)
            this.windows.delete(this.windows.keys().next().value);
        this.windows.set(entity, { before: snapshot, after: snapshot, events: 0, replay: false });
    }
    change(entity, document, replay) {
        const snapshot = read(document);
        let window = this.windows.get(entity);
        if (!window) {
            this.observe(entity, document);
            window = this.windows.get(entity);
            window.before = { reason: "baseline_missing" };
        }
        else if (snapshot.version === undefined || window.after.version === undefined || snapshot.version !== window.after.version + 1) {
            window.invalid = "version_discontinuity";
        }
        window.after = snapshot;
        window.events++;
        window.replay ||= replay;
    }
    close(entity) {
        const window = this.windows.get(entity);
        if (!window || window.events === 0)
            return undefined;
        const reason = window.before.reason ?? window.after.reason ?? window.invalid;
        const result = {
            metricVersion: exports.EDITOR_LINE_METRIC_VERSION,
            boundary: "flush",
            beforeVersion: window.before.version,
            afterVersion: window.after.version,
            changeEvents: window.events,
            containsReplay: window.replay,
            ...(reason ? { status: "unavailable", reason } : measureLineDelta(window.before.text, window.after.text))
        };
        this.windows.set(entity, { before: window.after, after: window.after, events: 0, replay: false });
        return result;
    }
    forget(entity) { this.windows.delete(entity); }
}
exports.DocumentLineMeasurements = DocumentLineMeasurements;
//# sourceMappingURL=lineMeasurement.js.map