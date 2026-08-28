import { spawn } from "node:child_process";
import type {
    ApiKeySyncResult,
    ActivitySegment,
    CliResult,
    ExtraHeartbeatPayload,
    HeartbeatCategory,
    StatusBarSnapshot,
    StatusSnapshot,
    WakaclockConfigSnapshot,
    VerifyResult,
} from "./types";
import { Logger } from "./logging";
import type { CliPathResolver } from "./managedCli";

export class WakaclockCliService {
    public constructor(
        private readonly getConfig: () => WakaclockConfigSnapshot,
        private readonly logger: Logger,
        // Optional so existing 2-arg call sites (tests) keep working unauthenticated.
        private readonly getApiKey: () => Thenable<
            string | undefined
        > = () => Promise.resolve(undefined),
        private readonly managedCli?: CliPathResolver,
        /**
         * Stamped into every heartbeat's `user_agent`. A running extension host keeps
         * the JS it loaded at window start, so a rebuilt extension can go unused for
         * hours; without this the stored heartbeats give no hint which build sent them.
         */
        private readonly pluginId?: string,
    ) {}

    public async sendHeartbeat(
        primaryEntity: string,
        primaryWrite: boolean,
        primaryCategory: HeartbeatCategory,
        extraHeartbeats: ExtraHeartbeatPayload[] = [],
        primaryExtra: Partial<ExtraHeartbeatPayload> = {},
    ): Promise<CliResult> {
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

        this.pushOptionalNumber(
            args,
            "--line-number",
            primaryExtra.line_number,
        );
        this.pushOptionalNumber(
            args,
            "--cursor-position",
            primaryExtra.cursor_position,
        );
        this.pushOptionalNumber(args, "--keystrokes", primaryExtra.keystrokes);
        this.pushOptionalNumber(
            args,
            "--chars-added",
            primaryExtra.chars_added,
        );
        this.pushOptionalNumber(
            args,
            "--chars-deleted",
            primaryExtra.chars_deleted,
        );
        this.pushOptionalNumber(
            args,
            "--active-seconds",
            primaryExtra.active_seconds,
        );
        this.pushOptionalString(args, "--heartbeat-id", primaryExtra.heartbeat_id);
        this.pushOptionalString(args, "--plugin", this.pluginId);
        if (primaryExtra.activity_segments?.length) {
            args.push("--activity-segments", JSON.stringify(primaryExtra.activity_segments));
        }
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
        this.pushOptionalNumber(
            args,
            "--unattributed-lines-added",
            primaryExtra.unattributed_lines_added,
        );
        this.pushOptionalNumber(
            args,
            "--unattributed-lines-deleted",
            primaryExtra.unattributed_lines_deleted,
        );

        const stdinPayload =
            extraHeartbeats.length > 0
                ? JSON.stringify(extraHeartbeats, null, 2)
                : undefined;
        if (stdinPayload) {
            args.push("--extra-heartbeats");
        }

        return this.runCli(args, stdinPayload);
    }

