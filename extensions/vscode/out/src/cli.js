"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WakaclockCliService = void 0;
const node_child_process_1 = require("node:child_process");
class WakaclockCliService {
    getConfig;
    logger;
    getApiKey;
    constructor(getConfig, logger, 
    // Optional so existing 2-arg call sites (tests) keep working unauthenticated.
    getApiKey = () => Promise.resolve(undefined)) {
        this.getConfig = getConfig;
        this.logger = logger;
        this.getApiKey = getApiKey;
    }
    async sendHeartbeat(primaryEntity, primaryWrite, primaryCategory, extraHeartbeats = [], primaryExtra = {}) {
        const args = [
            "heartbeat",
            "--entity",
            primaryEntity,
            "--category",
            primaryCategory,
        ];
        if (primaryExtra.project) {
            args.push("--project", primaryExtra.project);
        }
        if (primaryWrite) {
            args.push("--write");
        }
        this.pushOptionalNumber(args, "--line-number", primaryExtra.line_number);
        this.pushOptionalNumber(args, "--cursor-position", primaryExtra.cursor_position);
        this.pushOptionalNumber(args, "--keystrokes", primaryExtra.keystrokes);
        this.pushOptionalNumber(args, "--chars-added", primaryExtra.chars_added);
        this.pushOptionalNumber(args, "--chars-deleted", primaryExtra.chars_deleted);
        this.pushOptionalNumber(args, "--active-seconds", primaryExtra.active_seconds);
        this.pushOptionalString(args, "--ai-agent", primaryExtra.ai_agent);
        this.pushOptionalString(args, "--ai-provider", primaryExtra.ai_provider);
        this.pushOptionalString(args, "--ai-model", primaryExtra.ai_model);
        this.pushOptionalString(args, "--ai-source", primaryExtra.ai_source);
        this.pushOptionalString(args, "--ai-confidence", primaryExtra.ai_confidence);
        this.pushOptionalString(args, "--ai-event-id", primaryExtra.ai_event_id);
        this.pushOptionalNumber(args, "--ai-lines-added", primaryExtra.ai_lines_added);
        this.pushOptionalNumber(args, "--ai-lines-deleted", primaryExtra.ai_lines_deleted);
        this.pushOptionalNumber(args, "--human-lines-added", primaryExtra.human_lines_added);
        this.pushOptionalNumber(args, "--human-lines-deleted", primaryExtra.human_lines_deleted);
        this.pushOptionalNumber(args, "--unattributed-lines-added", primaryExtra.unattributed_lines_added);
        this.pushOptionalNumber(args, "--unattributed-lines-deleted", primaryExtra.unattributed_lines_deleted);
        const stdinPayload = extraHeartbeats.length > 0
            ? JSON.stringify(extraHeartbeats, null, 2)
            : undefined;
        if (stdinPayload) {
            args.push("--extra-heartbeats");
        }
        return this.runCli(args, stdinPayload);
    }
    async getToday() {
        const result = await this.runCli(["today"]);
        const lines = this.parseKeyValueLines(result.stdout);
        return {
            humanReadable: lines.Today ?? "0s",
            totalSeconds: Number(lines["Total seconds"] ?? "0"),
            heartbeatCount: Number(lines.Heartbeats ?? "0"),
        };
    }
    // Mirrors the key into ~/.wakaclock/config.toml on disk, in addition to VS Code's
    // own SecretStorage. Needed because AI agent hooks (extensions/ai-agents/) are
    // invoked by Claude Code/Codex/Gemini CLI directly, outside this extension's
    // process tree, so they can never inherit the WAKACLOCK_API_KEY env var this
    // extension passes to its own spawned CLI calls (see runCli below) — config.toml
    // is the only channel those hooks can read a key from.
    async setApiKey(key) {
        await this.runCli(["config", "set-key", key]);
    }
    /**
     * Mirror a key into config.toml and then confirm the server actually accepts it.
     *
     * Saving a key used to succeed silently whether or not it worked: a wrong or
     * revoked key produced no error anywhere, heartbeats just stopped being stored
     * (the CLI queues failed sends and exits 0), and the only symptom was an empty
     * dashboard hours later. Regenerating a key on the dashboard invalidates the
     * previous one, so this is easy to hit by accident. Verifying once, at the moment
     * the user pastes the key, turns that silent failure into an immediate answer.
     */
    async syncAndVerifyApiKey(key) {
        const result = { mirroredToCliConfig: true, verified: false };
        try {
            await this.setApiKey(key);
        }
        catch (error) {
            result.mirroredToCliConfig = false;
            result.mirrorError = error instanceof Error ? error.message : String(error);
        }
        try {
            await this.getToday();
            result.verified = true;
        }
        catch (error) {
            result.verifyError = error instanceof Error ? error.message : String(error);
        }
        return result;
    }
    async clearApiKey() {
        await this.runCli(["config", "clear-key"]);
    }
    async getStatus() {
        const result = await this.runCli(["status"]);
        const lines = this.parseKeyValueLines(result.stdout);
        return {
            configPath: lines["Config path"],
            serverUrl: lines["Server URL"],
            userId: lines["User ID"],
            queuedHeartbeats: this.parseNumber(lines["Queued heartbeats"]),
            flushedNow: this.parseNumber(lines["Flushed now"]),
        };
    }
    async runCli(args, stdinPayload) {
        const { cliPath } = this.getConfig();
        // Passed as an env var, not a `--api-key` CLI flag: process argv is visible to
        // any other process on the machine via `ps`, an env var passed directly to the
        // child is not.
        const apiKey = await this.getApiKey();
        this.logger.debug("spawning wakaclock-cli", {
            cliPath,
            args,
            hasStdin: Boolean(stdinPayload),
            hasApiKey: Boolean(apiKey),
        });
        return new Promise((resolve, reject) => {
            const child = (0, node_child_process_1.spawn)(cliPath, args, {
                stdio: "pipe",
                env: {
                    ...process.env,
                    WAKACLOCK_EDITOR: "vscode",
                    ...(apiKey ? { WAKACLOCK_API_KEY: apiKey } : {}),
                },
            });
            let stdout = "";
            let stderr = "";
            child.stdout.setEncoding("utf8");
            child.stderr.setEncoding("utf8");
            child.stdout.on("data", (chunk) => {
                stdout += chunk;
            });
            child.stderr.on("data", (chunk) => {
                stderr += chunk;
            });
            child.on("error", (error) => {
                reject(new Error(`Failed to start wakaclock-cli at "${cliPath}". ${error.message}. Configure wakaclock.cliPath if needed.`));
            });
            child.on("close", (code) => {
                const exitCode = code ?? -1;
                if (exitCode !== 0) {
                    reject(new Error(`wakaclock-cli exited with code ${exitCode}. ${stderr.trim() || stdout.trim()}`));
                    return;
                }
                resolve({ stdout, stderr, exitCode });
            });
            if (stdinPayload) {
                child.stdin.write(stdinPayload);
            }
            child.stdin.end();
        });
    }
    parseKeyValueLines(stdout) {
        return stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .reduce((accumulator, line) => {
            const separator = line.indexOf(":");
            if (separator === -1) {
                return accumulator;
            }
            const key = line.slice(0, separator).trim();
            const value = line.slice(separator + 1).trim();
            accumulator[key] = value;
            return accumulator;
        }, {});
    }
    parseNumber(value) {
        if (!value) {
            return undefined;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    pushOptionalNumber(args, flag, value) {
        if (value === undefined) {
            return;
        }
        args.push(flag, String(value));
    }
    pushOptionalString(args, flag, value) {
        const trimmed = value?.trim();
        if (!trimmed) {
            return;
        }
        args.push(flag, trimmed);
    }
}
exports.WakaclockCliService = WakaclockCliService;
//# sourceMappingURL=cli.js.map