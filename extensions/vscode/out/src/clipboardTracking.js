"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClipboardActivityTracker = exports.PASTE_CHANGE_MATCH_WINDOW_MS = exports.ATOAXIS_CLIPBOARD_MIME = void 0;
const node_crypto_1 = require("node:crypto");
exports.ATOAXIS_CLIPBOARD_MIME = "application/vnd.atoaxis.clipboard-token";
exports.PASTE_CHANGE_MATCH_WINDOW_MS = 2_000;
const COPY_TOKEN_TTL_MS = 60 * 60 * 1_000;
const MAX_COPY_TOKENS = 128;
class ClipboardActivityTracker {
    copyTokens = new Map();
    pendingPastes = new Map();
    prepareCopy(document, ranges, workspace, now = Date.now()) {
        this.pruneCopyTokens(now);
        const token = (0, node_crypto_1.randomUUID)();
        const entity = normalizePath(document.uri.fsPath);
        this.copyTokens.set(token, { entity, workspace, createdAt: now });
        let copiedChars = 0;
        let copiedLines = 0;
        for (const range of ranges) {
            copiedChars += Math.max(0, document.offsetAt(range.end) - document.offsetAt(range.start));
            copiedLines += countRangeLines(range);
        }
        return { token, metrics: { copiedChars, copiedLines } };
    }
    preparePaste(document, ranges, workspace, copyToken, now = Date.now()) {
        this.pruneCopyTokens(now);
        const entity = normalizePath(document.uri.fsPath);
        const source = copyToken ? this.copyTokens.get(copyToken) : undefined;
        let origin = "external_or_unknown";
        if (source?.entity === entity) {
            origin = "same_file";
        }
        else if (source?.workspace && workspace && source.workspace === workspace) {
            origin = "same_workspace";
        }
        this.pendingPastes.set(entity, {
            documentVersion: document.version,
            entity,
            origin,
            ranges: [...ranges],
            requestedAt: now
        });
    }
    consumePaste(document, changes, changeReason, now = Date.now()) {
        const entity = normalizePath(document.uri.fsPath);
        const pending = this.pendingPastes.get(entity);
        if (!pending) {
            return undefined;
        }
        this.pendingPastes.delete(entity);
        if (changeReason === 1 ||
            changeReason === 2 ||
            now - pending.requestedAt > exports.PASTE_CHANGE_MATCH_WINDOW_MS ||
            document.version !== pending.documentVersion + 1 ||
            !rangesMatch(pending.ranges, changes)) {
            return undefined;
        }
        return { origin: pending.origin };
    }
    pruneCopyTokens(now) {
        for (const [token, record] of this.copyTokens) {
            if (now - record.createdAt > COPY_TOKEN_TTL_MS) {
                this.copyTokens.delete(token);
            }
        }
        while (this.copyTokens.size >= MAX_COPY_TOKENS) {
            const oldest = this.copyTokens.keys().next().value;
            if (!oldest) {
                break;
            }
            this.copyTokens.delete(oldest);
        }
    }
}
exports.ClipboardActivityTracker = ClipboardActivityTracker;
function countRangeLines(range) {
    if (range.isEmpty || positionsEqual(range.start, range.end)) {
        return 0;
    }
    if (range.start.line === range.end.line) {
        return 1;
    }
    return range.end.line - range.start.line + (range.end.character > 0 ? 1 : 0);
}
function rangesMatch(ranges, changes) {
    if (ranges.length === 0 || changes.length === 0 || changes.some((change) => !change.range)) {
        return false;
    }
    return ranges.every((target) => changes.some((change) => change.range &&
        positionsEqual(change.range.start, target.start) &&
        positionsEqual(change.range.end, target.end)));
}
function positionsEqual(left, right) {
    return left.line === right.line && left.character === right.character;
}
function normalizePath(value) {
    return value.replace(/\\/g, "/");
}
//# sourceMappingURL=clipboardTracking.js.map