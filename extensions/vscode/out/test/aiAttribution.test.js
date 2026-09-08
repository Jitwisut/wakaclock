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
    const contentFingerprint = `sha256:${"a".repeat(64)}`;
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
            lines_deleted: 1,
            content_fingerprint: contentFingerprint
        }) + "\n");
    }
    // Pins CORRELATION_WINDOW_SECONDS's actual value (15s), the same way
    // correlation.rs's `pins_exact_match_window_at_five_seconds_past_the_window_edge`
    // pins EXACT_MATCH_WINDOW on the Rust side — a change to the constant should make
    // one of the two assertions below fail.
    (0, vitest_1.it)("matches an event exactly at the 15-second boundary", async () => {
        await writeSidecar("/project/a.ts", 100);
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        const result = await store.classify("/project/a.ts", (100 + 15) * 1000, 3, 1, contentFingerprint);
        (0, vitest_1.expect)(result.attribution).toBe("ai");
    });
    (0, vitest_1.it)("does not match an event one second past the 15-second boundary", async () => {
        await writeSidecar("/project/a.ts", 100);
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        const result = await store.classify("/project/a.ts", (100 + 16) * 1000, 3, 1, contentFingerprint);
        (0, vitest_1.expect)(result.attribution).toBe("unattributed");
    });
});
(0, vitest_1.describe)("AiAttributionStore — sidecar v2 incremental transport", () => {
    let homeDir;
    const contentFingerprint = `sha256:${"b".repeat(64)}`;
    (0, vitest_1.beforeEach)(async () => {
        homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-sidecar-v2-"));
    });
    (0, vitest_1.afterEach)(async () => {
        await fs.rm(homeDir, { recursive: true, force: true });
    });
    function record(eventId, timeSeconds, sequence, streamId = "stream-a") {
        return JSON.stringify({
            schema_version: 2,
            stream_id: streamId,
            sequence,
            event_id: eventId,
            entity: "/project/a.ts",
            time: timeSeconds,
            lines_added: 3,
            lines_deleted: 1,
            content_fingerprint: contentFingerprint
        });
    }
    async function writeRaw(value) {
        const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
        await fs.mkdir(path.dirname(logPath), { recursive: true });
        await fs.writeFile(logPath, value);
        return logPath;
    }
    (0, vitest_1.it)("does not parse a partial line until the producer writes its newline", async () => {
        const logPath = await writeRaw(record("partial", 100, 1));
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 100_000, 3, 1)).attribution).toBe("unattributed");
        await fs.appendFile(logPath, "\n");
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution).toBe("ai");
        // The same transport record is consumed once, even though the reader resumed from
        // a byte offset instead of rereading the entire file.
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 100_000, 3, 1)).attribution).toBe("unattributed");
    });
    (0, vitest_1.it)("reads appended bytes and resynchronizes after a truncation with a new stream", async () => {
        const logPath = await writeRaw(`${record("first", 100, 1)}\n`);
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution).toBe("ai");
        await fs.appendFile(logPath, `${record("second", 101, 2)}\n`);
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 101_000, 3, 1, contentFingerprint)).attribution).toBe("ai");
        await fs.writeFile(logPath, `${record("rotated", 102, 1, "stream-b")}\n`);
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 102_000, 3, 1, contentFingerprint)).attribution).toBe("ai");
    });
    (0, vitest_1.it)("keeps legacy v1 rows readable and ignores future schemas", async () => {
        const legacy = JSON.stringify({
            event_id: "legacy",
            entity: "/project/a.ts",
            time: 100,
            lines_added: 3,
            lines_deleted: 1,
            content_fingerprint: contentFingerprint
        });
        const future = JSON.stringify({
            ...JSON.parse(record("future", 101, 2)),
            schema_version: 99
        });
        await writeRaw(`${legacy}\n${future}\n`);
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution).toBe("ai");
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 101_000, 3, 1)).attribution).toBe("unattributed");
    });
    (0, vitest_1.it)("collapses only duplicate sidecar rows with the same tool identity and content version", async () => {
        const first = {
            ...JSON.parse(record("operation-first", 100, 1)),
            tool_event_id: "tool-1"
        };
        const retry = {
            ...JSON.parse(record("operation-retry", 100, 2)),
            tool_event_id: "tool-1"
        };
        await writeRaw(`${JSON.stringify(first)}\n${JSON.stringify(retry)}\n`);
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution).toBe("ai");
        (0, vitest_1.expect)((await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution).toBe("unattributed");
    });
    (0, vitest_1.it)("persists pending evidence and consumed ownership across reader restarts", async () => {
        await writeRaw(`${record("restart", 100, 1)}\n`);
        const firstReader = new aiAttribution_1.AiAttributionStore(homeDir);
        // The event is retained as pending because the line delta is ambiguous.
        (0, vitest_1.expect)((await firstReader.classify("/project/a.ts", 100_000, 20, 1)).attribution).toBe("unattributed");
        const secondReader = new aiAttribution_1.AiAttributionStore(homeDir);
        (0, vitest_1.expect)((await secondReader.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution).toBe("ai");
        const thirdReader = new aiAttribution_1.AiAttributionStore(homeDir);
        // The same event cannot be replayed as ownership after the extension restarts.
        (0, vitest_1.expect)((await thirdReader.classify("/project/a.ts", 100_000, 3, 1)).attribution).toBe("unattributed");
    });
});
(0, vitest_1.describe)("F0-02 reproducer — ai-coverage-gap-audit-2026-09-05.md gap #1", () => {
    let homeDir;
    const contentFingerprint = `sha256:${"c".repeat(64)}`;
    (0, vitest_1.beforeEach)(async () => {
        homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-unmatched-"));
    });
    (0, vitest_1.afterEach)(async () => {
        await fs.rm(homeDir, { recursive: true, force: true });
    });
    // `classify` has zero candidates whenever no sidecar event exists for this
    // entity/window — which is exactly the shape of an AI edit with no adapter
    // installed for that tool, or one whose sidecar write simply hasn't landed yet
    // (a delayed sidecar, gap #4's other named scenario). There is no positive
    // evidence of human keystrokes here either: only that no AI event was found.
    // Per execution-plan decision D06 ("absence of AI evidence is not proof of human
    // origin"), the correct verdict is `unattributed`, not a silent promotion to
    // `human`. `classify`'s empty-candidates branch therefore keeps the observation
    // unattributed until a later producer can provide proof.
    (0, vitest_1.it)("an edit with no sidecar candidate at all is not silently attributed to a human (D06)", async () => {
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        const result = await store.classify("/project/never-seen.ts", Date.now(), 12, 0);
        (0, vitest_1.expect)(result.attribution).toBe("unattributed");
    });
    (0, vitest_1.it)("a sidecar that arrives after the editor flush is retained for late reconciliation", async () => {
        const entity = "/project/delayed.ts";
        const editorTimeMs = 100_000;
        const store = new aiAttribution_1.AiAttributionStore(homeDir);
        // The editor flushes before the producer has appended its sidecar event. The
        // pending ledger keeps this observation unattributed so a later proof can revise it.
        const initial = await store.classify(entity, editorTimeMs, 3, 1);
        const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
        await fs.mkdir(path.dirname(logPath), { recursive: true });
        await fs.writeFile(logPath, JSON.stringify({
            event_id: "delayed-event",
            entity,
            time: editorTimeMs / 1000,
            lines_added: 3,
            lines_deleted: 1,
            content_fingerprint: contentFingerprint
        }) + "\n");
        const late = await store.classify(entity, editorTimeMs, 3, 1, contentFingerprint);
        (0, vitest_1.expect)({ initial: initial.attribution, late: late.attribution }).toEqual({
            initial: "unattributed",
            late: "ai"
        });
    });
    (0, vitest_1.it)("a mixed human+AI editor batch is split by change ownership instead of one scalar verdict", async () => {
        const entity = "/project/mixed.ts";
        const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
        await fs.mkdir(path.dirname(logPath), { recursive: true });
        await fs.writeFile(logPath, JSON.stringify({
            event_id: "mixed-ai-event",
            entity,
            time: 200,
            lines_added: 4,
            lines_deleted: 0,
            content_fingerprint: contentFingerprint
        }) + "\n");
        const result = await new aiAttribution_1.AiAttributionStore(homeDir).classify(entity, 200_000, 10, 0, contentFingerprint, undefined, true);
        const actual = {
            ai_added: result.ai_lines_added ?? 0,
            human_added: 0,
            unattributed_added: result.unattributed_lines_added ?? 0
        };
        // Four lines have direct AI evidence. The residual six have no positive
        // human proof and therefore remain unknown until another producer proves them.
        (0, vitest_1.expect)(actual).toEqual({ ai_added: 4, human_added: 0, unattributed_added: 6 });
    });
});
//# sourceMappingURL=aiAttribution.test.js.map