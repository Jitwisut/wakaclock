"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAdapterList = parseAdapterList;
exports.pluginInstallCommand = pluginInstallCommand;
exports.syncAgentPluginsToStableDir = syncAgentPluginsToStableDir;
exports.detectAiAgents = detectAiAgents;
exports.setupDetectedAiAgents = setupDetectedAiAgents;
exports.assertStableManagedHookPath = assertStableManagedHookPath;
exports.ensureCodexHooksFeature = ensureCodexHooksFeature;
exports.refreshManagedCodexHookCommands = refreshManagedCodexHookCommands;
exports.ensureCodexHook = ensureCodexHook;
const fs = __importStar(require("node:fs/promises"));
const node_child_process_1 = require("node:child_process");
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
// Populated at build time by scripts/copy-ai-agents.js, which copies
// extensions/ai-agents/ (a sibling of this extension's own package, so vsce won't
// bundle it automatically) into resources/ai-agents/ before packaging.
const BUNDLED_RESOURCE_SUBPATH = path.join("resources", "ai-agents");
/**
 * planai2.md Phase 1 (p1.5): the VS Code installer reads the agent set, its
 * install plan and its verification status from the Rust adapter registry via
 * `wakaclock adapter list --json`, instead of hard-coding them here. A parse
 * failure or an older CLI without the subcommand yields an empty map and the
 * installer falls back to its built-in defaults — never a failed setup.
 */
