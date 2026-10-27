import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AiSourcesUnsupportedError,
  aiSourcePickItems,
  manageAiSources,
  parseAiSources,
} from '../src/aiSources';
import type { AiSourceSummary, ManageAiSourcesDeps } from '../src/aiSources';
import { WakaclockCliService } from '../src/cli';
import { Logger } from '../src/logging';

const spawnMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

function mockChild(stdout: string, stderr = '', exitCode = 0) {
  const child = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
  };
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  queueMicrotask(() => {
    child.stdout.write(stdout);
    child.stderr.write(stderr);
    child.stdout.end();
    child.stderr.end();
    child.emit('close', exitCode);
  });
  return child;
}

function service() {
  return new WakaclockCliService(
    () => ({
      cliPath: 'wakaclock-cli',
      flushIntervalMs: 30_000,
      heartbeatRateLimitMs: 120_000,
      sameFileHeartbeatMs: 120_000,
      idleMs: 300_000,
      statusBarEnabled: true,
      debugLogging: false,
      trackDebugSessions: true,
      trackBuildTasks: true,
      trackClipboardActions: true,
    }),
    new Logger(() => false),
  );
}

const CURSOR: AiSourceSummary = {
  agent: 'cursor',
  enabled: true,
  source_kind: 'sqlite',
  sources: 1,
  time_mode: 'time_neutral',
  dry_run_edits: { count: 3, lines_added: 12, lines_deleted: 4, latest_at: null },
  last_24h: { budget_hits: 2, source_busy: 0, sync_lock_skips: 0, parser_panics: 0, schema_unknown: 1 },
};
const CLAUDE: AiSourceSummary = {
  agent: 'claude-code',
  enabled: true,
  source_kind: 'jsonl',
  sources: 4,
  time_mode: 'counted',
  dry_run_edits: { count: 0, lines_added: 0, lines_deleted: 0, latest_at: null },
};
const QODER: AiSourceSummary = {
  agent: 'qoder',
  enabled: false,
  source_kind: 'sqlite',
  sources: 0,
  time_mode: 'time_neutral',
};

describe('parseAiSources', () => {
  it('keeps well-formed rows and drops the rest', () => {
    const rows = parseAiSources(JSON.stringify({ sources: [CURSOR, { agent: 7 }, QODER] }));
    expect(rows.map((row) => row.agent)).toEqual(['cursor', 'qoder']);
  });

  it('rejects output that is not the sources list', () => {
    expect(() => parseAiSources('not json')).toThrow('invalid JSON');
    expect(() => parseAiSources('{"agents":[]}')).toThrow('unexpected shape');
  });
});

describe('aiSourcePickItems', () => {
  it('lists tools found here first and describes what each one sends', () => {
    const items = aiSourcePickItems([QODER, CURSOR, CLAUDE]);
    expect(items.map((item) => item.agent)).toEqual(['claude-code', 'cursor', 'qoder']);
    expect(items[0]).toMatchObject({
      label: '$(check) claude-code',
      description: 'on · edits counted · 4 sources',
      detail: undefined,
    });
    expect(items[1].description).toBe('on · token usage only · 1 source');
    expect(items[1].detail).toBe(
      '3 edits kept on this machine (+12 −4) · Last 24h: out of time 2, unknown format 1',
    );
    expect(items[2]).toMatchObject({
      label: '$(circle-slash) qoder',
      description: 'off · token usage only · not found on this machine',
      enabled: false,
    });
  });

  it('never shows a path', () => {
    const text = JSON.stringify(aiSourcePickItems([CURSOR, CLAUDE, QODER]));
    expect(text).not.toMatch(/[/\\]Users|Library|AppData|\.local/);
  });
});

function deps(overrides: Partial<ManageAiSourcesDeps> = {}): ManageAiSourcesDeps {
  return {
    listAiSources: vi.fn().mockResolvedValue([CURSOR, QODER]),
    setAiSourceEnabled: vi.fn().mockResolvedValue(undefined),
    pick: vi.fn().mockImplementation(async (items) => items[0]),
    showInformation: vi.fn().mockResolvedValue(undefined),
    showError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('manageAiSources', () => {
  it('turns a tool that is on off', async () => {
    const d = deps();
    expect(await manageAiSources(d)).toBe('cursor');
    expect(d.setAiSourceEnabled).toHaveBeenCalledWith('cursor', false);
    expect(d.showInformation).toHaveBeenCalledWith(expect.stringContaining('Stopped reading cursor'));
  });

  it('turns a tool that is off on and says history is not uploaded', async () => {
    const d = deps({ pick: vi.fn().mockImplementation(async (items) => items[1]) });
    expect(await manageAiSources(d)).toBe('qoder');
    expect(d.setAiSourceEnabled).toHaveBeenCalledWith('qoder', true);
    expect(d.showInformation).toHaveBeenCalledWith(
      'Reading qoder logs from now on. Earlier history is not uploaded.',
    );
  });

  it('tells the user what is read in the picker', async () => {
    const d = deps({ pick: vi.fn().mockResolvedValue(undefined) });
    expect(await manageAiSources(d)).toBeUndefined();
    expect(d.pick).toHaveBeenCalledWith(expect.any(Array), expect.stringContaining('no prompts, code or diffs'));
    expect(d.setAiSourceEnabled).not.toHaveBeenCalled();
  });

  it('reports an old CLI instead of failing silently', async () => {
    const d = deps({ listAiSources: vi.fn().mockRejectedValue(new AiSourcesUnsupportedError()) });
    expect(await manageAiSources(d)).toBeUndefined();
    expect(d.showError).toHaveBeenCalledWith(expect.stringContaining('Update the AtoAxis extension or CLI'));
    expect(d.pick).not.toHaveBeenCalled();
  });

  it('reports a failed toggle', async () => {
    const d = deps({ setAiSourceEnabled: vi.fn().mockRejectedValue(new Error('no local log reader for `x`')) });
    expect(await manageAiSources(d)).toBeUndefined();
    expect(d.showError).toHaveBeenCalledWith('no local log reader for `x`');
  });
});

describe('WakaclockCliService AI sources', () => {
  beforeEach(() => spawnMock.mockReset());

  it('reads the list and runs the toggle through the CLI', async () => {
    spawnMock.mockImplementation((_cli: string, args: string[] = []) => {
      return mockChild(
        args[2] === 'list'
          ? JSON.stringify({ sources: [CURSOR] })
          : JSON.stringify({ agent: 'cursor', enabled: false, sources_seeded: 0 }),
      );
    });
    const cli = service();
    expect((await cli.listAiSources()).map((row) => row.agent)).toEqual(['cursor']);
    await cli.setAiSourceEnabled('cursor', false);
    expect(spawnMock.mock.calls.map((call) => call[1])).toEqual([
      ['ai', 'sources', 'list', '--json'],
      ['ai', 'sources', 'disable', 'cursor', '--json'],
    ]);
  });

  it('turns an older CLI rejection into AiSourcesUnsupportedError', async () => {
    spawnMock.mockImplementation(() =>
      mockChild('', "error: unrecognized subcommand 'sources'\n\nUsage: wakaclock ai <COMMAND>", 2),
    );
    await expect(service().listAiSources()).rejects.toBeInstanceOf(AiSourcesUnsupportedError);
    await expect(service().setAiSourceEnabled('cursor', true)).rejects.toBeInstanceOf(
      AiSourcesUnsupportedError,
    );
  });
});
