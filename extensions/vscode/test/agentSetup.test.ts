import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertStableManagedHookPath,
  ensureCodexHook,
  ensureCodexHooksFeature,
  parseAdapterCatalog,
  parseAdapterList,
  parseAiSetupReport,
  pluginInstallCommand,
  refreshManagedCodexHookCommands,
  syncAgentPluginsToStableDir,
  writeHookAutoInstallPolicy,
  writeHookConsentState
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

async function writeSourceManifest(sourceDir: string, bundleVersion: string): Promise<void> {
  const files: Record<string, string> = {};
  async function visit(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
      } else if (entry.isFile() && entry.name !== "bundle-manifest.json") {
        const relative = path.relative(sourceDir, full).split(path.sep).join("/");
        files[relative] = createHash("sha256").update(await fs.readFile(full)).digest("hex");
      }
    }
  }
  await visit(sourceDir);
  const digest = createHash("sha256").update(JSON.stringify(files)).digest("hex");
  await fs.writeFile(
    path.join(sourceDir, "bundle-manifest.json"),
    `${JSON.stringify({ schema_version: 1, bundle_version: bundleVersion, files, digest }, null, 2)}\n`
  );
}

async function runHook(script: string, input: unknown, env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("bash", [script], { env });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`hook exited ${code}: ${stderr}`));
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
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

  it("refreshes a stable dir when the verified bundle digest changes", async () => {
    const { extensionPath, homeDir, logger } = setup();
    const sourceDir = path.join(extensionPath, "resources", "ai-agents");
    await fs.mkdir(path.join(sourceDir, "codex"), { recursive: true });
    await fs.mkdir(path.join(sourceDir, "common"), { recursive: true });
    await fs.writeFile(path.join(sourceDir, "README.md"), "first\n");
    await fs.writeFile(path.join(sourceDir, "codex", "heartbeat-hook.sh"), "#!/bin/sh\n");
    await fs.writeFile(path.join(sourceDir, "common", "emit-event.sh"), "#!/bin/sh\n");
    await writeSourceManifest(sourceDir, "1.2.3");

    const target = await syncAgentPluginsToStableDir({
      extensionPath,
      extensionVersion: "1.2.3",
      homeDir,
      logger
    });
    expect(await fs.readFile(path.join(target as string, "README.md"), "utf8")).toBe("first\n");

    await fs.writeFile(path.join(sourceDir, "README.md"), "updated\n");
    await writeSourceManifest(sourceDir, "1.2.3");
    await syncAgentPluginsToStableDir({
      extensionPath,
      extensionVersion: "1.2.3",
      homeDir,
      logger
    });
    expect(await fs.readFile(path.join(target as string, "README.md"), "utf8")).toBe("updated\n");
  });
});

describe("shared broker consent policy", () => {
  it("writes only the automatic setup boolean with private permissions", async () => {
    const { homeDir } = setup();
    await writeHookAutoInstallPolicy(homeDir, false);
    const policyPath = path.join(homeDir, ".wakaclock", "agent-hook-autoinstall.json");
    expect(JSON.parse(await fs.readFile(policyPath, "utf8"))).toEqual({ enabled: false });
    expect((await fs.stat(policyPath)).mode & 0o777).toBe(0o600);
  });

  it("shares per-agent consent with the broker without storing content", async () => {
    const { homeDir } = setup();
    await writeHookConsentState(homeDir, ["codex", "claude-code"], "enabled");
    const consentPath = path.join(homeDir, ".wakaclock", "agent-hook-consent.json");
    const consent = JSON.parse(await fs.readFile(consentPath, "utf8")) as Record<string, string>;
    expect(consent).toEqual({ codex: "enabled", "claude-code": "enabled" });
    expect(JSON.stringify(consent)).not.toMatch(/prompt|content|path|command/);
  });
});

