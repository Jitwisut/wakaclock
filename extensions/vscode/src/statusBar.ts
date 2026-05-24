import * as vscode from "vscode";
import type { WakaclockCliService } from "./cli";
import { Logger } from "./logging";
import type { WakaclockConfigSnapshot } from "./types";

const STATUS_REFRESH_MS = 60_000;

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private interval?: NodeJS.Timeout;

  public constructor(
    private readonly getConfig: () => WakaclockConfigSnapshot,
    private readonly cli: Pick<WakaclockCliService, "getToday">,
    private readonly logger: Logger
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = "wakaclock.showToday";
    this.item.name = "Wakaclock";
  }

  public start(): void {
    this.applyVisibility();
    void this.refresh();
    this.interval = setInterval(() => {
      void this.refresh();
    }, STATUS_REFRESH_MS);
  }

  public handleHeartbeatSent(): void {
    void this.refresh();
  }

  public async refresh(): Promise<void> {
    if (!this.getConfig().statusBarEnabled) {
      this.item.hide();
      return;
    }

    try {
      const snapshot = await this.cli.getToday();
      this.item.text = `$(clock) ${snapshot.humanReadable}`;
      this.item.tooltip = `Today: ${snapshot.humanReadable}\nHeartbeats: ${snapshot.heartbeatCount}`;
      this.item.show();
    } catch (error) {
      this.logger.warn("failed to refresh status bar", error);
      this.item.text = "$(clock) Wakaclock";
      this.item.tooltip = "Unable to read today's total from wakaclock-cli.";
      this.item.show();
    }
  }

  public applyVisibility(): void {
    if (this.getConfig().statusBarEnabled) {
      this.item.show();
      return;
    }
    this.item.hide();
  }

  public dispose(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.item.dispose();
  }
}
