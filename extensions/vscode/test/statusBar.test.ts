import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatusBarController } from "../src/statusBar";
import { Logger } from "../src/logging";
import type { WakaclockConfigSnapshot } from "../src/types";

const item = {
  text: "",
  tooltip: "",
  command: "",
  name: "",
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn()
};

vi.mock("vscode", () => ({
  StatusBarAlignment: { Left: 1 },
  window: {
    createStatusBarItem: () => item
  }
}));

function createConfig(overrides: Partial<WakaclockConfigSnapshot> = {}): WakaclockConfigSnapshot {
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

describe("StatusBarController", () => {
  beforeEach(() => {
    item.text = "";
    item.tooltip = "";
    item.show.mockReset();
    item.hide.mockReset();
    item.dispose.mockReset();
  });

  it("renders today output", async () => {
    const controller = new StatusBarController(
      () => createConfig(),
      {
        getToday: vi.fn().mockResolvedValue({
          humanReadable: "1 hr",
          totalSeconds: 3600,
          heartbeatCount: 10
        })
      },
      new Logger(() => false)
    );

    await controller.refresh();

    expect(item.text).toBe("$(clock) 1 hr");
    expect(item.show).toHaveBeenCalled();
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
