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
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs/promises"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const vitest_1 = require("vitest");
const managedCli_1 = require("../src/managedCli");
const logging_1 = require("../src/logging");
const roots = [];
function config() {
    return {
        cliPath: "",
        serverUrl: "https://api.atoaxis.com",
        flushIntervalMs: 30_000,
        heartbeatRateLimitMs: 120_000,
        sameFileHeartbeatMs: 120_000,
        idleMs: 900_000,
        statusBarEnabled: true,
        debugLogging: false,
        trackDebugSessions: true,
        trackBuildTasks: true,
    };
}
async function fixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-cli-"));
    roots.push(root);
    const resources = path.join(root, "resources", "bin");
    await fs.mkdir(resources, { recursive: true });
    const binary = path.join(resources, process.platform === "win32" ? "wakaclock.exe" : "wakaclock");
    const content = process.platform === "win32"
        ? "@echo off\necho wakaclock 0.1.0\n"
        : "#!/bin/sh\necho wakaclock 0.1.0\n";
    await fs.writeFile(binary, content, { mode: 0o755 });
    const target = await managedCli_1.managedCliInternals.resolveTarget();
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    await fs.writeFile(path.join(root, "resources", "cli-manifest.json"), JSON.stringify({
        schemaVersion: 1,
        cliVersion: "0.1.0",
        protocolVersion: 1,
        target,
        binary: process.platform === "win32" ? "wakaclock.exe" : "wakaclock",
        sha256,
    }));
    return { root, binary };
}
(0, vitest_1.afterEach)(async () => {
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
(0, vitest_1.describe)("ManagedCliManager", () => {
    (0, vitest_1.it)("verifies, atomically copies and reuses the bundled CLI", async () => {
        const { root, binary } = await fixture();
        const manager = new managedCli_1.ManagedCliManager({
            extensionPath: root,
            globalStoragePath: path.join(root, "global"),
        }, config, new logging_1.Logger(() => false));
        const first = await manager.ensureReady();
        (0, vitest_1.expect)(first).toContain(path.join("global", "cli", "0.1.0"));
        (0, vitest_1.expect)(await fs.readFile(first)).toEqual(await fs.readFile(binary));
        (0, vitest_1.expect)(await manager.ensureReady()).toBe(first);
    });
    (0, vitest_1.it)("refuses a checksum-mismatched package", async () => {
        const { root } = await fixture();
        await fs.appendFile(path.join(root, "resources", "bin", process.platform === "win32" ? "wakaclock.exe" : "wakaclock"), "tampered");
        const manager = new managedCli_1.ManagedCliManager({ extensionPath: root, globalStoragePath: path.join(root, "global") }, config, new logging_1.Logger(() => false));
        await (0, vitest_1.expect)(manager.ensureReady()).rejects.toThrow(/checksum/i);
    });
});
//# sourceMappingURL=managedCli.test.js.map