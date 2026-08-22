import * as vscode from "vscode";
import type { WakaclockConfigSnapshot } from "./types";

const SECTION = "wakaclock";

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

    return {
      cliPath: this.resolveCliPath(config),
      flushIntervalMs: Math.max(5, config.get<number>("flushIntervalSeconds", 30)) * 1000,
      sameFileHeartbeatMs:
        Math.max(1, config.get<number>("sameFileHeartbeatMinutes", 2)) * 60 * 1000,
      // WakaTime's default keystroke timeout is 15 minutes. Keeping the same default
      // makes short thinking/reading gaps part of the surrounding coding duration.
      idleMs: Math.max(1, config.get<number>("idleMinutes", 15)) * 60 * 1000,
      statusBarEnabled: config.get<boolean>("statusBarEnabled", true),
      debugLogging: config.get<boolean>("debugLogging", false),
      trackDebugSessions: config.get<boolean>("trackDebugSessions", true),
      trackBuildTasks: config.get<boolean>("trackBuildTasks", true)
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
    const configuredPath = config.get<string>("cliPath", "").trim();
    // The package is named `wakaclock-cli`, but its `[[bin]] name` in Cargo.toml is
    // "wakaclock" — that's the binary that actually gets built, so it's what has to be
    // resolved from PATH when no explicit wakaclock.cliPath is configured.
    return configuredPath || "wakaclock";
  }
}
