import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WakaclockCliService } from "../src/cli";
import { Logger } from "../src/logging";
import type { CliResult, WakaclockConfigSnapshot } from "../src/types";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args)
}));

function createConfig(): WakaclockConfigSnapshot {
  return {
    cliPath: "wakaclock-cli",
    flushIntervalMs: 30_000,
    sameFileHeartbeatMs: 120_000,
    idleMs: 300_000,
    statusBarEnabled: true,
    debugLogging: false,
    trackDebugSessions: true,
    trackBuildTasks: true
  };
}

function mockChild(result: Partial<CliResult> & { error?: Error } = {}) {
  const child = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
  };
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();

  queueMicrotask(() => {
    if (result.error) {
      child.emit("error", result.error);
      return;
    }
    if (result.stdout) {
      child.stdout.write(result.stdout);
    }
    if (result.stderr) {
      child.stderr.write(result.stderr);
    }
    child.stdout.end();
    child.stderr.end();
    child.emit("close", result.exitCode ?? 0);
  });

  return child;
}

describe("WakaclockCliService", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("sends no stdin payload when there are no extras", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding");

    const child = spawnMock.mock.results[0]?.value as ReturnType<typeof mockChild>;
    expect(spawnMock).toHaveBeenCalledWith(
      "wakaclock-cli",
      expect.any(Array),
      expect.objectContaining({
        stdio: "pipe",
        env: expect.objectContaining({
          WAKACLOCK_EDITOR: "vscode"
        })
      })
    );
    expect(child.stdin.read()?.toString() ?? "").toBe("");
  });

  it("writes json array to stdin when extras are provided", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [
      { entity: "C:/project/b.ts", keystrokes: 3 }
    ]);

    const child = spawnMock.mock.results[0]?.value as ReturnType<typeof mockChild>;
    const stdinPayload = child.stdin.read()?.toString() ?? "";
    expect(stdinPayload).toContain("\"entity\": \"C:/project/b.ts\"");
    expect(spawnMock.mock.calls[0][1]).toContain("--extra-heartbeats");
  });

  it("passes --project for the primary heartbeat when provided", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [], {
      project: "Daniel"
    });

    expect(spawnMock.mock.calls[0][1]).toContain("--project");
    expect(spawnMock.mock.calls[0][1]).toContain("Daniel");
  });

  it("parses today output", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({
        stdout: "Today: 1 hr 20 mins\nTotal seconds: 4800\nHeartbeats: 42\n",
        exitCode: 0
      })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(service.getToday()).resolves.toEqual({
      humanReadable: "1 hr 20 mins",
      totalSeconds: 4800,
      heartbeatCount: 42
    });
  });

  it("surfaces missing cli errors", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({
        error: new Error("spawn wakaclock-cli ENOENT")
      })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(service.getStatus()).rejects.toThrow(/Failed to start wakaclock-cli/);
  });
});
