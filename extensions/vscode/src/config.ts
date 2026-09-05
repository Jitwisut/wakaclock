import * as vscode from "vscode";
import type { WakaclockConfigSnapshot } from "./types";

const SECTION = "wakaclock";
const PRODUCTION_SERVER_URL = "https://api.atoaxis.com";

export class WakaclockConfigService implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<WakaclockConfigSnapshot>();
  private readonly configChangeSubscription: vscode.Disposable;

  public constructor() {
    this.configChangeSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(SECTION)) {
        return;
      }
      this.emitter.fire(this.getSnapshot());
    });
  }

  public get onDidChange(): vscode.Event<WakaclockConfigSnapshot> {
    return this.emitter.event;
  }

  public getSnapshot(): WakaclockConfigSnapshot {
    const config = vscode.workspace.getConfiguration(SECTION);

    const configuredRate = config.inspect<number>("heartbeatRateLimitSeconds");
    const legacyRate = config.get<number>("sameFileHeartbeatMinutes", 2) * 60;
    const heartbeatRateSeconds =
      configuredRate?.globalValue === undefined &&
      configuredRate?.workspaceValue === undefined &&
      configuredRate?.workspaceFolderValue === undefined
        ? legacyRate
        : config.get<number>("heartbeatRateLimitSeconds", 120);

    return {
      cliPath: this.resolveCliPath(config),
      serverUrl: this.resolveServerUrl(config),
      flushIntervalMs: Math.max(5, config.get<number>("flushIntervalSeconds", 30)) * 1000,
      heartbeatRateLimitMs: Math.max(30, heartbeatRateSeconds) * 1000,
      sameFileHeartbeatMs:
        Math.max(1, config.get<number>("sameFileHeartbeatMinutes", 2)) * 60 * 1000,
      // Kept in the snapshot for backwards-compatible consumers, but the timing engine
      // intentionally ignores it: all clients use the fixed strict 120-second gap.
      idleMs: Math.max(1, config.get<number>("idleMinutes", 15)) * 60 * 1000,
      statusBarEnabled: config.get<boolean>("statusBarEnabled", true),
      debugLogging: config.get<boolean>("debugLogging", false),
      trackDebugSessions: config.get<boolean>("trackDebugSessions", true),
      trackBuildTasks: config.get<boolean>("trackBuildTasks", true),
      trackClipboardActions: config.get<boolean>("trackClipboardActions", true),
      autoInstallAgentHooks: config.get<boolean>("autoInstallAgentHooks", true),
      presenceAutoJoinEnabled: config.get<boolean>("presenceAutoJoinEnabled", false)
    };
  }

  public async updateSetting(key: string, value: unknown): Promise<void> {
    const config = vscode.workspace.getConfiguration(SECTION);
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }

  public dispose(): void {
    this.configChangeSubscription.dispose();
    this.emitter.dispose();
  }

  private resolveCliPath(config: vscode.WorkspaceConfiguration): string {
    // cliPath is intentionally a global-only emergency/development override. A
    // repository's .vscode/settings.json must not be able to replace the executable
    // that receives a user's API key.
    const configuredPath = config.inspect<string>("cliPath")?.globalValue;
    return typeof configuredPath === "string" ? configuredPath.trim() : "";
  }

  private resolveServerUrl(config: vscode.WorkspaceConfiguration): string {
    const configured = config.inspect<string>("serverUrl")?.globalValue;
    if (typeof configured !== "string" || !configured.trim()) {
      return PRODUCTION_SERVER_URL;
    }
    const value = configured.trim().replace(/\/+$/, "");
    try {
      const parsed = new URL(value);
      const loopback = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return PRODUCTION_SERVER_URL;
      }
      if (parsed.protocol === "http:" && !loopback.has(parsed.hostname)) {
        return PRODUCTION_SERVER_URL;
      }
      if (
        (parsed.pathname !== "/" && parsed.pathname !== "") ||
        parsed.search ||
        parsed.hash ||
        parsed.username ||
        parsed.password
      ) {
        return PRODUCTION_SERVER_URL;
      }
      return value;
    } catch {
      return PRODUCTION_SERVER_URL;
    }
  }
}
