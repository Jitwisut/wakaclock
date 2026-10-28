import { beforeEach, describe, expect, it, vi } from 'vitest';

const registered = new Map<string, (...args: unknown[]) => unknown>();
const showQuickPick = vi.fn().mockResolvedValue(undefined);

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
    showQuickPick: (...args: unknown[]) => showQuickPick(...args),
  },
  workspace: {
    getWorkspaceFolder: vi.fn().mockReturnValue(undefined),
    getConfiguration: vi.fn().mockReturnValue({ get: vi.fn(), update: vi.fn() }),
  },
}));

import { registerCommands } from '../src/commands';

function harness() {
  const context = {
    subscriptions: { push: vi.fn() },
    secrets: { get: vi.fn().mockResolvedValue('wcl_test_key'), store: vi.fn() },
    globalState: { get: vi.fn(), update: vi.fn() },
  };
  const cliService = {
    persistApiKey: vi.fn().mockResolvedValue(undefined),
    verifyApiKey: vi.fn().mockResolvedValue({ status: 'verified' }),
    getStatus: vi.fn(),
    getBrokerStatus: vi.fn(),
  };
  const aiIntegrations = {
    getStatus: vi.fn().mockResolvedValue([
      { id: 'claude-code', label: 'Claude Code', provider: 'anthropic', detected: true, enabled: false },
      { id: 'codex', label: 'Codex', provider: 'openai', detected: true, enabled: false },
      { id: 'cursor', label: 'Cursor', provider: 'cursor', detected: false, enabled: false },
    ]),
    setup: vi.fn().mockResolvedValue({ configured: ['claude-code', 'codex'], failed: [] }),
  };
  registerCommands(
    context as never,
    { get: vi.fn(), update: vi.fn() } as never,
    cliService as never,
    { flushCurrentEditor: vi.fn() } as never,
    { applyVisibility: vi.fn(), refresh: vi.fn() } as never,
    aiIntegrations as never
  );
  return { aiIntegrations, context };
}

describe('wakaclock.setupAiTracking with pre-selected agents', () => {
  beforeEach(() => {
    registered.clear();
    showQuickPick.mockClear();
  });

  it('sets up the named, detected tools without opening the picker', async () => {
    const { aiIntegrations, context } = harness();

    const result = await registered.get('wakaclock.setupAiTracking')!({ agents: ['claude-code', 'codex', 'cursor'] });

    expect(showQuickPick).not.toHaveBeenCalled();
    expect(aiIntegrations.setup).toHaveBeenCalledWith(['claude-code', 'codex']);
    expect(context.globalState.update).toHaveBeenCalledWith(
      'atoaxis.aiConsent.claude-code',
      expect.objectContaining({ state: 'enabled' })
    );
    expect(result).toBe(true);
  });

  it('still asks per tool when invoked without a selection', async () => {
    const { aiIntegrations } = harness();

    const result = await registered.get('wakaclock.setupAiTracking')!();

    expect(showQuickPick).toHaveBeenCalled();
    expect(aiIntegrations.setup).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});