    public async getToday(timezone?: string): Promise<StatusBarSnapshot> {
        const args = ["today"];
        if (timezone?.trim()) {
            args.push("--timezone", timezone.trim());
        }
        let legacyCli = false;
        let result: CliResult;
        try {
            result = await this.runCli(args);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                !timezone ||
                !/unexpected argument|found argument.*timezone|usage:/i.test(message)
            ) {
                throw error;
            }
            // Older binaries predate timezone/JSON support. Keep the status bar
            // useful while explicitly surfacing that the CLI should be upgraded.
            legacyCli = true;
            this.logger.warn("wakaclock-cli does not support --timezone; using UTC fallback", {
                error: message
            });
            result = await this.runCli(["today"]);
        }
        const lines = this.parseKeyValueLines(result.stdout);
        const queuedSeconds = lines["Queued seconds"];
        const confirmedSeconds = lines["Confirmed seconds"];
        const lastHeartbeatAt = lines["Last heartbeat at"];
        const agentState = lines.Agent;
        const coveredIntervals = this.parseJson<ActivitySegment[]>(lines["Covered intervals"]);
        return {
            humanReadable: lines.Today ?? "0s",
            totalSeconds: Number(lines["Total seconds"] ?? "0"),
            heartbeatCount: Number(lines.Heartbeats ?? "0"),
            ...(confirmedSeconds === undefined
                ? {}
                : { confirmedSeconds: Number(confirmedSeconds) }),
            ...(queuedSeconds === undefined
                ? {}
                : { queuedSeconds: Number(queuedSeconds) }),
            ...(lastHeartbeatAt === undefined
                ? {}
                : { lastHeartbeatAt: Number(lastHeartbeatAt) }),
            ...(agentState === undefined
                ? {}
                : { agentHealth: { state: agentState } }),
            ...(coveredIntervals === undefined ? {} : { coveredIntervals }),
            ...(lines["Last increment seconds"] === undefined
                ? {}
                : { lastIncrementSeconds: Number(lines["Last increment seconds"]) }),
            ...(lines["Last increment source"] === undefined
                ? {}
                : { lastIncrementSource: lines["Last increment source"] }),
            ...(lines["Discarded seconds"] === undefined
                ? {}
                : { discardedSeconds: Number(lines["Discarded seconds"]) }),
            // Queue *depth*, which `Queued seconds` cannot stand in for: that figure is
            // scoped to today, so a backlog the server refused yesterday reports zero and
            // the status bar looked perfectly healthy while nothing was being recorded.
            ...(lines["Queued heartbeats"] === undefined
                ? {}
                : { queuedHeartbeats: Number.parseInt(lines["Queued heartbeats"], 10) }),
            ...(lines.Delivery === undefined ? {} : { delivery: lines.Delivery }),
            ...(legacyCli ? { legacyCli: true } : {}),
        };
    }

    // Mirrors the key into ~/.wakaclock/config.toml on disk, in addition to VS Code's
    // own SecretStorage. Needed because AI agent hooks (extensions/ai-agents/) are
    // invoked by Claude Code/Codex/Gemini CLI directly, outside this extension's
    // process tree, so they can never inherit the WAKACLOCK_API_KEY env var this
    // extension passes to its own spawned CLI calls (see runCli below) — config.toml
    // is the only channel those hooks can read a key from.
    public async setApiKey(key: string): Promise<void> {
        // Compatibility for callers that construct this service without the
        // ManagedCliManager (older integrations/tests). The published Extension
        // always supplies the manager and therefore uses the stdin path below.
        if (!this.managedCli) {
            await this.runCli(["config", "set-key", key]);
            return;
        }
        await this.persistApiKey(key);
    }

    /** Persist credentials only after the user has explicitly enabled an AI agent. */
    public async persistApiKey(key: string): Promise<void> {
        await this.runCli(
            ["config", "set-key", "--stdin", "--json"],
            `${key.trim()}\n`,
        );
        const serverUrl = this.getConfig().serverUrl?.trim();
        if (serverUrl) {
            await this.runCli(["config", "set-server-url", serverUrl, "--json"]);
        }
    }

    /** Verify a candidate through the managed CLI without writing it to config.toml. */
    public async verifyApiKey(key?: string): Promise<VerifyResult> {
        try {
            const result = await this.runCli(
                ["verify", "--json"],
                undefined,
                key,
            );
            const parsed = this.parseJson<VerifyResult>(result.stdout.trim());
            if (
                parsed?.status &&
                new Set([
                    "verified",
                    "invalid_key",
                    "subscription_required",
                    "unreachable",
                    "server_error",
                    "incompatible",
                ]).has(parsed.status)
            ) {
                return parsed;
            }
            return {
                status: "incompatible",
                error: "wakaclock-cli returned an invalid verify response",
            };
        } catch (error) {
            return {
                status: "incompatible",
                error: error instanceof Error ? error.message : String(error),
            };
        }
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
    public async syncAndVerifyApiKey(key: string): Promise<ApiKeySyncResult> {
        // Keep the pre-managed-CLI contract for external embedders. A packaged
        // AtoAxis activation always takes the secure candidate-verification branch.
        if (!this.managedCli) {
            const legacy: ApiKeySyncResult = { mirroredToCliConfig: true, verified: false };
            try {
                await this.setApiKey(key);
            } catch (error) {
                legacy.mirroredToCliConfig = false;
                legacy.mirrorError = error instanceof Error ? error.message : String(error);
            }
            try {
                await this.getToday();
                legacy.verified = true;
            } catch (error) {
                legacy.verifyError = error instanceof Error ? error.message : String(error);
            }
            return legacy;
        }
        const verification = await this.verifyApiKey(key);
        const verified = verification.status === "verified";
        const pending =
            verification.status === "unreachable" || verification.status === "server_error";
        return {
            // The key deliberately remains in SecretStorage until an AI integration
            // is consented to. Ordinary editor heartbeats inherit it through env.
            mirroredToCliConfig: false,
            verified,
            status: verification.status,
            pending,
            serverUrl: verification.server_url ?? this.getConfig().serverUrl,
            ...(verification.error ? { verifyError: verification.error } : {}),
        };
    }

    public async clearApiKey(): Promise<void> {
        await this.runCli(["config", "clear-key"]);
    }

    public async getStatus(): Promise<StatusSnapshot> {
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

    public async installAgent(): Promise<CliResult> {
        return this.runCli(["agent", "install", "--json"]);
    }

    /**
     * Hosts without LaunchAgent/systemd/Task Scheduler (containers, Codespaces and
     * some remote SSH sessions) keep the watcher alive with the Extension Host. It
     * is intentionally a separate child from ordinary heartbeat requests.
     */
    public async startExtensionOwnedAgent(): Promise<{ dispose(): void }> {
        const config = this.getConfig();
        const cliPath = this.managedCli
            ? await this.managedCli.ensureReady()
            : config.cliPath || "wakaclock";
        const apiKey = await this.getApiKey();
        const child = spawn(cliPath, ["agent", "run"], {
            stdio: "ignore",
            detached: false,
            env: {
                ...process.env,
                WAKACLOCK_EDITOR: "vscode",
                WAKACLOCK_SERVER_URL:
                    config.serverUrl?.trim() || "https://api.atoaxis.com",
                ...(apiKey ? { WAKACLOCK_API_KEY: apiKey } : {}),
            },
        });
        child.on("error", (error) => {
            this.logger.warn("extension-owned AtoAxis agent stopped unexpectedly", {
                error: error.message,
            });
        });
        this.logger.debug("started extension-owned AtoAxis agent", { cliPath });
        return {
            dispose: () => {
                if (!child.killed) {
                    child.kill();
                }
            },
        };
    }

    private async runCli(
        args: string[],
        stdinPayload?: string,
        apiKeyOverride?: string,
    ): Promise<CliResult> {
        const config = this.getConfig();
        const cliPath = this.managedCli
            ? await this.managedCli.ensureReady()
            : config.cliPath || "wakaclock";
        // Passed as an env var, not a `--api-key` CLI flag: process argv is visible to
        // any other process on the machine via `ps`, an env var passed directly to the
        // child is not.
        const apiKey = apiKeyOverride ?? (await this.getApiKey());
        this.logger.debug("spawning wakaclock-cli", {
            cliPath,
            args,
            hasStdin: Boolean(stdinPayload),
            hasApiKey: Boolean(apiKey),
        });

        return new Promise<CliResult>((resolve, reject) => {
            const child = spawn(cliPath, args, {
                stdio: "pipe",
                env: {
                    ...process.env,
                    WAKACLOCK_EDITOR: "vscode",
                    WAKACLOCK_SERVER_URL:
                        config.serverUrl?.trim() || "https://api.atoaxis.com",
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
                reject(
                    new Error(
                        `Failed to start wakaclock-cli at "${cliPath}". ${error.message}. The bundled AtoAxis CLI may be unavailable; check the Extension installation or use the advanced cliPath override.`,
                    ),
                );
            });

            child.on("close", (code) => {
                const exitCode = code ?? -1;
                if (exitCode !== 0) {
                    reject(
                        new Error(
                            `wakaclock-cli exited with code ${exitCode}. ${stderr.trim() || stdout.trim()}`,
                        ),
                    );
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

    private parseKeyValueLines(stdout: string): Record<string, string> {
        return stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .reduce<Record<string, string>>((accumulator, line) => {
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

    private parseNumber(value?: string): number | undefined {
        if (!value) {
            return undefined;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    private parseJson<T>(value?: string): T | undefined {
        if (!value?.trim()) {
            return undefined;
        }
        try {
            return JSON.parse(value) as T;
        } catch {
            this.logger.warn("wakaclock-cli returned malformed JSON field", { value });
            return undefined;
        }
    }

    private pushOptionalNumber(
        args: string[],
        flag: string,
        value?: number,
    ): void {
        if (value === undefined) {
            return;
        }
        args.push(flag, String(value));
    }

    private pushOptionalString(
        args: string[],
        flag: string,
        value?: string,
    ): void {
        const trimmed = value?.trim();
        if (!trimmed) {
            return;
        }
        args.push(flag, trimmed);
    }
}
