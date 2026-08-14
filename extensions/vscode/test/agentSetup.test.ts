import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureCodexHook,
  ensureCodexHooksFeature,
  syncAgentPluginsToStableDir
} from "../src/agentSetup";
import { Logger } from "../src/logging";

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-agent-setup-"));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

function setup() {
  return {
    extensionPath: path.join(workDir, "extension"),
    homeDir: path.join(workDir, "home"),
    logger: new Logger(() => false)
  };
}

async function writeBundledSource(extensionPath: string): Promise<void> {
  const sourceDir = path.join(extensionPath, "resources", "ai-agents");
  await fs.mkdir(path.join(sourceDir, "codex"), { recursive: true });
  await fs.writeFile(path.join(sourceDir, "README.md"), "hello\n");
  await fs.writeFile(path.join(sourceDir, "codex", "heartbeat-hook.sh"), "#!/usr/bin/env bash\n");
}

describe("syncAgentPluginsToStableDir", () => {
  it("returns undefined and creates nothing when bundled resources are absent", async () => {
    const { extensionPath, homeDir, logger } = setup();

    const result = await syncAgentPluginsToStableDir({
      extensionPath,
      extensionVersion: "1.2.3",
      homeDir,
      logger
    });

    expect(result).toBeUndefined();
    await expect(fs.access(path.join(homeDir, ".wakaclock"))).rejects.toThrow();
  });

  it("copies bundled resources into a version-pinned dir and makes .sh files executable", async () => {
    const { extensionPath, homeDir, logger } = setup();
    await writeBundledSource(extensionPath);

    const result = await syncAgentPluginsToStableDir({
      extensionPath,
      extensionVersion: "1.2.3",
      homeDir,
      logger
    });

    const expectedTarget = path.join(homeDir, ".wakaclock", "agent-plugins", "1.2.3");
    expect(result).toBe(expectedTarget);

    const readme = await fs.readFile(path.join(expectedTarget, "README.md"), "utf8");
    expect(readme).toBe("hello\n");

    const scriptStat = await fs.stat(path.join(expectedTarget, "codex", "heartbeat-hook.sh"));
    expect(scriptStat.mode & 0o111).toBeTruthy();
  });

  it("does not re-copy or overwrite an existing version dir", async () => {
    const { extensionPath, homeDir, logger } = setup();
    await writeBundledSource(extensionPath);

    const targetDir = path.join(homeDir, ".wakaclock", "agent-plugins", "1.2.3");
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, "README.md"), "already here, don't touch\n");

    const result = await syncAgentPluginsToStableDir({
      extensionPath,
      extensionVersion: "1.2.3",
      homeDir,
      logger
    });

    expect(result).toBe(targetDir);
    const readme = await fs.readFile(path.join(targetDir, "README.md"), "utf8");
    expect(readme).toBe("already here, don't touch\n");
  });

  it("gives each extension version its own stable dir", async () => {
    const { extensionPath, homeDir, logger } = setup();
    await writeBundledSource(extensionPath);

    const first = await syncAgentPluginsToStableDir({
      extensionPath,
      extensionVersion: "1.0.0",
      homeDir,
      logger
    });
    const second = await syncAgentPluginsToStableDir({
      extensionPath,
      extensionVersion: "2.0.0",
      homeDir,
      logger
    });

    expect(first).not.toBe(second);
    await expect(fs.access(first as string)).resolves.toBeUndefined();
    await expect(fs.access(second as string)).resolves.toBeUndefined();
  });
});

describe("Codex hook config helpers", () => {
  it("adds the hooks feature without duplicating an existing features table", () => {
    const config = "[features]\nother = true\n";
    const updated = ensureCodexHooksFeature(config);

    expect(updated).toContain("[features]\ncodex_hooks = true\nother = true");
    expect(ensureCodexHooksFeature(updated)).toBe(updated);
  });

  it("adds an idempotent managed PostToolUse block with a quoted path", () => {
    const config = ensureCodexHooksFeature("");
    const updated = ensureCodexHook(config, "/tmp/Ato Axis/heartbeat-hook.sh");

    expect(updated).toContain("# AtoAxis managed AI attribution hook");
    expect(updated).toContain('matcher = "apply_patch"');
    expect(updated).toContain('command = "/tmp/Ato Axis/heartbeat-hook.sh"');
    expect(ensureCodexHook(updated, "/tmp/Ato Axis/heartbeat-hook.sh")).toBe(updated);
  });
});
