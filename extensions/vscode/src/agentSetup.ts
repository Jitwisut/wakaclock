import * as fs from "node:fs/promises";
import { execFile } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import type { Logger } from "./logging";

const execFileAsync = promisify(execFile);

// Populated at build time by scripts/copy-ai-agents.js, which copies
// extensions/ai-agents/ (a sibling of this extension's own package, so vsce won't
// bundle it automatically) into resources/ai-agents/ before packaging.
const BUNDLED_RESOURCE_SUBPATH = path.join("resources", "ai-agents");

export interface AgentPluginsSyncOptions {
  extensionPath: string;
  extensionVersion: string;
  logger: Logger;
  homeDir?: string;
}

export type AiAgentId = "claude-code" | "codex" | "gemini-cli";

export interface AiAgentStatus {
  id: AiAgentId;
  label: string;
  provider: string;
  detected: boolean;
  enabled: boolean;
  executable?: string;
  reason?: string;
}

export interface AiAgentSetupOptions {
  stableDir: string;
  homeDir?: string;
  cliPath?: string;
  logger: Logger;
}

export interface AiAgentSetupResult {
  statuses: AiAgentStatus[];
  configured: AiAgentId[];
  failed: Array<{ id: AiAgentId; error: string }>;
}

/**
 * Copies the bundled AI-agent integration sources (Claude Code plugin, Gemini CLI
 * extension, Codex hook) into a version-pinned directory under the user's home dir
 * and returns that directory's path.
 *
 * `claude plugin marketplace add` and `gemini extensions install` are both handed a
 * filesystem path that they expect to stay valid indefinitely. VS Code installs
 * extensions into a version-stamped directory
 * (`…/atoaxis.atoaxis-vscode-<version>/…`) that is replaced wholesale on every
 * update, so registering that path directly would break on the extension's very
 * next upgrade — this stable copy is what install-command wiring should point at
 * instead.
 */
export async function syncAgentPluginsToStableDir(
  options: AgentPluginsSyncOptions
): Promise<string | undefined> {
  const { extensionPath, extensionVersion, logger } = options;
  const homeDir = options.homeDir ?? os.homedir();
  const sourceDir = path.join(extensionPath, BUNDLED_RESOURCE_SUBPATH);
  const targetDir = path.join(homeDir, ".wakaclock", "agent-plugins", extensionVersion);

  if (!(await pathExists(sourceDir))) {
    logger.debug("agentSetup: no bundled ai-agents resources found, skipping sync", {
      sourceDir
    });
    return undefined;
  }

  if (await pathExists(targetDir)) {
    logger.debug("agentSetup: stable dir for this version already present, skipping copy", {
      targetDir
    });
    return targetDir;
  }

  // Copy into a temp dir first and rename into place, so a crash or error mid-copy
  // can never leave targetDir half-populated but still passing the pathExists check
  // above on the next activation.
  const tempDir = `${targetDir}.tmp-${process.pid}`;
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await fs.cp(sourceDir, tempDir, { recursive: true });
    await makeShellScriptsExecutable(tempDir);
    await fs.rename(tempDir, targetDir);
    logger.debug("agentSetup: synced AI agent plugin sources", { targetDir });
    return targetDir;
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    logger.warn("agentSetup: failed to sync AI agent plugin sources", {
      error: error instanceof Error ? error.message : String(error)
    });
    return undefined;
  }
}

/**
 * Detect the CLI-based agents that can be instrumented without inspecting source
 * code. Detection is deliberately capability-based: a tool is only reported as
 * detected when its executable answers `--version`.
 */
export async function detectAiAgents(options: {
  homeDir?: string;
} = {}): Promise<AiAgentStatus[]> {
  const homeDir = options.homeDir ?? os.homedir();
  const state = await readSetupState(homeDir);
  const codexConfigured = await codexHookIsConfigured(homeDir);

  const [claude, codex, gemini] = await Promise.all([
    detectExecutable("claude"),
    detectExecutable("codex"),
    detectExecutable("gemini")
  ]);

  return [
    {
      id: "claude-code",
      label: "Claude Code",
      provider: "anthropic",
      detected: claude.detected,
      enabled: Boolean(state["claude-code"]),
      executable: claude.path,
      reason: claude.reason
    },
    {
      id: "codex",
      label: "Codex CLI",
      provider: "openai",
      detected: codex.detected,
      enabled: codexConfigured,
      executable: codex.path,
      reason: codex.reason
    },
    {
      id: "gemini-cli",
      label: "Gemini CLI",
      provider: "google",
      detected: gemini.detected,
      enabled: Boolean(state["gemini-cli"]),
      executable: gemini.path,
      reason: gemini.reason
    }
  ];
}