describe("Codex hook config helpers", () => {
  it("adds the current hooks feature without duplicating an existing features table", () => {
    const config = "[features]\nother = true\n";
    const updated = ensureCodexHooksFeature(config);

    expect(updated).toContain("[features]\nhooks = true\nother = true");
    expect(ensureCodexHooksFeature(updated)).toBe(updated);
  });

  it("migrates the deprecated codex_hooks feature name", () => {
    const updated = ensureCodexHooksFeature("[features]\ncodex_hooks = true\nother = true\n");
    expect(updated).toContain("[features]\nhooks = true\nother = true");
    expect(updated).not.toContain("codex_hooks = true");
  });

  it("adds idempotent apply-patch and shell-sweep hook blocks", () => {
    const config = ensureCodexHooksFeature("");
    const updated = ensureCodexHook(config, "/tmp/Ato Axis/heartbeat-hook.sh");

    expect(updated).toContain("# AtoAxis managed AI attribution hook");
    expect(updated).toContain('matcher = "^apply_patch$"');
    expect(updated).toContain('command = "/tmp/Ato Axis/heartbeat-hook.sh"');
    expect(updated).toContain("# AtoAxis managed AI shell sweep hooks");
    expect(updated).toContain('matcher = "Bash|shell_command|exec_command|unified_exec|code_mode_exec|mcp__.*"');
    expect(updated).toContain('command = "/tmp/Ato Axis/git-sweep-before.sh"');
    expect(updated).toContain('command = "/tmp/Ato Axis/git-sweep-after.sh"');
    expect(updated).toContain("# AtoAxis managed AI shell failure cleanup");
    expect(updated).toContain('command = "/tmp/Ato Axis/tool-abort.sh"');
    expect(ensureCodexHook(updated, "/tmp/Ato Axis/heartbeat-hook.sh")).toBe(updated);
  });

  it("upgrades an existing attribution-only config with shell sweep hooks", () => {
    const legacy = [
      "[features]",
      "hooks = true",
      "",
      "# AtoAxis managed AI attribution hook",
      "[[hooks.PostToolUse]]",
      'matcher = "apply_patch"',
      "[[hooks.PostToolUse.hooks]]",
      'type = "command"',
      'command = "/tmp/Ato Axis/heartbeat-hook.sh"',
      "timeout = 60",
      ""
    ].join("\n");
    const updated = ensureCodexHook(legacy, "/tmp/Ato Axis/heartbeat-hook.sh");
    expect(updated).toContain("# AtoAxis managed AI shell sweep hooks");
  });

  it("anchors a legacy managed apply-patch matcher so current Codex fires it", () => {
    const legacy = [
      "# AtoAxis managed AI attribution hook",
      "[[hooks.PostToolUse]]",
      'matcher = "apply_patch"',
      "[[hooks.PostToolUse.hooks]]",
      'type = "command"',
      'command = "/tmp/heartbeat-hook.sh"',
      "timeout = 60",
      ""
    ].join("\n");
    const updated = ensureCodexHook(legacy, "/tmp/heartbeat-hook.sh");
    expect(updated).toContain('matcher = "^apply_patch$"');
    expect(ensureCodexHook(updated, "/tmp/heartbeat-hook.sh")).toBe(updated);
  });

  it("repoints a stale managed hook path from an old plugin version, preserving user config", () => {
    const oldRoot = "/home/u/.wakaclock/agent-plugins/1.0.0/codex";
    const newRoot = "/home/u/.wakaclock/agent-plugins/2.0.0/codex";
    const withOld = ensureCodexHook(ensureCodexHooksFeature(""), `${oldRoot}/heartbeat-hook.sh`);
    // A user's own unrelated hook and table must survive verbatim.
    const userTail = [
      "",
      "# my own hook",
      "[[hooks.PostToolUse]]",
      'matcher = "my_tool"',
      "[[hooks.PostToolUse.hooks]]",
      'type = "command"',
      'command = "/opt/me/notify.sh"',
      "timeout = 5",
      "",
      "[history]",
      "persistence = \"save-all\"",
      ""
    ].join("\n");
    const before = `${withOld}${userTail}`;

    const after = ensureCodexHook(before, `${newRoot}/heartbeat-hook.sh`);

    expect(after).toContain(`command = "${newRoot}/heartbeat-hook.sh"`);
    expect(after).toContain(`command = "${newRoot}/git-sweep-before.sh"`);
    expect(after).toContain(`command = "${newRoot}/git-sweep-after.sh"`);
    expect(after).not.toContain("1.0.0");
    // Untouched user content.
    expect(after).toContain('command = "/opt/me/notify.sh"');
    expect(after).toContain('persistence = "save-all"');
    // Idempotent once repointed.
    expect(ensureCodexHook(after, `${newRoot}/heartbeat-hook.sh`)).toBe(after);
  });

  it("refreshManagedCodexHookCommands leaves an unmanaged command line alone", () => {
    const config = [
      "# not ours",
      "[[hooks.PostToolUse]]",
      'command = "/opt/me/heartbeat-hook.sh"',
      ""
    ].join("\n");
    expect(
      refreshManagedCodexHookCommands(config, {
        heartbeat: "/x/heartbeat-hook.sh",
        before: "/x/git-sweep-before.sh",
        after: "/x/git-sweep-after.sh"
      })
    ).toBe(config);
  });

  it("assertStableManagedHookPath rejects a worktree/VSIX path and accepts the managed dir", () => {
    const home = "/home/u";
    expect(() =>
      assertStableManagedHookPath(`${home}/.wakaclock/agent-plugins/3.1.0/codex/heartbeat-hook.sh`, home)
    ).not.toThrow();
    expect(() =>
      assertStableManagedHookPath("/private/var/folders/x/T/vsix-unpack/codex/heartbeat-hook.sh", home)
    ).toThrow(/managed plugin directory/);
    expect(() =>
      assertStableManagedHookPath(`${home}/dev/atoaxis/extensions/ai-agents/codex/heartbeat-hook.sh`, home)
    ).toThrow(/managed plugin directory/);
  });
});

