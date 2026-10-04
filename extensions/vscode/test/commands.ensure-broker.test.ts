import { describe, expect, it, vi } from "vitest";

// commands.ts does `import * as vscode from "vscode"` at module load; ensureBrokerRunning
// itself never touches it, but the import must resolve for the module to load under vitest.
vi.mock("vscode", () => ({}));

import { ensureBrokerRunning } from "../src/commands";

// On-demand mode keeps this legacy helper as a compatibility surface, but it must
// never install a service or start an Extension-Host-owned watcher.

function deps(overrides: Partial<Parameters<typeof ensureBrokerRunning>[0]> = {}) {
  return {
    installAgent: vi.fn().mockResolvedValue(undefined),
    getBrokerStatus: vi.fn().mockResolvedValue({ running: true }),
    startExtensionOwnedAgent: vi.fn().mockResolvedValue({ dispose: vi.fn() }),
    ...overrides,
  };
}

describe("ensureBrokerRunning", () => {
  it("reports the on-demand mode without touching service or watcher dependencies", async () => {
    const d = deps();
    const outcome = await ensureBrokerRunning(d);
    expect(outcome).toEqual({
      running: false,
      viaFallback: false,
      error: "on-demand mode does not start a background watcher",
    });
    expect(d.installAgent).not.toHaveBeenCalled();
    expect(d.getBrokerStatus).not.toHaveBeenCalled();
    expect(d.startExtensionOwnedAgent).not.toHaveBeenCalled();
  });
});
