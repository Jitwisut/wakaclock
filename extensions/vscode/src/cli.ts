import { spawn } from "node:child_process";
import type {
    CliResult,
    ExtraHeartbeatPayload,
    HeartbeatCategory,
    StatusBarSnapshot,
    StatusSnapshot,
    WakaclockConfigSnapshot,
} from "./types";
import { Logger } from "./logging";

export class WakaclockCliService {
    public constructor(
        private readonly getConfig: () => WakaclockConfigSnapshot,
        private readonly logger: Logger,
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

        const stdinPayload =
            extraHeartbeats.length > 0
                ? JSON.stringify(extraHeartbeats, null, 2)
                : undefined;
        if (stdinPayload) {
            args.push("--extra-heartbeats");
        }

        return this.runCli(args, stdinPayload);
    }

    public async getToday(): Promise<StatusBarSnapshot> {
        const result = await this.runCli(["today"]);
        const lines = this.parseKeyValueLines(result.stdout);
        return {
            humanReadable: lines.Today ?? "0s",
            totalSeconds: Number(lines["Total seconds"] ?? "0"),
            heartbeatCount: Number(lines.Heartbeats ?? "0"),
        };
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

    private async runCli(
        args: string[],
        stdinPayload?: string,
    ): Promise<CliResult> {
        const { cliPath } = this.getConfig();
        this.logger.debug("spawning wakaclock-cli", {
            cliPath,
            args,
            hasStdin: Boolean(stdinPayload),
        });

        return new Promise<CliResult>((resolve, reject) => {
            const child = spawn(cliPath, args, {
                stdio: "pipe",
                env: {
                    ...process.env,
                    WAKACLOCK_EDITOR: "vscode",
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
                        `Failed to start wakaclock-cli at "${cliPath}". ${error.message}. Configure wakaclock.cliPath if needed.`,
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
}