describe("adapter registry consumption (planai2 p1.5)", () => {
  const listJson = JSON.stringify([
    {
      id: "claude-code",
      provider: "anthropic",
      install: {
        kind: "native_plugin",
        install_args: ["claude", "plugin", "install", "atoaxis-heartbeat@atoaxis-plugins"]
      },
      verification: { status: "verified" }
    },
    {
      id: "codex",
      provider: "openai",
      install: {
        kind: "config_hook_block",
        config_path_from_home: ".codex/config.toml",
        marker: "# AtoAxis managed AI attribution hook"
      },
      verification: { status: "scaffold" }
    },
    {
      id: "gemini-cli",
      provider: "google",
      install: { kind: "native_plugin", install_args: ["gemini", "extensions", "install"] },
      verification: { status: "unverified" }
    }
  ]);

  it("parseAdapterList reads the CLI output and tolerates garbage", () => {
    const parsed = parseAdapterList(listJson);
    expect(parsed.map((m) => m.id)).toEqual(["claude-code", "codex", "gemini-cli"]);
    expect(parseAdapterList("not json")).toEqual([]);
    expect(parseAdapterList("{}")).toEqual([]);
  });

  it("reads the versioned catalog and separates partial setup outcomes", () => {
    const catalog = parseAdapterCatalog(JSON.stringify({ schema_version: 1, adapters: JSON.parse(listJson) }));
    expect(catalog?.schema_version).toBe(1);
    expect(catalog?.adapters[1].id).toBe("codex");
    const report = parseAiSetupReport(JSON.stringify({
      schema_version: 1,
      overall: "partial",
      suggested_action: "repair failed adapters",
      agents: [
        { id: "codex", status: "configured", outcome_code: "configured" },
        { id: "gemini-cli", status: "failed", outcome_code: "resource_invalid", suggested_action: "repair bundle" }
      ]
    }));
    expect(report?.overall).toBe("partial");
    expect(report?.agents[1].outcome_code).toBe("resource_invalid");
    expect(parseAiSetupReport(JSON.stringify({ agents: [] }))).toBeUndefined();
  });

  it("pluginInstallCommand splits the manifest args and skips non-plugin strategies", () => {
    const [claude, codex, gemini] = parseAdapterList(listJson);
    expect(pluginInstallCommand(claude)).toEqual({
      program: "claude",
      args: ["plugin", "install", "atoaxis-heartbeat@atoaxis-plugins"]
    });
    // gemini's manifest carries no trailing path — the installer appends it.
    expect(pluginInstallCommand(gemini)).toEqual({
      program: "gemini",
      args: ["extensions", "install"]
    });
    // codex installs via a config hook block, not a plugin command.
    expect(pluginInstallCommand(codex)).toBeUndefined();
    expect(pluginInstallCommand(undefined)).toBeUndefined();
  });
});

