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
const fs = __importStar(require("node:fs/promises"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const vitest_1 = require("vitest");
const aiAttribution_1 = require("../src/aiAttribution");
(0, vitest_1.describe)("AiAttributionStore.classify — correlation window", () => {
    let homeDir;
    (0, vitest_1.beforeEach)(async () => {
        homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-window-"));
    });
    (0, vitest_1.afterEach)(async () => {
        await fs.rm(homeDir, { recursive: true, force: true });
    });
    async function writeSidecar(entity, timeSeconds) {
        const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
        await fs.mkdir(path.dirname(logPath), { recursive: true });
        await fs.writeFile(logPath, JSON.stringify({
            event_id: "e1",
            entity,
            time: timeSeconds,
            lines_added: 3,
            lines_deleted: 1
        }) + "\n");
    }
    // Pins CORRELATION_WINDOW_SECONDS's actual value (15s), the same way
    // correlation.rs's `pins_exact_match_window_at_five_seconds_past_the_window_edge`
    // pins EXACT_MATCH_WINDOW on the Rust side — a change to the constant should make
    // one of the two assertions below fail.
    (0, vitest_1.it)("matches an event exactly at the 15-second boundary", async () => {
        await writeSidecar("/project/a.ts", 100);
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        const result = await store.classify("/project/a.ts", (100 + 15) * 1000, 3, 1);
        (0, vitest_1.expect)(result.attribution).toBe("ai");
    });
    (0, vitest_1.it)("does not match an event one second past the 15-second boundary", async () => {
        await writeSidecar("/project/a.ts", 100);
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        const result = await store.classify("/project/a.ts", (100 + 16) * 1000, 3, 1);
        (0, vitest_1.expect)(result.attribution).toBe("human");
    });
});
//# sourceMappingURL=aiAttribution.test.js.map