function parseAdapterList(stdout) {
    try {
        const parsed = JSON.parse(stdout);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
/** `[program, ...args]` for a `native_plugin` manifest, or undefined. */
function pluginInstallCommand(manifest) {
    if (!manifest || manifest.install.kind !== "native_plugin") {
        return undefined;
    }
    const [program, ...args] = manifest.install.install_args;
    return program ? { program, args } : undefined;
}
async function fetchAdapterRegistry(cliPath) {
    const map = new Map();
    try {
        const { stdout } = await execFileAsync(cliPath || "wakaclock", ["adapter", "list", "--json"], {
            timeout: 10_000
        });
        for (const manifest of parseAdapterList(stdout)) {
            map.set(manifest.id, manifest);
        }
    }
    catch {
        // Older CLI without the subcommand, or not on PATH — fall back to defaults.
    }
    return map;
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
async function syncAgentPluginsToStableDir(options) {
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
    }
    catch (error) {
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
async function detectAiAgents(options = {}) {
    const homeDir = options.homeDir ?? os.homedir();
    const state = await readSetupState(homeDir);
    const codexConfigured = await codexHookIsConfigured(homeDir);
    const registry = await fetchAdapterRegistry(options.cliPath);
    const [claude, codex, gemini] = await Promise.all([
        detectExecutable("claude"),
        detectExecutable("codex"),
        detectExecutable("gemini")
    ]);
    const withRegistry = (status) => {
        const manifest = registry.get(status.id);
        return manifest?.verification?.status
            ? { ...status, verificationStatus: manifest.verification.status }
            : status;
    };
    return [
        withRegistry({
            id: "claude-code",
            label: "Claude Code",
            provider: "anthropic",
            detected: claude.detected,
            enabled: Boolean(state["claude-code"]),
            executable: claude.path,
            reason: claude.reason
        }),
        withRegistry({
            id: "codex",
            label: "Codex CLI",
            provider: "openai",
            detected: codex.detected,
            enabled: codexConfigured,
            executable: codex.path,
            reason: codex.reason
        }),
        withRegistry({
            id: "gemini-cli",
            label: "Gemini CLI",
            provider: "google",
            detected: gemini.detected,
            enabled: Boolean(state["gemini-cli"]),
            executable: gemini.path,
            reason: gemini.reason
        })
    ];
}
/** Install/register the integrations for every detected agent. */
async function setupDetectedAiAgents(options) {
    const homeDir = options.homeDir ?? os.homedir();
    await writeCliPath(homeDir, options.cliPath);
    const statuses = await detectAiAgents({ homeDir, cliPath: options.cliPath });
    const registry = await fetchAdapterRegistry(options.cliPath);
    const configured = [];
    const failed = [];
    const selected = options.selectedIds
        ? new Set(options.selectedIds)
        : undefined;
    for (const status of statuses.filter((item) => item.detected && (!selected || selected.has(item.id)))) {
        try {
            if (status.id === "claude-code") {
                await setupClaudeCode(options.stableDir, options.logger, registry.get("claude-code"));
            }
            else if (status.id === "gemini-cli") {
                await setupGeminiCli(options.stableDir, options.logger, registry.get("gemini-cli"));
            }
            else {
                await setupCodex(options.stableDir, homeDir, options.logger);
            }
            configured.push(status.id);
        }
        catch (error) {
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
async function setupClaudeCode(stableDir, logger, manifest) {
    if (process.platform === "win32") {
        // Windows uses the transcript watcher baseline; shell hooks are an optional
        // fast path and must not turn a successful consent into a failed setup.
        logger.debug("agentSetup: Claude Code configured in transcript-only mode on Windows");
        return;
    }
    await runCommandAllowAlreadyConfigured("claude", ["plugin", "marketplace", "add", stableDir], logger);
    // The plugin id comes from the adapter registry (planai2.md p1.5); the literal
    // fallback keeps an older CLI without `adapter list` working.
    const plan = pluginInstallCommand(manifest);
    await runCommandAllowAlreadyConfigured(plan?.program ?? "claude", plan?.args ?? ["plugin", "install", "atoaxis-heartbeat@atoaxis-plugins"], logger);
}
async function setupGeminiCli(stableDir, logger, manifest) {
    if (process.platform === "win32") {
        logger.debug("agentSetup: Gemini CLI configured in transcript-only mode on Windows");
        return;
    }
    const extensionPath = path.join(stableDir, "gemini-cli");
    const plan = pluginInstallCommand(manifest);
    await runCommandAllowAlreadyConfigured(plan?.program ?? "gemini", plan ? [...plan.args, extensionPath] : ["extensions", "install", extensionPath], logger);
}
async function setupCodex(stableDir, homeDir, logger) {
    if (process.platform === "win32") {
        logger.debug("agentSetup: Codex configured in transcript-only mode on Windows");
        return;
    }
    const configDir = path.join(homeDir, ".codex");
    const configPath = path.join(configDir, "config.toml");
    await fs.mkdir(configDir, { recursive: true });
    const existing = await readTextIfExists(configPath);
    const withFeature = ensureCodexHooksFeature(existing ?? "");
    const hookPath = path.join(stableDir, "codex", "heartbeat-hook.sh");
    // planai2.md Phase 0.3: the hook path written into ~/.codex/config.toml must be a
    // stable managed location, never the extension's own version-stamped install dir
    // or a dev worktree — those vanish on the next upgrade and leave Codex invoking a
    // missing script.
    assertStableManagedHookPath(hookPath, homeDir);
    const withHook = ensureCodexHook(withFeature, hookPath);
    await writeTextAtomically(configPath, withHook);
    logger.debug("agentSetup: configured Codex hook", { configPath });
}
/**
 * planai2.md Phase 0.3: throws when a hook path is not under the stable managed
 * plugin root (`~/.wakaclock/agent-plugins/`). Guards against a caller passing the
 * extension's version-stamped install directory (replaced wholesale on upgrade) or
 * a dev worktree / temp path.
 */
function assertStableManagedHookPath(hookPath, homeDir) {
    const managedRoot = path.join(homeDir, ".wakaclock", "agent-plugins") + path.sep;
    const resolved = path.resolve(hookPath);
    if (!resolved.startsWith(managedRoot)) {
        throw new Error(`refusing to register a Codex hook outside the managed plugin directory: ${resolved}`);
    }
}
function ensureCodexHooksFeature(config) {
    if (/^\s*hooks\s*=\s*true\s*$/m.test(config)) {
        return config;
    }
    // `codex_hooks` was the experimental feature name. Current Codex releases use
    // `[features].hooks`; migrate the managed setting instead of perpetuating the
    // deprecation warning for users who configured AI tracking on an older release.
    if (/^\s*codex_hooks\s*=\s*true\s*$/m.test(config)) {
        return config.replace(/^([ \t]*)codex_hooks([ \t]*)=([ \t]*)true([ \t]*)$/m, "$1hooks$2=$3true$4");
    }
    const featureHeader = /^\s*\[features\]\s*$/m.exec(config);
    if (featureHeader && featureHeader.index !== undefined) {
        const insertAt = featureHeader.index + featureHeader[0].length;
        return `${config.slice(0, insertAt)}\nhooks = true${config.slice(insertAt)}`;
    }
    return `${config.trimEnd()}\n\n[features]\nhooks = true\n`;
}
/**
 * planai2.md Phase 0.2b/0.3: a VS Code upgrade moves the bundled hook scripts to a
 * new version-stamped directory under `~/.wakaclock/agent-plugins/<version>/`, but
 * `ensureCodexHook` short-circuits once its markers are present and never touched a
 * `command = "…"` line that still points at the *previous* version's directory (or,
 * worse, a temporary VSIX/worktree path from a dev build). This repoints every
 * `command` line that sits inside an AtoAxis-managed block to the current script of
 * the same basename, and leaves every byte outside those blocks untouched — user
 * hooks, comments and unrelated tables are never rewritten.
 */
function refreshManagedCodexHookCommands(config, paths) {
    const managedMarkers = [
        "# AtoAxis managed AI attribution hook",
        "# AtoAxis managed AI shell sweep hooks",
    ];
    const byBasename = {
        "heartbeat-hook.sh": paths.heartbeat,
        "git-sweep-before.sh": paths.before,
        "git-sweep-after.sh": paths.after,
    };
    const lines = config.split("\n");
    let inManagedBlock = false;
    let blankRun = 0;
    for (let i = 0; i < lines.length; i += 1) {
        const trimmed = lines[i].trim();
        if (managedMarkers.some((marker) => trimmed.startsWith(marker))) {
            inManagedBlock = true;
            blankRun = 0;
            continue;
        }
        if (!inManagedBlock) {
            continue;
        }
        // The AtoAxis blocks contain single blank lines between their sub-tables, so a
        // lone blank does not end the block — but two in a row, EOF, or an unmanaged
        // `[table]` / `[[table]]` that is not one of ours does.
        if (trimmed === "") {
            blankRun += 1;
            if (blankRun >= 2) {
                inManagedBlock = false;
            }
            continue;
        }
        blankRun = 0;
        // Our generated blocks contain no comments after the opening marker and no
        // tables other than `[[hooks.*]]`, so either one means user content has begun.
        if (trimmed.startsWith("#")) {
            inManagedBlock = false;
            continue;
        }
        if (/^\[\[?/.test(trimmed) && !/^\[\[?hooks\./.test(trimmed)) {
            inManagedBlock = false;
            continue;
        }
        const match = /^([ \t]*command[ \t]*=[ \t]*)"(.*)"([ \t]*)$/.exec(lines[i]);
        if (!match) {
            continue;
        }
        const currentValue = match[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        const basename = currentValue.split("/").pop() ?? "";
        const wanted = byBasename[basename];
        if (wanted && wanted !== currentValue) {
            lines[i] = `${match[1]}${tomlString(wanted)}${match[3]}`;
        }
    }
    return lines.join("\n");
}
function ensureCodexHook(config, hookPath) {
    const attributionMarker = "# AtoAxis managed AI attribution hook";
    const sweepMarker = "# AtoAxis managed AI shell sweep hooks";
    const hookDir = path.dirname(hookPath);
    let updated = refreshManagedCodexHookCommands(config, {
        heartbeat: hookPath,
        before: path.join(hookDir, "git-sweep-before.sh"),
        after: path.join(hookDir, "git-sweep-after.sh"),
    });
    if (!updated.includes(attributionMarker)) {
        const block = [
            "",
            attributionMarker,
            "[[hooks.PostToolUse]]",
            'matcher = "apply_patch"',
            "[[hooks.PostToolUse.hooks]]",
            'type = "command"',
            `command = ${tomlString(hookPath)}`,
            "timeout = 60",
            ""
        ].join("\n");
        updated = `${updated.trimEnd()}\n${block}`;
    }
    // Shell/MCP tools can mutate files without an apply_patch payload. Snapshot the Git
    // worktree before the tool and compare it after, emitting inferred metadata events
    // only for files that changed during that call. Keep this in a separate managed
    // marker so existing installations get upgraded instead of returning early.
    if (!updated.includes(sweepMarker)) {
        const beforePath = path.join(hookDir, "git-sweep-before.sh");
        const afterPath = path.join(hookDir, "git-sweep-after.sh");
        const matcher = "Bash|shell_command|exec_command|unified_exec|code_mode_exec|mcp__.*";
        const block = [
            "",
            sweepMarker,
            "[[hooks.PreToolUse]]",
            `matcher = ${tomlString(matcher)}`,
            "[[hooks.PreToolUse.hooks]]",
            'type = "command"',
            `command = ${tomlString(beforePath)}`,
            "timeout = 60",
            "",
            "[[hooks.PostToolUse]]",
            `matcher = ${tomlString(matcher)}`,
            "[[hooks.PostToolUse.hooks]]",
            'type = "command"',
            `command = ${tomlString(afterPath)}`,
            "timeout = 60",
            ""
        ].join("\n");
        updated = `${updated.trimEnd()}\n${block}`;
    }
    return updated;
}
function tomlString(value) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
async function detectExecutable(command) {
    try {
        const result = await execFileAsync(command, ["--version"], { timeout: 4_000 });
        return { detected: true, path: command, reason: result.stdout.trim() };
    }
    catch (error) {
        return {
            detected: false,
            reason: error instanceof Error ? error.message : String(error)
        };
    }
}
async function runCommand(command, args, logger) {
    logger.debug("agentSetup: running integration command", { command, args });
    try {
        await execFileAsync(command, args, { timeout: 30_000 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${command} ${args.join(" ")} failed: ${message}`);
    }
}
async function runCommandAllowAlreadyConfigured(command, args, logger) {
    try {
        await runCommand(command, args, logger);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/(already|exists|installed|present)/i.test(message)) {
            throw error;
        }
        logger.debug("agentSetup: integration already configured", { command, args });
    }
}
async function readSetupState(homeDir) {
    const raw = await readTextIfExists(path.join(homeDir, ".wakaclock", "ai-agent-setup.json"));
    if (!raw) {
        return {};
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
async function writeSetupState(homeDir, configured) {
    const target = path.join(homeDir, ".wakaclock", "ai-agent-setup.json");
    await fs.mkdir(path.dirname(target), { recursive: true });
    const previous = await readSetupState(homeDir);
    const state = { ...previous };
    for (const id of configured) {
        state[id] = true;
    }
    await writeTextAtomically(target, `${JSON.stringify(state, null, 2)}\n`);
}
async function writeCliPath(homeDir, cliPath) {
    const trimmed = cliPath?.trim();
    if (!trimmed) {
        return;
    }
    const resolved = await resolveExecutablePath(trimmed);
    const target = path.join(homeDir, ".wakaclock", "cli-path");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await writeTextAtomically(target, `${resolved}\n`);
}
/**
 * Agent hooks frequently run with a smaller PATH than the VS Code extension host.
 * Persist an absolute executable when the configured value is a bare command so the
 * hook keeps working from Codex/Claude even when `wakaclock` is not on their PATH.
 */
async function resolveExecutablePath(command) {
    if (path.isAbsolute(command) || command.includes(path.sep)) {
        return command;
    }
    const extensions = process.platform === "win32"
        ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
        : [""];
    for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
        if (!directory) {
            continue;
        }
        for (const extension of extensions) {
            const candidate = path.join(directory, `${command}${extension}`);
            try {
                await fs.access(candidate);
                return candidate;
            }
            catch {
                // Keep searching the remaining PATH entries.
            }
        }
    }
    return command;
}
async function codexHookIsConfigured(homeDir) {
    const config = await readTextIfExists(path.join(homeDir, ".codex", "config.toml"));
    return Boolean(config?.includes("# AtoAxis managed AI attribution hook"));
}
async function readTextIfExists(filePath) {
    try {
        return await fs.readFile(filePath, "utf8");
    }
    catch {
        return undefined;
    }
}
async function writeTextAtomically(filePath, content) {
    const tempPath = `${filePath}.tmp-${process.pid}`;
    await fs.writeFile(tempPath, content, "utf8");
    await fs.rename(tempPath, filePath);
}
async function pathExists(target) {
    try {
        await fs.access(target);
        return true;
    }
    catch {
        return false;
    }
}
// The exec bit on the shipped .sh hook scripts doesn't reliably survive being
// zipped into a VSIX and extracted on install, so it's reapplied here rather than
// trusted to come through from the source copy.
async function makeShellScriptsExecutable(rootDir) {
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
//# sourceMappingURL=agentSetup.js.map