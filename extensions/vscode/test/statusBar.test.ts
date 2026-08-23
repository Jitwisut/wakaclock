import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatusBarController } from "../src/statusBar";
import { Logger } from "../src/logging";
import type { WakaclockConfigSnapshot } from "../src/types";

const item = {
  text: "",
  tooltip: "",
  command: "",
  name: "",
  backgroundColor: undefined as unknown,
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn()
};

const showErrorMessage = vi.fn().mockResolvedValue(undefined);
const executeCommand = vi.fn();

vi.mock("vscode", () => ({
  StatusBarAlignment: { Left: 1 },
  ThemeColor: class {
    public constructor(public readonly id: string) {}
  },
  window: {
    createStatusBarItem: () => item,
    showErrorMessage: (...args: unknown[]) => showErrorMessage(...args)
  },
  commands: {
    executeCommand: (...args: unknown[]) => executeCommand(...args)
  }
}));

function createConfig(overrides: Partial<WakaclockConfigSnapshot> = {}): WakaclockConfigSnapshot {
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

describe("StatusBarController", () => {
  beforeEach(() => {
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
  it("distinguishes a rejected API key from a generic failure", async () => {
    const controller = new StatusBarController(
      () => createConfig(),
      {
        getToday: vi
          .fn()
          .mockRejectedValue(new Error("Error: API key was rejected by the server."))
      },
      new Logger(() => false)
    );

    await controller.refresh();

    expect(item.text).toBe("$(warning) Wakaclock: key rejected");
    expect(item.command).toBe("wakaclock.setApiKey");
    expect(item.backgroundColor).toBeDefined();
    expect(showErrorMessage).toHaveBeenCalledTimes(1);
  });

  it("notifies once per failure, not on every refresh", async () => {
    const controller = new StatusBarController(
      () => createConfig(),
      {
        getToday: vi.fn().mockRejectedValue(new Error("authentication required"))
      },
      new Logger(() => false)
    );

    await controller.refresh();
    await controller.refresh();
    await controller.refresh();

    expect(showErrorMessage).toHaveBeenCalledTimes(1);
  });

  it("clears the warning and notifies again after a later failure", async () => {
    const getToday = vi
      .fn()
      .mockRejectedValueOnce(new Error("API key was rejected by the server"))
      .mockResolvedValueOnce({ humanReadable: "5 m", totalSeconds: 300, heartbeatCount: 2 })
      .mockRejectedValueOnce(new Error("API key was rejected by the server"));
    const controller = new StatusBarController(
      () => createConfig(),
      { getToday },
      new Logger(() => false)
    );

    await controller.refresh();
    await controller.refresh();
    expect(item.text).toBe("$(clock) 5m 0s");
    expect(item.backgroundColor).toBeUndefined();
    expect(item.command).toBe("wakaclock.showToday");

    await controller.refresh();
    expect(showErrorMessage).toHaveBeenCalledTimes(2);
  });

  it("renders today output", async () => {
    const controller = new StatusBarController(
      () => createConfig(),
      {
        getToday: vi.fn().mockResolvedValue({
          humanReadable: "1h 0m 0s",
          totalSeconds: 3600,
          heartbeatCount: 10
        })
      },
      new Logger(() => false)
    );

    await controller.refresh();

    expect(item.text).toBe("$(clock) 1h 0m 0s");
    expect(item.show).toHaveBeenCalled();
  });

  it("unions server intervals with the local buffer instead of adding overlap", async () => {
    const controller = new StatusBarController(
      () => createConfig(),
      {
        getToday: vi.fn().mockResolvedValue({
          humanReadable: "1m",
          totalSeconds: 60,
          confirmedSeconds: 60,
          heartbeatCount: 2,
          coveredIntervals: [
            { segment_id: "server", start: 100, end: 160, source: "editor" }
          ]
        })
      },
      new Logger(() => false)
    );
    controller.setBufferedSegmentsProvider(() => [
      { segment_id: "local", start: 130, end: 190, source: "editor" }
    ]);

    await controller.refresh();

    expect(item.text).toBe("$(clock) 1m 30s");
  });

  it("hides when disabled", async () => {
    const controller = new StatusBarController(
      () => createConfig({ statusBarEnabled: false }),
      {
        getToday: vi.fn()
      },
      new Logger(() => false)
    );

    await controller.refresh();

    expect(item.hide).toHaveBeenCalled();
  });

  it("shows fallback tooltip on failure", async () => {
    const controller = new StatusBarController(
      () => createConfig(),
      {
        getToday: vi.fn().mockRejectedValue(new Error("boom"))
      },
      new Logger(() => false)
    );

    await controller.refresh();

    expect(item.text).toBe("$(clock) Wakaclock");
    expect(item.tooltip).toContain("Unable to read today's total");
  });
});
