import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture every command registered by commands.ts.
const registered = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('vscode', () => ({
  commands: {
    registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => {
      registered.set(id, handler);
      return { dispose: vi.fn() };
    },
  },
  window: {
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
    showErrorMessage: vi.fn().mockResolvedValue(undefined),
    showInputBox: vi.fn().mockResolvedValue(undefined),
    showQuickPick: vi.fn().mockResolvedValue(undefined),
  },
  workspace: {
    getWorkspaceFolder: vi.fn().mockReturnValue(undefined),
    getConfiguration: vi.fn().mockReturnValue({ get: vi.fn(), update: vi.fn() }),
  },
}));

import { registerCommands } from '../src/commands';

// planai2.md p7.2 — the "AtoAxis: Test AI Detection" command must be registered
// and must drive the broker + adapter status calls.

function harness() {
  const context = { subscriptions: { push: vi.fn() }, secrets: { get: vi.fn(), store: vi.fn() }, globalState: { get: vi.fn(), update: vi.fn() } };
  const getBrokerStatus = vi.fn().mockResolvedValue({ running: true, inbox: { dead_letter: 0 } });
  const getStatus = vi.fn().mockResolvedValue([]);
  const cliService = {
    getToday: vi.fn(),
    setApiKey: vi.fn(),
    persistApiKey: vi.fn(),
    clearApiKey: vi.fn(),
    syncAndVerifyApiKey: vi.fn(),
    installAgent: vi.fn(),
    startExtensionOwnedAgent: vi.fn(),
    verifyApiKey: vi.fn(),
    getStatus: vi.fn(),
    getBrokerStatus,
  };
  const aiIntegrations = { getStatus, setup: vi.fn() };
  registerCommands(
    context as never,
    { get: vi.fn(), update: vi.fn() } as never,
    cliService as never,
    { flushCurrentEditor: vi.fn() } as never,
    { applyVisibility: vi.fn(), refresh: vi.fn() } as never,
    aiIntegrations as never
  );
  return { getBrokerStatus, getStatus };
}

describe('wakaclock.testAiDetection command', () => {
  beforeEach(() => registered.clear());

  it('is registered', () => {
    harness();
    expect(registered.has('wakaclock.testAiDetection')).toBe(true);
  });

  it('runs the broker + adapter status calls when invoked', async () => {
    const { getBrokerStatus, getStatus } = harness();
    await registered.get('wakaclock.testAiDetection')!();
    expect(getBrokerStatus).toHaveBeenCalledOnce();
    expect(getStatus).toHaveBeenCalledOnce();
  });

  it('registers the AtoAxis AI commands alongside it', () => {
    harness();
    for (const id of [
      'wakaclock.testAiDetection',
      'wakaclock.repairAiIntegrations',
      'wakaclock.showBrokerStatus',
    ]) {
      expect(registered.has(id)).toBe(true);
    }
  });
});
