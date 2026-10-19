import * as vscode from "vscode";
import type { Logger } from "./logging";
import { getPendingApiKey, getStoredApiKey } from "./secrets";

export const EARLY_ACCESS_URL = "https://www.atoaxis.com/join";

// Both flags live in globalState without setKeysForSync, so they stay per install
// and Settings Sync never suppresses the prompt on a second machine.
export const API_KEY_PROMPT_SHOWN_KEY = "atoaxis.apiKeyPromptShown";
export const API_KEY_PROMPT_DISMISSED_KEY = "atoaxis.apiKeyPromptDismissed";

const MESSAGE = "AtoAxis needs an API key. Keys are issued to invite-only Early Access members.";
const SET_API_KEY = "Set API Key";
const JOIN_EARLY_ACCESS = "Join Early Access";
const DONT_SHOW_AGAIN = "Don't show again";

/**
 * Point a fresh install without a key at the signup page, once.
 *
 * Callers must not await this: the notification resolves only when the user
 * answers it, and activation must never wait on that. `force` bypasses the
 * once-per-install and "Don't show again" flags for an explicit user request.
 */
export async function maybePromptForApiKey(
  context: vscode.ExtensionContext,
  logger: Logger,
  options: { force?: boolean } = {}
): Promise<void> {
  try {
    if (
      !options.force &&
      (context.globalState.get<boolean>(API_KEY_PROMPT_DISMISSED_KEY) ||
        context.globalState.get<boolean>(API_KEY_PROMPT_SHOWN_KEY))
    ) {
      return;
    }
    const key =
      (await getStoredApiKey(context.secrets)) ?? (await getPendingApiKey(context.secrets));
    if (key) {
      return;
    }

    // Record the prompt before waiting on it. An unanswered notification can stay
    // pending in the tray across a window reload, and it must still count as shown.
    await context.globalState.update(API_KEY_PROMPT_SHOWN_KEY, true);
    const choice = await vscode.window.showInformationMessage(
      MESSAGE,
      SET_API_KEY,
      JOIN_EARLY_ACCESS,
      DONT_SHOW_AGAIN
    );
    if (choice === SET_API_KEY) {
      await vscode.commands.executeCommand("wakaclock.setApiKey");
    } else if (choice === JOIN_EARLY_ACCESS) {
      await vscode.env.openExternal(vscode.Uri.parse(EARLY_ACCESS_URL));
    } else if (choice === DONT_SHOW_AGAIN) {
      await context.globalState.update(API_KEY_PROMPT_DISMISSED_KEY, true);
    }
  } catch (error) {
    logger.warn("API key prompt failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
