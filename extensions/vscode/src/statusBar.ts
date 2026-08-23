import * as vscode from "vscode";
import type { WakaclockCliService } from "./cli";
import { Logger } from "./logging";
import type { WakaclockConfigSnapshot } from "./types";

const STATUS_REFRESH_MS = 60_000;

/**
 * Recognise the CLI's rejected-key failure. Matched on the wording
 * `ApiClient::reject_unauthorized` produces plus the server's own 401 body, since the
 * CLI surfaces failures as an exit code and a message rather than a typed error.
 */
function isAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /API key was rejected|authentication required/i.test(message);
}

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private interval?: NodeJS.Timeout;
  private authFailureReported = false;

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
      this.item.backgroundColor = undefined;
      this.item.command = "wakaclock.showToday";
      this.authFailureReported = false;
      this.item.show();
    } catch (error) {
      this.logger.warn("failed to refresh status bar", error);

      // A rejected key and an unreachable server both surfaced as the same neutral
      // "Wakaclock" label, so a key revoked or regenerated after setup looked like a
      // transient blip while every heartbeat silently went unrecorded. This refresh
      // already makes an authenticated request every minute, so it is the one place
      // that notices — it just has to say what it found.
      if (isAuthFailure(error)) {
        this.item.text = "$(warning) Wakaclock: key rejected";
        this.item.tooltip =
          "The server rejected this API key, so coding time is not being recorded.\nRun \"Wakaclock: Set API Key\" with a fresh key from Settings → API key.";
        this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        this.item.command = "wakaclock.setApiKey";
        this.item.show();
        this.reportAuthFailureOnce();
        return;
      }

      this.item.text = "$(clock) Wakaclock";
      this.item.tooltip = "Unable to read today's total from wakaclock-cli.";
      this.item.backgroundColor = undefined;
      this.item.command = "wakaclock.showToday";
      this.item.show();
    }
  }

  /**
   * Notify on the transition into the failed state only. The refresh runs every
   * minute, and a popup per tick would train the user to dismiss it on sight.
   */
  private reportAuthFailureOnce(): void {
    if (this.authFailureReported) {
      return;
    }
    this.authFailureReported = true;

    void vscode.window
      .showErrorMessage(
        "Wakaclock is not recording coding time: the server rejected your API key. Regenerating a key on the dashboard invalidates the previous one.",
        "Set API Key"
      )
      .then((choice) => {
        if (choice === "Set API Key") {
          void vscode.commands.executeCommand("wakaclock.setApiKey");
        }
      });
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
