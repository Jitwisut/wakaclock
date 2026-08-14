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
exports.AiAttributionStore = void 0;
const fs = __importStar(require("node:fs/promises"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
/**
 * Reads the tiny metadata-only sidecar written by the CLI agent hooks. It lets the
 * editor extension avoid counting the same external AI edit as human typing when the
 * edited file is open in VS Code. No source text or prompt is ever written here.
 */
class AiAttributionStore {
    logPath;
    events = [];
    consumed = new Set();
    constructor(homeDir = os.homedir()) {
        this.logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
    }
    async matchesRecentEdit(entity, timeMs, linesAdded, linesDeleted) {
        if (linesAdded === 0 && linesDeleted === 0) {
            return false;
        }
        await this.refresh();
        const normalizedEntity = normalizeEntity(entity);
        const nowSeconds = timeMs / 1000;
        const index = this.events.findIndex((event) => {
            if (this.consumed.has(event.event_id)) {
                return false;
            }
            if (normalizeEntity(event.entity) !== normalizedEntity) {
                return false;
            }
            if (Math.abs(event.time - nowSeconds) > 15) {
                return false;
            }
            // A hook may count a replacement slightly differently from VS Code's range
            // metrics. Requiring the AI delta to cover the editor delta avoids suppressing
            // nearby human typing while still handling a complete AI insertion.
            return event.lines_added >= linesAdded && event.lines_deleted >= linesDeleted;
        });
        if (index === -1) {
            return false;
        }
        const event = this.events[index];
        this.consumed.add(event.event_id);
        return true;
    }
    async refresh() {
        let raw;
        try {
            raw = await fs.readFile(this.logPath, "utf8");
        }
        catch {
            return;
        }
        const parsed = [];
        for (const line of raw.split(/\r?\n/)) {
            if (!line.trim()) {
                continue;
            }
            try {
                const candidate = JSON.parse(line);
                if (typeof candidate.event_id === "string" &&
                    typeof candidate.entity === "string" &&
                    typeof candidate.time === "number" &&
                    typeof candidate.lines_added === "number" &&
                    typeof candidate.lines_deleted === "number") {
                    parsed.push(candidate);
                }
            }
            catch {
                // A hook may be in the middle of appending a line. The next refresh will retry it.
            }
        }
        this.events = parsed.slice(-500);
        const activeIds = new Set(this.events.map((event) => event.event_id));
        for (const eventId of this.consumed) {
            if (!activeIds.has(eventId)) {
                this.consumed.delete(eventId);
            }
        }
    }
}
exports.AiAttributionStore = AiAttributionStore;
function normalizeEntity(entity) {
    return path.normalize(path.resolve(entity)).replace(/\\/g, "/");
}
//# sourceMappingURL=aiAttribution.js.map