/** Install/register the integrations for every detected agent. */
export async function setupDetectedAiAgents(
  options: AiAgentSetupOptions
): Promise<AiAgentSetupResult> {
  const homeDir = options.homeDir ?? os.homedir();
  await writeCliPath(homeDir, options.cliPath);
  const statuses = await detectAiAgents({ homeDir });
  const configured: AiAgentId[] = [];
  const failed: Array<{ id: AiAgentId; error: string }> = [];

  for (const status of statuses.filter((item) => item.detected)) {
    try {
      if (status.id === "claude-code") {
        await setupClaudeCode(options.stableDir, options.logger);
      } else if (status.id === "gemini-cli") {
        await setupGeminiCli(options.stableDir, options.logger);
      } else {
        await setupCodex(options.stableDir, homeDir, options.logger);
      }
      configured.push(status.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.logger.warn("agentSetup: failed to configure AI agent", {
        agent: status.id,
        error: message
      });
      failed.push({ id: status.id, error: message });
    }
  }

  await writeSetupState(homeDir, configured);
  const refreshed = await detectAiAgents({ homeDir });
  return { statuses: refreshed, configured, failed };
}

async function setupClaudeCode(stableDir: string, logger: Logger): Promise<void> {
  if (process.platform === "win32") {
    throw new Error("Claude Code hook scripts require a POSIX shell on Windows");
  }
  await runCommandAllowAlreadyConfigured(
    "claude",
    ["plugin", "marketplace", "add", stableDir],
    logger
  );
  await runCommandAllowAlreadyConfigured(
    "claude",
    ["plugin", "install", "atoaxis-heartbeat@atoaxis-plugins"],
    logger
  );
}

async function setupGeminiCli(stableDir: string, logger: Logger): Promise<void> {
  if (process.platform === "win32") {
    throw new Error("Gemini CLI hook scripts require a POSIX shell on Windows");
  }
  await runCommandAllowAlreadyConfigured(
    "gemini",
    ["extensions", "install", path.join(stableDir, "gemini-cli")],
    logger
  );
}

async function setupCodex(stableDir: string, homeDir: string, logger: Logger): Promise<void> {
  if (process.platform === "win32") {
    throw new Error("Codex hook scripts require a POSIX shell on Windows");
  }

  const configDir = path.join(homeDir, ".codex");
  const configPath = path.join(configDir, "config.toml");
  await fs.mkdir(configDir, { recursive: true });
  const existing = await readTextIfExists(configPath);
  const withFeature = ensureCodexHooksFeature(existing ?? "");
  const hookPath = path.join(stableDir, "codex", "heartbeat-hook.sh");
  const withHook = ensureCodexHook(withFeature, hookPath);
  await writeTextAtomically(configPath, withHook);
  logger.debug("agentSetup: configured Codex hook", { configPath });
}

export function ensureCodexHooksFeature(config: string): string {
  if (/^\s*codex_hooks\s*=\s*true\s*$/m.test(config)) {
    return config;
  }

  const featureHeader = /^\s*\[features\]\s*$/m.exec(config);
  if (featureHeader && featureHeader.index !== undefined) {
    const insertAt = featureHeader.index + featureHeader[0].length;
    return `${config.slice(0, insertAt)}\ncodex_hooks = true${config.slice(insertAt)}`;
  }

  return `${config.trimEnd()}\n\n[features]\ncodex_hooks = true\n`;
}

export function ensureCodexHook(config: string, hookPath: string): string {
  const marker = "# AtoAxis managed AI attribution hook";
  if (config.includes(marker)) {
    return config;
  }

  const block = [
    "",
    marker,
    "[[hooks.PostToolUse]]",
    'matcher = "apply_patch"',
    "[[hooks.PostToolUse.hooks]]",
    'type = "command"',
    `command = ${tomlString(hookPath)}`,
    "timeout = 60",
    ""
  ].join("\n");
  return `${config.trimEnd()}\n${block}`;
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function detectExecutable(command: string): Promise<{
  detected: boolean;
  path?: string;
  reason?: string;
}> {
  try {
    const result = await execFileAsync(command, ["--version"], { timeout: 4_000 });
    return { detected: true, path: command, reason: result.stdout.trim() };
  } catch (error) {
    return {
      detected: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runCommand(command: string, args: string[], logger: Logger): Promise<void> {
  logger.debug("agentSetup: running integration command", { command, args });
  try {
    await execFileAsync(command, args, { timeout: 30_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${command} ${args.join(" ")} failed: ${message}`);
  }
}

async function runCommandAllowAlreadyConfigured(
  command: string,
  args: string[],
  logger: Logger
): Promise<void> {
  try {
    await runCommand(command, args, logger);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/(already|exists|installed|present)/i.test(message)) {
      throw error;
    }
    logger.debug("agentSetup: integration already configured", { command, args });
  }
}

type SetupState = Partial<Record<AiAgentId, boolean>>;

async function readSetupState(homeDir: string): Promise<SetupState> {
  const raw = await readTextIfExists(path.join(homeDir, ".wakaclock", "ai-agent-setup.json"));
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as SetupState;
  } catch {
    return {};
  }
}

async function writeSetupState(homeDir: string, configured: AiAgentId[]): Promise<void> {
  const target = path.join(homeDir, ".wakaclock", "ai-agent-setup.json");
  await fs.mkdir(path.dirname(target), { recursive: true });
  const previous = await readSetupState(homeDir);
  const state: SetupState = { ...previous };
  for (const id of configured) {
    state[id] = true;
  }
  await writeTextAtomically(target, `${JSON.stringify(state, null, 2)}\n`);
}

async function writeCliPath(homeDir: string, cliPath?: string): Promise<void> {
  const trimmed = cliPath?.trim();
  if (!trimmed) {
    return;
  }
  const target = path.join(homeDir, ".wakaclock", "cli-path");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await writeTextAtomically(target, `${trimmed}\n`);
}

async function codexHookIsConfigured(homeDir: string): Promise<boolean> {
  const config = await readTextIfExists(path.join(homeDir, ".codex", "config.toml"));
  return Boolean(config?.includes("# AtoAxis managed AI attribution hook"));
}

async function readTextIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function writeTextAtomically(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

// The exec bit on the shipped .sh hook scripts doesn't reliably survive being
// zipped into a VSIX and extracted on install, so it's reapplied here rather than
// trusted to come through from the source copy.
async function makeShellScriptsExecutable(rootDir: string): Promise<void> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await makeShellScriptsExecutable(entryPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".sh")) {
      await fs.chmod(entryPath, 0o755);
    }
  }
}
