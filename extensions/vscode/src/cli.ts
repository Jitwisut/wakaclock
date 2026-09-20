import { spawn } from "node:child_process";
import type {
    ApiKeySyncResult,
    ActivitySegment,
    CliResult,
    ExtraHeartbeatPayload,
    HeartbeatCategory,
    StatusBarSnapshot,
    StatusSnapshot,
    BrokerStatusSnapshot,
    EditorObservationPayload,
    EditorObservationStatus,
    WakaclockConfigSnapshot,
    VerifyResult,
} from "./types";
import { Logger } from "./logging";
import type { CliPathResolver } from "./managedCli";
import type { AiDiagnosticsSnapshot } from "./aiDetectionSelfTest";

export class WakaclockCliService {
    private clipboardCapability: boolean | undefined;
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
        private readonly executionSurface?: string,
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

        // Never `--project`: that is a hard override, and the workspace-folder name is
        // only a fallback for files the CLI cannot place in a repository or project
        // (WakaTime's `--alternate-project`).
        if (primaryExtra.alternate_project) {
            args.push("--alternate-project", primaryExtra.alternate_project);
        }

        if (primaryWrite) {
            args.push("--write");
        }

        this.pushOptionalNumber(args, "--time", primaryExtra.time);

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
        this.pushOptionalString(args, "--actor-type", primaryExtra.actor_type);
        this.pushOptionalNumber(args, "--actor-confidence", primaryExtra.actor_confidence);
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
        if (this.clipboardCapability !== false) {
            this.pushOptionalNumber(
                args,
                "--clipboard-tracking-version",
                primaryExtra.clipboard_tracking_version,
            );
            this.pushOptionalNumber(args, "--copy-actions", primaryExtra.copy_actions);
            this.pushOptionalNumber(args, "--paste-actions", primaryExtra.paste_actions);
            this.pushOptionalNumber(args, "--copied-chars", primaryExtra.copied_chars);
            this.pushOptionalNumber(args, "--copied-lines", primaryExtra.copied_lines);
            this.pushOptionalNumber(args, "--pasted-chars", primaryExtra.pasted_chars);
            this.pushOptionalNumber(args, "--pasted-lines", primaryExtra.pasted_lines);
            this.pushOptionalNumber(
                args,
                "--paste-same-file-actions",
                primaryExtra.paste_same_file_actions,
            );
            this.pushOptionalNumber(
                args,
                "--paste-same-workspace-actions",
                primaryExtra.paste_same_workspace_actions,
            );
            this.pushOptionalNumber(
                args,
                "--paste-external-or-unknown-actions",
                primaryExtra.paste_external_or_unknown_actions,
            );
        }

        const stdinPayload =
            extraHeartbeats.length > 0
                ? JSON.stringify(extraHeartbeats, null, 2)
                : undefined;
        if (stdinPayload) {
            args.push("--extra-heartbeats");
        }

