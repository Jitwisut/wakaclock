import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ManagedCliManager, managedCliInternals } from "../src/managedCli";
import { Logger } from "../src/logging";
import type { WakaclockConfigSnapshot } from "../src/types";

const roots: string[] = [];

function config(): WakaclockConfigSnapshot {
  return {
    cliPath: "",
    serverUrl: "https://api.atoaxis.com",
    flushIntervalMs: 30_000,
    heartbeatRateLimitMs: 120_000,
    sameFileHeartbeatMs: 120_000,
    idleMs: 900_000,
    statusBarEnabled: true,
    debugLogging: false,
    trackDebugSessions: true,
    trackBuildTasks: true,
  };
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-cli-"));
  roots.push(root);
  const resources = path.join(root, "resources", "bin");
  await fs.mkdir(resources, { recursive: true });
  const binary = path.join(resources, process.platform === "win32" ? "wakaclock.exe" : "wakaclock");
  const content = process.platform === "win32"
    ? "@echo off\necho wakaclock 0.1.0\n"
    : "#!/bin/sh\necho wakaclock 0.1.0\n";
  await fs.writeFile(binary, content, { mode: 0o755 });
  const target = await managedCliInternals.resolveTarget();
  const sha256 = crypto.createHash("sha256").update(content).digest("hex");
  await fs.writeFile(
    path.join(root, "resources", "cli-manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      cliVersion: "0.1.0",
      protocolVersion: 1,
      target,
      binary: process.platform === "win32" ? "wakaclock.exe" : "wakaclock",
      sha256,
    }),
  );
  return { root, binary };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("ManagedCliManager", () => {
  it("verifies, atomically copies and reuses the bundled CLI", async () => {
    const { root, binary } = await fixture();
    const manager = new ManagedCliManager(
      {
        extensionPath: root,
        globalStoragePath: path.join(root, "global"),
      },
      config,
      new Logger(() => false),
    );
    const first = await manager.ensureReady();
    expect(first).toContain(path.join("global", "cli", "0.1.0"));
    expect(await fs.readFile(first)).toEqual(await fs.readFile(binary));
    expect(await manager.ensureReady()).toBe(first);
  });

  it("refuses a checksum-mismatched package", async () => {
    const { root } = await fixture();
    await fs.appendFile(path.join(root, "resources", "bin", process.platform === "win32" ? "wakaclock.exe" : "wakaclock"), "tampered");
    const manager = new ManagedCliManager(
      { extensionPath: root, globalStoragePath: path.join(root, "global") },
      config,
      new Logger(() => false),
    );
    await expect(manager.ensureReady()).rejects.toThrow(/checksum/i);
  });
});
