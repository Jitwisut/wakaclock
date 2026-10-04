"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// commands.ts does `import * as vscode from "vscode"` at module load; ensureBrokerRunning
// itself never touches it, but the import must resolve for the module to load under vitest.
vitest_1.vi.mock("vscode", () => ({}));
const commands_1 = require("../src/commands");
// On-demand mode keeps this legacy helper as a compatibility surface, but it must
// never install a service or start an Extension-Host-owned watcher.
function deps(overrides = {}) {
    return {
        installAgent: vitest_1.vi.fn().mockResolvedValue(undefined),
        getBrokerStatus: vitest_1.vi.fn().mockResolvedValue({ running: true }),
        startExtensionOwnedAgent: vitest_1.vi.fn().mockResolvedValue({ dispose: vitest_1.vi.fn() }),
        ...overrides,
    };
}
(0, vitest_1.describe)("ensureBrokerRunning", () => {
    (0, vitest_1.it)("reports the on-demand mode without touching service or watcher dependencies", async () => {
        const d = deps();
        const outcome = await (0, commands_1.ensureBrokerRunning)(d);
        (0, vitest_1.expect)(outcome).toEqual({
            running: false,
            viaFallback: false,
            error: "on-demand mode does not start a background watcher",
        });
        (0, vitest_1.expect)(d.installAgent).not.toHaveBeenCalled();
        (0, vitest_1.expect)(d.getBrokerStatus).not.toHaveBeenCalled();
        (0, vitest_1.expect)(d.startExtensionOwnedAgent).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=commands.ensure-broker.test.js.map