        try {
            return await this.runCli(args, stdinPayload);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const hadClipboardFlags = args.includes("--clipboard-tracking-version");
            const hadAlternateProject = args.includes("--alternate-project");
            if (
                (!hadClipboardFlags && !hadAlternateProject) ||
                !/unexpected argument|found argument|usage:/i.test(message)
            ) {
                throw error;
            }
            if (hadClipboardFlags) {
                this.clipboardCapability = false;
            }
            this.logger.warn("legacy wakaclock-cli rejected newer heartbeat flags", {
                error: message
            });
            // Drop the fallback name rather than converting it to `--project`: an older CLI
            // still detects the repository itself, and `--project` would override it.
            return this.runCli(stripLegacyArgs(args), stdinPayload);
        }
    }

    /** Send workspace metadata through the CLI; the broker token remains in the
     * CLI/runtime boundary and is never handed to the extension watcher. */
    public async sendEditorObservation(
        observation: EditorObservationPayload,
    ): Promise<EditorObservationStatus> {
        const result = await this.runCli(
            ["broker", "editor-observe", "--json"],
            JSON.stringify(observation),
        );
        const status = this.parseJson<EditorObservationStatus>(result.stdout);
        if (!status) {
            throw new Error("wakaclock-cli returned no editor observation status");
        }
        return status;
    }

    public async getEditorObservationStatus(
        observationId: string,
    ): Promise<EditorObservationStatus> {
        const result = await this.runCli([
            "broker",
            "editor-observation-status",
            "--observation-id",
            observationId,
            "--json",
        ]);
        const status = this.parseJson<EditorObservationStatus>(result.stdout);
        if (!status) {
            throw new Error("wakaclock-cli returned no editor observation status");
        }
        return status;
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
        const capabilities = (lines.Capabilities ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        this.clipboardCapability = capabilities.includes("clipboard_metrics_v1");
        return {
            configPath: lines["Config path"],
            serverUrl: lines["Server URL"],
            userId: lines["User ID"],
            queuedHeartbeats: this.parseNumber(lines["Queued heartbeats"]),
            flushedNow: this.parseNumber(lines["Flushed now"]),
            capabilities,
        };
    }

    /**
     * Best-effort presence liveness ping (see `PresenceHeartbeat` in wakaclock-cli).
     * Callers must never let this affect the heartbeat pipeline: presence is a social
     * feature, time tracking is not, so every failure is swallowed here rather than
     * thrown.
     */
    public async sendPresenceHeartbeat(): Promise<void> {
        try {
            await this.runCli(["presence-heartbeat"]);
        } catch (error) {
            this.logger.debug("presence heartbeat ping failed", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    public async installAgent(): Promise<CliResult> {
        return this.runCli(["broker", "install", "--json"]);
    }

    public async getBrokerStatus(): Promise<BrokerStatusSnapshot> {
        const result = await this.runCli(["broker", "status", "--json"]);
        const status = this.parseJson<BrokerStatusSnapshot>(result.stdout.trim());
        if (!status) {
            throw new Error("wakaclock broker status returned invalid JSON");
        }
        return status;
    }

    /** Read the same typed runtime snapshot used by `wakaclock ai doctor`. */
    public async getAiDiagnosticsSnapshot(): Promise<AiDiagnosticsSnapshot> {
        const result = await this.runCli(["ai", "doctor", "--json"]);
        const snapshot = this.parseJson<AiDiagnosticsSnapshot>(result.stdout.trim());
        if (!snapshot || snapshot.schema_version !== 2) {
            throw new Error("wakaclock ai doctor returned an unsupported diagnostics snapshot");
        }
        return snapshot;
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
        const child = spawn(cliPath, ["broker", "run"], {
            stdio: "ignore",
            detached: false,
            env: {
                ...process.env,
                WAKACLOCK_EDITOR: "vscode",
                ...this.topologyEnvironment(),
                // Enable the topology-aware handoff path for transcript and hook
                // events launched by the extension host. Remote runtimes still
                // require their explicit runtime/bridge ids before certification.
                WAKACLOCK_TOPOLOGY_AUTO: process.env.WAKACLOCK_TOPOLOGY_AUTO ?? "1",
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
                    ...this.topologyEnvironment(),
                    WAKACLOCK_TOPOLOGY_AUTO: process.env.WAKACLOCK_TOPOLOGY_AUTO ?? "1",
                    WAKACLOCK_SERVER_URL:
                        config.serverUrl?.trim() || "https://api.atoaxis.com",
                    ...(apiKey ? { WAKACLOCK_API_KEY: apiKey } : {}),
                },
            });

            let stdout = "";
            let stderr = "";
            let settled = false;
            const finish = (callback: () => void) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(deadline);
                callback();
            };
            const deadline = setTimeout(() => {
                if (!child.killed) {
                    child.kill();
                }
                finish(() => reject(new Error(
                    `wakaclock-cli timed out after 45 seconds while running ${args[0] ?? "command"}`,
                )));
            }, 45_000);

            child.stdout.setEncoding("utf8");
            child.stderr.setEncoding("utf8");
            child.stdout.on("data", (chunk) => {
                stdout += chunk;
            });
            child.stderr.on("data", (chunk) => {
                stderr += chunk;
            });

            child.on("error", (error) => {
                finish(() => reject(
                    new Error(
                        `Failed to start wakaclock-cli at "${cliPath}". ${error.message}. The bundled AtoAxis CLI may be unavailable; check the Extension installation or use the advanced cliPath override.`,
                    ),
                ));
            });

            child.on("close", (code) => {
                const exitCode = code ?? -1;
                if (exitCode !== 0) {
                    finish(() => reject(
                        new Error(
                            `wakaclock-cli exited with code ${exitCode}. ${stderr.trim() || stdout.trim()}`,
                        ),
                    ));
                    return;
                }
                finish(() => resolve({ stdout, stderr, exitCode }));
            });

            if (stdinPayload) {
                child.stdin.write(stdinPayload);
            }
            child.stdin.end();
        });
    }

    private topologyEnvironment(): Record<string, string> {
        const execution = process.env.WAKACLOCK_EXECUTION_SURFACE ?? this.executionSurface;
        return execution ? { WAKACLOCK_EXECUTION_SURFACE: execution } : {};
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

const CLIPBOARD_FLAGS = new Set([
    "--clipboard-tracking-version",
    "--copy-actions",
    "--paste-actions",
    "--copied-chars",
    "--copied-lines",
    "--pasted-chars",
    "--pasted-lines",
    "--paste-same-file-actions",
    "--paste-same-workspace-actions",
    "--paste-external-or-unknown-actions",
]);

function stripLegacyArgs(args: string[]): string[] {
    const stripped: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
        if (CLIPBOARD_FLAGS.has(args[index]) || args[index] === "--alternate-project") {
            index += 1;
            continue;
        }
        stripped.push(args[index]);
    }
    return stripped;
}
