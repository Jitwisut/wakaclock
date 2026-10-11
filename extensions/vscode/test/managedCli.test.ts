import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedCliManager, managedCliInternals } from "../src/managedCli";
import { Logger } from "../src/logging";
import type { WakaclockConfigSnapshot } from "../src/types";

// Unit probes are simulated on every OS. A text fixture named .exe is not a
// Windows executable, and these tests do not certify native installation.
vi.mock("node:child_process", () => {
  const execFile = () => { throw new Error("Use the promisified probe in this unit suite."); };
  Object.defineProperty(execFile, Symbol.for("nodejs.util.promisify.custom"), { value: async (file: string, args: string[]) => {
    const content = await fs.readFile(file, "utf8");
    if (content.includes("FAIL_START")) throw new Error("simulated startup failure");
    return { stdout: args[0] === "journal-scope" ? JSON.stringify({ capabilities: ["editor_durable_ack_v1"] }) : "wakaclock 0.1.0", stderr: "" };
  }});
  return { execFile };
});

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
    trackClipboardActions: true,
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
  it("retains an explicit rollback across restart until an explicit upgrade", async () => {
    const { root, binary } = await fixture();
    const context = { extensionPath: root, globalStoragePath: path.join(root, "global") };
    const create = () => new ManagedCliManager(context, config, new Logger(() => false));
    const first = await create().ensureReady();
    await fs.appendFile(binary, "\n# second candidate\n");
    const manifestPath = path.join(root, "resources", "cli-manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest.sha256 = await managedCliInternals.sha256(binary);
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    const second = await create().ensureReady();
    expect(second).not.toBe(first);
    // Roll back before ensureReady to cover a fresh manager's cache as well.
    const rolledBack = create();
    expect(await rolledBack.rollback()).toBe(first);
    expect(await rolledBack.ensureReady()).toBe(first);
    expect(await create().ensureReady()).toBe(first);
    expect(await create().upgrade()).toBe(second);
    expect(await create().ensureReady()).toBe(second);
  });

  it("rechecks a changed custom CLI without replacing the owner's file", async () => {
    const { root, binary } = await fixture();
    const snapshot = config();
    const manager = new ManagedCliManager({ extensionPath: root, globalStoragePath: path.join(root, "global") }, () => snapshot, new Logger(() => false));
    const managed = await manager.ensureReady();
    snapshot.cliPath = binary;
    expect(await manager.ensureReady()).toBe(binary);
    expect(await fs.readFile(binary)).toEqual(await fs.readFile(managed));
    snapshot.cliPath = "";
    expect(await manager.ensureReady()).toBe(managed);
  });
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

  it("rejects manifest versions that could escape the managed CLI directory", async () => {
    const { root } = await fixture();
    const manifestPath = path.join(root, "resources", "cli-manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest.cliVersion = "../../outside";
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    await expect(managedCliInternals.readManifest(manifestPath)).rejects.toThrow(/required fields/i);
  });

  it("rejects unsupported CLI protocol versions before execution", async () => {
    const { root } = await fixture();
    const manifestPath = path.join(root, "resources", "cli-manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest.protocolVersion = 999;
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    const manager = new ManagedCliManager(
      { extensionPath: root, globalStoragePath: path.join(root, "global") },
      config,
      new Logger(() => false),
    );
    await expect(manager.ensureReady()).rejects.toThrow(/protocol/i);
  });

  it("rejects a bundled CLI version that does not match the Extension version", async () => {
    const { root } = await fixture();
    const manager = new ManagedCliManager(
      { extensionPath: root, globalStoragePath: path.join(root, "global"), extensionVersion: "9.9.9" },
      config,
      new Logger(() => false),
    );
    await expect(manager.ensureReady()).rejects.toThrow(/does not match Extension/i);
  });
  it("keeps the verified active binary when a new candidate cannot start", async () => {
    const { root, binary } = await fixture();
    const storage=path.join(root,"global");
    const previous=await new ManagedCliManager({extensionPath:root,globalStoragePath:storage},config,new Logger(()=>false)).ensureReady();
    await fs.writeFile(binary,"FAIL_START",{mode:0o755});
    const manifestPath=path.join(root,"resources","cli-manifest.json");
    const manifest=JSON.parse(await fs.readFile(manifestPath,"utf8"));
    manifest.sha256=crypto.createHash("sha256").update("FAIL_START").digest("hex");
    await fs.writeFile(manifestPath,JSON.stringify(manifest));
    const recovered=await new ManagedCliManager({extensionPath:root,globalStoragePath:storage},config,new Logger(()=>false)).ensureReady();
    expect(recovered).toBe(previous);
    expect(await fs.readFile(previous,"utf8")).not.toContain("FAIL_START");
  });

});
