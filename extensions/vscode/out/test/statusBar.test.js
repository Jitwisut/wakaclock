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
    backgroundColor: undefined,
    show: vitest_1.vi.fn(),
    hide: vitest_1.vi.fn(),
    dispose: vitest_1.vi.fn()
};
const showErrorMessage = vitest_1.vi.fn().mockResolvedValue(undefined);
const executeCommand = vitest_1.vi.fn();
vitest_1.vi.mock("vscode", () => ({
    StatusBarAlignment: { Left: 1 },
    ThemeColor: class {
        id;
        constructor(id) {
            this.id = id;
        }
    },
    window: {
        createStatusBarItem: () => item,
        showErrorMessage: (...args) => showErrorMessage(...args)
    },
    commands: {
        executeCommand: (...args) => executeCommand(...args)
    }
}));
function createConfig(overrides = {}) {
    return {
        cliPath: "wakaclock-cli",
        flushIntervalMs: 30_000,
        heartbeatRateLimitMs: 120_000,
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
        item.backgroundColor = undefined;
        item.show.mockReset();
        item.hide.mockReset();
        item.dispose.mockReset();
        showErrorMessage.mockClear();
        executeCommand.mockClear();
    });
    // A revoked key and an unreachable server used to look identical in the status bar,
    // so a key regenerated after setup read as a transient blip while every heartbeat
    // went unrecorded.
    (0, vitest_1.it)("distinguishes a rejected API key from a generic failure", async () => {
        const controller = new statusBar_1.StatusBarController(() => createConfig(), {
            getToday: vitest_1.vi
                .fn()
                .mockRejectedValue(new Error("Error: API key was rejected by the server."))
        }, new logging_1.Logger(() => false));
        await controller.refresh();
        (0, vitest_1.expect)(item.text).toBe("$(warning) Wakaclock: key rejected");
        (0, vitest_1.expect)(item.command).toBe("wakaclock.setApiKey");
        (0, vitest_1.expect)(item.backgroundColor).toBeDefined();
        (0, vitest_1.expect)(showErrorMessage).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("notifies once per failure, not on every refresh", async () => {
        const controller = new statusBar_1.StatusBarController(() => createConfig(), {
            getToday: vitest_1.vi.fn().mockRejectedValue(new Error("authentication required"))
        }, new logging_1.Logger(() => false));
        await controller.refresh();
        await controller.refresh();
        await controller.refresh();
        (0, vitest_1.expect)(showErrorMessage).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("clears the warning and notifies again after a later failure", async () => {
        const getToday = vitest_1.vi
            .fn()
            .mockRejectedValueOnce(new Error("API key was rejected by the server"))
            .mockResolvedValueOnce({ humanReadable: "5 m", totalSeconds: 300, heartbeatCount: 2 })
            .mockRejectedValueOnce(new Error("API key was rejected by the server"));
        const controller = new statusBar_1.StatusBarController(() => createConfig(), { getToday }, new logging_1.Logger(() => false));
        await controller.refresh();
        await controller.refresh();
        (0, vitest_1.expect)(item.text).toBe("$(clock) 5m 0s");
        (0, vitest_1.expect)(item.backgroundColor).toBeUndefined();
        (0, vitest_1.expect)(item.command).toBe("wakaclock.showToday");
        await controller.refresh();
        (0, vitest_1.expect)(showErrorMessage).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)("renders today output", async () => {
        const controller = new statusBar_1.StatusBarController(() => createConfig(), {
            getToday: vitest_1.vi.fn().mockResolvedValue({
                humanReadable: "1h 0m 0s",
                totalSeconds: 3600,
                heartbeatCount: 10
            })
        }, new logging_1.Logger(() => false));
        await controller.refresh();
        (0, vitest_1.expect)(item.text).toBe("$(clock) 1h 0m 0s");
        (0, vitest_1.expect)(item.show).toHaveBeenCalled();
    });
    (0, vitest_1.it)("keeps the status bar on the CLI total and reports local activity as pending", async () => {
        const controller = new statusBar_1.StatusBarController(() => createConfig(), {
            getToday: vitest_1.vi.fn().mockResolvedValue({
                humanReadable: "1m",
                totalSeconds: 60,
                confirmedSeconds: 60,
                heartbeatCount: 2,
                coveredIntervals: [
                    { segment_id: "server", start: 100, end: 160, source: "editor" }
                ]
            })
        }, new logging_1.Logger(() => false));
        controller.setBufferedSegmentsProvider(() => [
            { segment_id: "local", start: 130, end: 190, source: "editor" }
        ]);
        await controller.refresh();
        (0, vitest_1.expect)(item.text).toBe("$(clock) 1m 0s");
        (0, vitest_1.expect)(item.tooltip).toContain("Local pending: 1m 0s");
    });
    (0, vitest_1.it)("never renders less than the CLI's own total for the day", async () => {
        // The CLI reports 20m 3s (confirmed + queued, unioned), but the covered
        // intervals it echoed only reconstruct to a few seconds — a mid-drain
        // snapshot. The bar must follow the authoritative total, not the fragment.
        const controller = new statusBar_1.StatusBarController(() => createConfig(), {
            getToday: vitest_1.vi.fn().mockResolvedValue({
                humanReadable: "20m 3s",
                totalSeconds: 1203,
                confirmedSeconds: 1203,
                queuedSeconds: 0,
                heartbeatCount: 87,
                coveredIntervals: [
                    { segment_id: "server", start: 100, end: 116, source: "editor" }
                ]
            })
        }, new logging_1.Logger(() => false));
        await controller.refresh();
        (0, vitest_1.expect)(item.text).toBe("$(clock) 20m 3s");
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