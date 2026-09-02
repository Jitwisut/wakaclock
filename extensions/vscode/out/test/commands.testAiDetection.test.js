"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Capture every command registered by commands.ts.
const registered = new Map();
vitest_1.vi.mock('vscode', () => ({
    commands: {
        registerCommand: (id, handler) => {
            registered.set(id, handler);
            return { dispose: vitest_1.vi.fn() };
        },
    },
    window: {
        showInformationMessage: vitest_1.vi.fn().mockResolvedValue(undefined),
        showWarningMessage: vitest_1.vi.fn().mockResolvedValue(undefined),
        showErrorMessage: vitest_1.vi.fn().mockResolvedValue(undefined),
        showInputBox: vitest_1.vi.fn().mockResolvedValue(undefined),
        showQuickPick: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
    workspace: {
        getWorkspaceFolder: vitest_1.vi.fn().mockReturnValue(undefined),
        getConfiguration: vitest_1.vi.fn().mockReturnValue({ get: vitest_1.vi.fn(), update: vitest_1.vi.fn() }),
    },
}));
const commands_1 = require("../src/commands");
// planai2.md p7.2 — the "AtoAxis: Test AI Detection" command must be registered
// and must drive the broker + adapter status calls.
function harness() {
    const context = { subscriptions: { push: vitest_1.vi.fn() }, secrets: { get: vitest_1.vi.fn(), store: vitest_1.vi.fn() }, globalState: { get: vitest_1.vi.fn(), update: vitest_1.vi.fn() } };
    const getBrokerStatus = vitest_1.vi.fn().mockResolvedValue({ running: true, inbox: { dead_letter: 0 } });
    const getStatus = vitest_1.vi.fn().mockResolvedValue([]);
    const cliService = {
        getToday: vitest_1.vi.fn(),
        setApiKey: vitest_1.vi.fn(),
        persistApiKey: vitest_1.vi.fn(),
        clearApiKey: vitest_1.vi.fn(),
        syncAndVerifyApiKey: vitest_1.vi.fn(),
        installAgent: vitest_1.vi.fn(),
        startExtensionOwnedAgent: vitest_1.vi.fn(),
        verifyApiKey: vitest_1.vi.fn(),
        getStatus: vitest_1.vi.fn(),
        getBrokerStatus,
    };
    const aiIntegrations = { getStatus, setup: vitest_1.vi.fn() };
    (0, commands_1.registerCommands)(context, { get: vitest_1.vi.fn(), update: vitest_1.vi.fn() }, cliService, { flushCurrentEditor: vitest_1.vi.fn() }, { applyVisibility: vitest_1.vi.fn(), refresh: vitest_1.vi.fn() }, aiIntegrations);
    return { getBrokerStatus, getStatus };
}
(0, vitest_1.describe)('wakaclock.testAiDetection command', () => {
    (0, vitest_1.beforeEach)(() => registered.clear());
    (0, vitest_1.it)('is registered', () => {
        harness();
        (0, vitest_1.expect)(registered.has('wakaclock.testAiDetection')).toBe(true);
    });
    (0, vitest_1.it)('runs the broker + adapter status calls when invoked', async () => {
        const { getBrokerStatus, getStatus } = harness();
        await registered.get('wakaclock.testAiDetection')();
        (0, vitest_1.expect)(getBrokerStatus).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(getStatus).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('registers the AtoAxis AI commands alongside it', () => {
        harness();
        for (const id of [
            'wakaclock.testAiDetection',
            'wakaclock.repairAiIntegrations',
            'wakaclock.showBrokerStatus',
        ]) {
            (0, vitest_1.expect)(registered.has(id)).toBe(true);
        }
    });
});
//# sourceMappingURL=commands.testAiDetection.test.js.map