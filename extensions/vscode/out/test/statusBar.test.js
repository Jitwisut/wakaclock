"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const statusBar_1 = require("../src/statusBar");
const logging_1 = require("../src/logging");
const item = {
    text: "",
    tooltip: "",
    command: "",
    name: "",
    show: vitest_1.vi.fn(),
    hide: vitest_1.vi.fn(),
    dispose: vitest_1.vi.fn()
};
vitest_1.vi.mock("vscode", () => ({
    StatusBarAlignment: { Left: 1 },
    window: {
        createStatusBarItem: () => item
    }
}));
function createConfig(overrides = {}) {
    return {
        cliPath: "wakaclock-cli",
        flushIntervalMs: 30_000,
        sameFileHeartbeatMs: 120_000,
        idleMs: 300_000,
        statusBarEnabled: true,
        debugLogging: false,
        trackDebugSessions: true,
        trackBuildTasks: true,
        ...overrides
    };
}
(0, vitest_1.describe)("StatusBarController", () => {
    (0, vitest_1.beforeEach)(() => {
        item.text = "";
        item.tooltip = "";
        item.show.mockReset();
        item.hide.mockReset();
        item.dispose.mockReset();
    });
    (0, vitest_1.it)("renders today output", async () => {
        const controller = new statusBar_1.StatusBarController(() => createConfig(), {
            getToday: vitest_1.vi.fn().mockResolvedValue({
                humanReadable: "1 hr",
                totalSeconds: 3600,
                heartbeatCount: 10
            })
        }, new logging_1.Logger(() => false));
        await controller.refresh();
        (0, vitest_1.expect)(item.text).toBe("$(clock) 1 hr");
        (0, vitest_1.expect)(item.show).toHaveBeenCalled();
    });
    (0, vitest_1.it)("hides when disabled", async () => {
        const controller = new statusBar_1.StatusBarController(() => createConfig({ statusBarEnabled: false }), {
            getToday: vitest_1.vi.fn()
        }, new logging_1.Logger(() => false));
        await controller.refresh();
        (0, vitest_1.expect)(item.hide).toHaveBeenCalled();
    });
    (0, vitest_1.it)("shows fallback tooltip on failure", async () => {
        const controller = new statusBar_1.StatusBarController(() => createConfig(), {
            getToday: vitest_1.vi.fn().mockRejectedValue(new Error("boom"))
        }, new logging_1.Logger(() => false));
        await controller.refresh();
        (0, vitest_1.expect)(item.text).toBe("$(clock) Wakaclock");
        (0, vitest_1.expect)(item.tooltip).toContain("Unable to read today's total");
    });
});
//# sourceMappingURL=statusBar.test.js.map