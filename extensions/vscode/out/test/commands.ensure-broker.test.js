"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// commands.ts does `import * as vscode from "vscode"` at module load; ensureBrokerRunning
// itself never touches it, but the import must resolve for the module to load under vitest.
vitest_1.vi.mock("vscode", () => ({}));
const commands_1 = require("../src/commands");
// planai2.md Phase 0.2b — ensureBrokerRunning() must confirm the OS service is
// actually up (not merely that `broker install` exited 0) and fall back to the
// Extension-Host-owned broker on any platform when it is not.
function deps(overrides = {}) {
    return {
        installAgent: vitest_1.vi.fn().mockResolvedValue(undefined),
        getBrokerStatus: vitest_1.vi.fn().mockResolvedValue({ running: true }),
        startExtensionOwnedAgent: vitest_1.vi.fn().mockResolvedValue({ dispose: vitest_1.vi.fn() }),
        ...overrides,
    };
}
(0, vitest_1.describe)("ensureBrokerRunning", () => {
    (0, vitest_1.it)("trusts the OS service when install succeeds and status reports running", async () => {
        const d = deps();
        const outcome = await (0, commands_1.ensureBrokerRunning)(d);
        (0, vitest_1.expect)(outcome).toEqual({ running: true, viaFallback: false });
        (0, vitest_1.expect)(d.startExtensionOwnedAgent).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("falls back when install exits 0 but the service is not actually running", async () => {
        const d = deps({ getBrokerStatus: vitest_1.vi.fn().mockResolvedValue({ running: false }) });
        const outcome = await (0, commands_1.ensureBrokerRunning)(d);
        (0, vitest_1.expect)(outcome.running).toBe(true);
        (0, vitest_1.expect)(outcome.viaFallback).toBe(true);
        (0, vitest_1.expect)(outcome.disposable).toBeDefined();
        (0, vitest_1.expect)(d.startExtensionOwnedAgent).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)("falls back when the status check itself throws", async () => {
        const d = deps({ getBrokerStatus: vitest_1.vi.fn().mockRejectedValue(new Error("no json")) });
        const outcome = await (0, commands_1.ensureBrokerRunning)(d);
        (0, vitest_1.expect)(outcome.viaFallback).toBe(true);
        (0, vitest_1.expect)(d.startExtensionOwnedAgent).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)("falls back when installAgent throws, carrying the install error forward", async () => {
        const d = deps({ installAgent: vitest_1.vi.fn().mockRejectedValue(new Error("command not found")) });
        const outcome = await (0, commands_1.ensureBrokerRunning)(d);
        (0, vitest_1.expect)(outcome.running).toBe(true);
        (0, vitest_1.expect)(outcome.viaFallback).toBe(true);
        (0, vitest_1.expect)(outcome.error).toContain("command not found");
        (0, vitest_1.expect)(d.getBrokerStatus).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("reports not-running with a combined error when both the service and the fallback fail", async () => {
        const d = deps({
            installAgent: vitest_1.vi.fn().mockRejectedValue(new Error("no service manager")),
            startExtensionOwnedAgent: vitest_1.vi.fn().mockRejectedValue(new Error("spawn EACCES")),
        });
        const outcome = await (0, commands_1.ensureBrokerRunning)(d);
        (0, vitest_1.expect)(outcome.running).toBe(false);
        (0, vitest_1.expect)(outcome.viaFallback).toBe(false);
        (0, vitest_1.expect)(outcome.error).toContain("no service manager");
        (0, vitest_1.expect)(outcome.error).toContain("spawn EACCES");
    });
});
//# sourceMappingURL=commands.ensure-broker.test.js.map