import { describe, expect, it, vi } from "vitest";

// commands.ts does `import * as vscode from "vscode"` at module load; ensureBrokerRunning
// itself never touches it, but the import must resolve for the module to load under vitest.
vi.mock("vscode", () => ({}));

import { ensureBrokerRunning } from "../src/commands";

// planai2.md Phase 0.2b — ensureBrokerRunning() must confirm the OS service is
// actually up (not merely that `broker install` exited 0) and fall back to the
// Extension-Host-owned broker on any platform when it is not.

function deps(overrides: Partial<Parameters<typeof ensureBrokerRunning>[0]> = {}) {
  return {
    installAgent: vi.fn().mockResolvedValue(undefined),
    getBrokerStatus: vi.fn().mockResolvedValue({ running: true }),
    startExtensionOwnedAgent: vi.fn().mockResolvedValue({ dispose: vi.fn() }),
    ...overrides,
  };
}

describe("ensureBrokerRunning", () => {
  it("trusts the OS service when install succeeds and status reports running", async () => {
    const d = deps();
    const outcome = await ensureBrokerRunning(d);
    expect(outcome).toEqual({ running: true, viaFallback: false });
    expect(d.startExtensionOwnedAgent).not.toHaveBeenCalled();
  });

  it("falls back when install exits 0 but the service is not actually running", async () => {
    const d = deps({ getBrokerStatus: vi.fn().mockResolvedValue({ running: false }) });
    const outcome = await ensureBrokerRunning(d);
    expect(outcome.running).toBe(true);
    expect(outcome.viaFallback).toBe(true);
    expect(outcome.disposable).toBeDefined();
    expect(d.startExtensionOwnedAgent).toHaveBeenCalledOnce();
  });

  it("falls back when the status check itself throws", async () => {
    const d = deps({ getBrokerStatus: vi.fn().mockRejectedValue(new Error("no json")) });
    const outcome = await ensureBrokerRunning(d);
    expect(outcome.viaFallback).toBe(true);
    expect(d.startExtensionOwnedAgent).toHaveBeenCalledOnce();
  });

  it("falls back when installAgent throws, carrying the install error forward", async () => {
    const d = deps({ installAgent: vi.fn().mockRejectedValue(new Error("command not found")) });
    const outcome = await ensureBrokerRunning(d);
    expect(outcome.running).toBe(true);
    expect(outcome.viaFallback).toBe(true);
    expect(outcome.error).toContain("command not found");
    expect(d.getBrokerStatus).not.toHaveBeenCalled();
  });

  it("reports not-running with a combined error when both the service and the fallback fail", async () => {
    const d = deps({
      installAgent: vi.fn().mockRejectedValue(new Error("no service manager")),
      startExtensionOwnedAgent: vi.fn().mockRejectedValue(new Error("spawn EACCES")),
    });
    const outcome = await ensureBrokerRunning(d);
    expect(outcome.running).toBe(false);
    expect(outcome.viaFallback).toBe(false);
    expect(outcome.error).toContain("no service manager");
    expect(outcome.error).toContain("spawn EACCES");
  });
});
