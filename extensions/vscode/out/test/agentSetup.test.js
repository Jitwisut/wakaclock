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
const fs = __importStar(require("node:fs/promises"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const vitest_1 = require("vitest");
const agentSetup_1 = require("../src/agentSetup");
const logging_1 = require("../src/logging");
let workDir;
(0, vitest_1.beforeEach)(async () => {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-agent-setup-"));
});
(0, vitest_1.afterEach)(async () => {
    await fs.rm(workDir, { recursive: true, force: true });
});
function setup() {
    return {
        extensionPath: path.join(workDir, "extension"),
        homeDir: path.join(workDir, "home"),
        logger: new logging_1.Logger(() => false)
    };
}
async function writeBundledSource(extensionPath) {
    const sourceDir = path.join(extensionPath, "resources", "ai-agents");
    await fs.mkdir(path.join(sourceDir, "codex"), { recursive: true });
    await fs.writeFile(path.join(sourceDir, "README.md"), "hello\n");
    await fs.writeFile(path.join(sourceDir, "codex", "heartbeat-hook.sh"), "#!/usr/bin/env bash\n");
}
async function runHook(script, input, env) {
    await new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)("bash", [script], { env });
        let stderr = "";
        child.stderr.on("data", (chunk) => {
            stderr += String(chunk);
        });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`hook exited ${code}: ${stderr}`));
            }
        });
        child.stdin.end(JSON.stringify(input));
    });
}
(0, vitest_1.describe)("syncAgentPluginsToStableDir", () => {
    (0, vitest_1.it)("returns undefined and creates nothing when bundled resources are absent", async () => {
        const { extensionPath, homeDir, logger } = setup();
        const result = await (0, agentSetup_1.syncAgentPluginsToStableDir)({
            extensionPath,
            extensionVersion: "1.2.3",
            homeDir,
            logger
        });
        (0, vitest_1.expect)(result).toBeUndefined();
        await (0, vitest_1.expect)(fs.access(path.join(homeDir, ".wakaclock"))).rejects.toThrow();
    });
    (0, vitest_1.it)("copies bundled resources into a version-pinned dir and makes .sh files executable", async () => {
        const { extensionPath, homeDir, logger } = setup();
        await writeBundledSource(extensionPath);
        const result = await (0, agentSetup_1.syncAgentPluginsToStableDir)({
            extensionPath,
            extensionVersion: "1.2.3",
            homeDir,
            logger
        });
        const expectedTarget = path.join(homeDir, ".wakaclock", "agent-plugins", "1.2.3");
        (0, vitest_1.expect)(result).toBe(expectedTarget);
        const readme = await fs.readFile(path.join(expectedTarget, "README.md"), "utf8");
        (0, vitest_1.expect)(readme).toBe("hello\n");
        const scriptStat = await fs.stat(path.join(expectedTarget, "codex", "heartbeat-hook.sh"));
        (0, vitest_1.expect)(scriptStat.mode & 0o111).toBeTruthy();
    });
    (0, vitest_1.it)("does not re-copy or overwrite an existing version dir", async () => {
        const { extensionPath, homeDir, logger } = setup();
        await writeBundledSource(extensionPath);
        const targetDir = path.join(homeDir, ".wakaclock", "agent-plugins", "1.2.3");
        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(path.join(targetDir, "README.md"), "already here, don't touch\n");
        const result = await (0, agentSetup_1.syncAgentPluginsToStableDir)({
            extensionPath,
            extensionVersion: "1.2.3",
            homeDir,
            logger
        });
        (0, vitest_1.expect)(result).toBe(targetDir);
        const readme = await fs.readFile(path.join(targetDir, "README.md"), "utf8");
        (0, vitest_1.expect)(readme).toBe("already here, don't touch\n");
    });
    (0, vitest_1.it)("gives each extension version its own stable dir", async () => {
        const { extensionPath, homeDir, logger } = setup();
        await writeBundledSource(extensionPath);
        const first = await (0, agentSetup_1.syncAgentPluginsToStableDir)({
            extensionPath,
            extensionVersion: "1.0.0",
            homeDir,
            logger
        });
        const second = await (0, agentSetup_1.syncAgentPluginsToStableDir)({
            extensionPath,
            extensionVersion: "2.0.0",
            homeDir,
            logger
        });
        (0, vitest_1.expect)(first).not.toBe(second);
        await (0, vitest_1.expect)(fs.access(first)).resolves.toBeUndefined();
        await (0, vitest_1.expect)(fs.access(second)).resolves.toBeUndefined();
    });
});
(0, vitest_1.describe)("Codex hook config helpers", () => {
    (0, vitest_1.it)("adds the current hooks feature without duplicating an existing features table", () => {
        const config = "[features]\nother = true\n";
        const updated = (0, agentSetup_1.ensureCodexHooksFeature)(config);
        (0, vitest_1.expect)(updated).toContain("[features]\nhooks = true\nother = true");
        (0, vitest_1.expect)((0, agentSetup_1.ensureCodexHooksFeature)(updated)).toBe(updated);
    });
    (0, vitest_1.it)("migrates the deprecated codex_hooks feature name", () => {
        const updated = (0, agentSetup_1.ensureCodexHooksFeature)("[features]\ncodex_hooks = true\nother = true\n");
        (0, vitest_1.expect)(updated).toContain("[features]\nhooks = true\nother = true");
        (0, vitest_1.expect)(updated).not.toContain("codex_hooks = true");
    });
    (0, vitest_1.it)("adds idempotent apply-patch and shell-sweep hook blocks", () => {
        const config = (0, agentSetup_1.ensureCodexHooksFeature)("");
        const updated = (0, agentSetup_1.ensureCodexHook)(config, "/tmp/Ato Axis/heartbeat-hook.sh");
        (0, vitest_1.expect)(updated).toContain("# AtoAxis managed AI attribution hook");
        (0, vitest_1.expect)(updated).toContain('matcher = "^apply_patch$"');
        (0, vitest_1.expect)(updated).toContain('command = "/tmp/Ato Axis/heartbeat-hook.sh"');
        (0, vitest_1.expect)(updated).toContain("# AtoAxis managed AI shell sweep hooks");
        (0, vitest_1.expect)(updated).toContain('matcher = "Bash|shell_command|exec_command|unified_exec|code_mode_exec|mcp__.*"');
        (0, vitest_1.expect)(updated).toContain('command = "/tmp/Ato Axis/git-sweep-before.sh"');
        (0, vitest_1.expect)(updated).toContain('command = "/tmp/Ato Axis/git-sweep-after.sh"');
        (0, vitest_1.expect)(updated).toContain("# AtoAxis managed AI shell failure cleanup");
        (0, vitest_1.expect)(updated).toContain('command = "/tmp/Ato Axis/tool-abort.sh"');
        (0, vitest_1.expect)((0, agentSetup_1.ensureCodexHook)(updated, "/tmp/Ato Axis/heartbeat-hook.sh")).toBe(updated);
    });
    (0, vitest_1.it)("upgrades an existing attribution-only config with shell sweep hooks", () => {
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
        const updated = (0, agentSetup_1.ensureCodexHook)(legacy, "/tmp/Ato Axis/heartbeat-hook.sh");
        (0, vitest_1.expect)(updated).toContain("# AtoAxis managed AI shell sweep hooks");
    });
    (0, vitest_1.it)("anchors a legacy managed apply-patch matcher so current Codex fires it", () => {
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
        const updated = (0, agentSetup_1.ensureCodexHook)(legacy, "/tmp/heartbeat-hook.sh");
        (0, vitest_1.expect)(updated).toContain('matcher = "^apply_patch$"');
        (0, vitest_1.expect)((0, agentSetup_1.ensureCodexHook)(updated, "/tmp/heartbeat-hook.sh")).toBe(updated);
    });
    (0, vitest_1.it)("repoints a stale managed hook path from an old plugin version, preserving user config", () => {
        const oldRoot = "/home/u/.wakaclock/agent-plugins/1.0.0/codex";
        const newRoot = "/home/u/.wakaclock/agent-plugins/2.0.0/codex";
        const withOld = (0, agentSetup_1.ensureCodexHook)((0, agentSetup_1.ensureCodexHooksFeature)(""), `${oldRoot}/heartbeat-hook.sh`);
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
        const after = (0, agentSetup_1.ensureCodexHook)(before, `${newRoot}/heartbeat-hook.sh`);
        (0, vitest_1.expect)(after).toContain(`command = "${newRoot}/heartbeat-hook.sh"`);
        (0, vitest_1.expect)(after).toContain(`command = "${newRoot}/git-sweep-before.sh"`);
        (0, vitest_1.expect)(after).toContain(`command = "${newRoot}/git-sweep-after.sh"`);
        (0, vitest_1.expect)(after).not.toContain("1.0.0");
        // Untouched user content.
        (0, vitest_1.expect)(after).toContain('command = "/opt/me/notify.sh"');
        (0, vitest_1.expect)(after).toContain('persistence = "save-all"');
        // Idempotent once repointed.
        (0, vitest_1.expect)((0, agentSetup_1.ensureCodexHook)(after, `${newRoot}/heartbeat-hook.sh`)).toBe(after);
    });
    (0, vitest_1.it)("refreshManagedCodexHookCommands leaves an unmanaged command line alone", () => {
        const config = [
            "# not ours",
            "[[hooks.PostToolUse]]",
            'command = "/opt/me/heartbeat-hook.sh"',
            ""
        ].join("\n");
        (0, vitest_1.expect)((0, agentSetup_1.refreshManagedCodexHookCommands)(config, {
            heartbeat: "/x/heartbeat-hook.sh",
            before: "/x/git-sweep-before.sh",
            after: "/x/git-sweep-after.sh"
        })).toBe(config);
    });
    (0, vitest_1.it)("assertStableManagedHookPath rejects a worktree/VSIX path and accepts the managed dir", () => {
        const home = "/home/u";
        (0, vitest_1.expect)(() => (0, agentSetup_1.assertStableManagedHookPath)(`${home}/.wakaclock/agent-plugins/3.1.0/codex/heartbeat-hook.sh`, home)).not.toThrow();
        (0, vitest_1.expect)(() => (0, agentSetup_1.assertStableManagedHookPath)("/private/var/folders/x/T/vsix-unpack/codex/heartbeat-hook.sh", home)).toThrow(/managed plugin directory/);
        (0, vitest_1.expect)(() => (0, agentSetup_1.assertStableManagedHookPath)(`${home}/dev/atoaxis/extensions/ai-agents/codex/heartbeat-hook.sh`, home)).toThrow(/managed plugin directory/);
    });
});
(0, vitest_1.describe)("adapter registry consumption (planai2 p1.5)", () => {
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
    (0, vitest_1.it)("parseAdapterList reads the CLI output and tolerates garbage", () => {
        const parsed = (0, agentSetup_1.parseAdapterList)(listJson);
        (0, vitest_1.expect)(parsed.map((m) => m.id)).toEqual(["claude-code", "codex", "gemini-cli"]);
        (0, vitest_1.expect)((0, agentSetup_1.parseAdapterList)("not json")).toEqual([]);
        (0, vitest_1.expect)((0, agentSetup_1.parseAdapterList)("{}")).toEqual([]);
    });
    (0, vitest_1.it)("pluginInstallCommand splits the manifest args and skips non-plugin strategies", () => {
        const [claude, codex, gemini] = (0, agentSetup_1.parseAdapterList)(listJson);
        (0, vitest_1.expect)((0, agentSetup_1.pluginInstallCommand)(claude)).toEqual({
            program: "claude",
            args: ["plugin", "install", "atoaxis-heartbeat@atoaxis-plugins"]
        });
        // gemini's manifest carries no trailing path — the installer appends it.
        (0, vitest_1.expect)((0, agentSetup_1.pluginInstallCommand)(gemini)).toEqual({
            program: "gemini",
            args: ["extensions", "install"]
        });
        // codex installs via a config hook block, not a plugin command.
        (0, vitest_1.expect)((0, agentSetup_1.pluginInstallCommand)(codex)).toBeUndefined();
        (0, vitest_1.expect)((0, agentSetup_1.pluginInstallCommand)(undefined)).toBeUndefined();
    });
});
(0, vitest_1.describe)("AI shell snapshot adapters", () => {
    (0, vitest_1.it)("forwards stable matching Before/After tool metadata to the CLI engine", async () => {
        const homeDir = path.join(workDir, "home");
        const fakeCli = path.join(workDir, "fake-wakaclock");
        const callsLog = path.join(workDir, "snapshot-calls.log");
        await fs.mkdir(path.join(homeDir, ".wakaclock"), { recursive: true });
        await fs.writeFile(fakeCli, '#!/usr/bin/env bash\npayload="$(cat)"\nprintf "%s\\t%s\\n" "$*" "$payload" >> "$WAKACLOCK_TEST_CALLS"\n');
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
            return { args, payload: JSON.parse(payload) };
        });
        (0, vitest_1.expect)(calls).toHaveLength(2);
        (0, vitest_1.expect)(calls[0].args).toBe("ai tool-before --json");
        (0, vitest_1.expect)(calls[1].args).toBe("ai tool-after --json");
        (0, vitest_1.expect)(calls[0].payload.tool_event_id).toBe(calls[1].payload.tool_event_id);
        (0, vitest_1.expect)(calls[0].payload).toMatchObject({
            agent: "codex",
            provider: "openai",
            session_id: "session-1",
            tool: "shell_command",
            transport: "shell_hook",
            cwd: workDir
        });
    });
});
(0, vitest_1.describe)("Codex heartbeat hook", () => {
    (0, vitest_1.it)("emits one heartbeat with per-file deltas for every file in a patch", async () => {
        const homeDir = path.join(workDir, "home");
        const fakeCli = path.join(workDir, "fake-wakaclock");
        const callsLog = path.join(workDir, "calls.log");
        await fs.mkdir(path.join(homeDir, ".wakaclock"), { recursive: true });
        await fs.writeFile(fakeCli, '#!/usr/bin/env bash\npayload="$(cat)"\nprintf "%s\\t%s\\n" "$*" "$payload" >> "$WAKACLOCK_TEST_CALLS"\n');
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
        await runHook(script, {
            cwd: workDir,
            session_id: "session-1",
            tool_use_id: "apply-1",
            tool_input: { input: patch },
            model: "gpt-test"
        }, {
            ...process.env,
            HOME: homeDir,
            WAKACLOCK_TEST_CALLS: callsLog
        });
        const calls = (await fs.readFile(callsLog, "utf8"))
            .trim()
            .split("\n")
            .map((line) => {
            const [args, payload] = line.split("\t", 2);
            return { args, payload: JSON.parse(payload) };
        });
        (0, vitest_1.expect)(calls).toHaveLength(2);
        (0, vitest_1.expect)(calls.map((call) => call.args)).toEqual(["ai emit --json", "ai emit --json"]);
        (0, vitest_1.expect)(calls.map((call) => call.payload)).toMatchObject([
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
//# sourceMappingURL=agentSetup.test.js.map