describe("AI shell snapshot adapters", () => {
  it("forwards stable matching Before/After tool metadata to the CLI engine", async () => {
    const homeDir = path.join(workDir, "home");
    const fakeCli = path.join(workDir, "fake-wakaclock");
    const callsLog = path.join(workDir, "snapshot-calls.log");
    await fs.mkdir(path.join(homeDir, ".wakaclock"), { recursive: true });
    await fs.writeFile(
      fakeCli,
      '#!/usr/bin/env bash\npayload="$(cat)"\nprintf "%s\\t%s\\n" "$*" "$payload" >> "$WAKACLOCK_TEST_CALLS"\n'
    );
    await fs.chmod(fakeCli, 0o755);
    await fs.writeFile(path.join(homeDir, ".wakaclock", "cli-path"), `${fakeCli}\n`);

    const beforeScript = path.resolve(process.cwd(), "../ai-agents/codex/git-sweep-before.sh");
    const afterScript = path.resolve(process.cwd(), "../ai-agents/codex/git-sweep-after.sh");
    const hookInput = {
      cwd: workDir,
      session_id: "session-1",
      tool_use_id: "call-1",
      tool_name: "shell_command",
      model: "gpt-test"
    };
    const env = {
      ...process.env,
      HOME: homeDir,
      WAKACLOCK_TEST_CALLS: callsLog
    };
    await runHook(beforeScript, hookInput, env);
    await runHook(afterScript, hookInput, env);

    const calls = (await fs.readFile(callsLog, "utf8"))
      .trim()
      .split("\n")
      .map((line) => {
        const [args, payload] = line.split("\t", 2);
        return { args, payload: JSON.parse(payload) as Record<string, unknown> };
      });
    expect(calls).toHaveLength(2);
    expect(calls[0].args).toBe("ai tool-before --json");
    expect(calls[1].args).toBe("ai tool-after --json");
    expect(calls[0].payload.tool_event_id).toBe(calls[1].payload.tool_event_id);
    expect(calls[0].payload).toMatchObject({
      agent: "codex",
      provider: "openai",
      session_id: "session-1",
      tool: "shell_command",
      transport: "shell_hook",
      cwd: workDir
    });
  });
});

describe("Codex heartbeat hook", () => {
  it("emits one heartbeat with per-file deltas for every file in a patch", async () => {
    const homeDir = path.join(workDir, "home");
    const fakeCli = path.join(workDir, "fake-wakaclock");
    const callsLog = path.join(workDir, "calls.log");
    await fs.mkdir(path.join(homeDir, ".wakaclock"), { recursive: true });
    await fs.writeFile(
      fakeCli,
      '#!/usr/bin/env bash\npayload="$(cat)"\nprintf "%s\\t%s\\n" "$*" "$payload" >> "$WAKACLOCK_TEST_CALLS"\n'
    );
    await fs.chmod(fakeCli, 0o755);
    await fs.writeFile(path.join(homeDir, ".wakaclock", "cli-path"), `${fakeCli}\n`);

    const script = path.resolve(process.cwd(), "../ai-agents/codex/heartbeat-hook.sh");
    const patch = [
      "*** Begin Patch",
      "*** Update File: src/one.ts",
      "-old",
      "+new",
      "+extra",
      "*** Add File: src/two file.ts",
      "+hello",
      "*** End Patch"
    ].join("\n");
    await runHook(
      script,
      {
        cwd: workDir,
        session_id: "session-1",
        tool_use_id: "apply-1",
        tool_input: { input: patch },
        model: "gpt-test",
        tool_response: "Success. Updated the following files:\nM src/one.ts\nA src/two file.ts\n"
      },
      {
        ...process.env,
        HOME: homeDir,
        WAKACLOCK_TEST_CALLS: callsLog
      }
    );

    const calls = (await fs.readFile(callsLog, "utf8"))
      .trim()
      .split("\n")
      .map((line) => {
        const [args, payload] = line.split("\t", 2);
        return { args, payload: JSON.parse(payload) as Record<string, unknown> };
      });
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.args)).toEqual(["ai emit --json", "ai emit --json"]);
    expect(calls.map((call) => call.payload)).toMatchObject([
      {
        schema_version: 1,
        event_type: "file_change",
        entity: path.join(workDir, "src/one.ts"),
        lines_added: 2,
        lines_deleted: 1,
        agent: "codex",
        source: "agent_hook",
        confidence: "verified",
        session_id: "session-1"
      },
      {
        schema_version: 1,
        event_type: "file_change",
        entity: path.join(workDir, "src/two file.ts"),
        lines_added: 1,
        lines_deleted: 0,
        agent: "codex",
        source: "agent_hook",
        confidence: "verified",
        session_id: "session-1"
      }
    ]);
  });
});
