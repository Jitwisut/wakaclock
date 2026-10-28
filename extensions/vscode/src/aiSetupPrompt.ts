import * as vscode from "vscode";
import type { AiAgentStatus } from "./agentSetup";
import type { AiIntegrationController } from "./commands";
import type { Logger } from "./logging";

export const AI_SETUP_PROMPTED_AT_KEY = "atoaxis.aiSetupPromptedAt";
export const AI_SETUP_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export const ENABLE_ALL = "Enable all";
export const CHOOSE = "Choose…";
export const NOT_NOW = "Not now";

/** Detected tools that are not set up yet and have not been declined or deferred. */
function eligibleAgents(context: vscode.ExtensionContext, statuses: AiAgentStatus[]): AiAgentStatus[] {
  return statuses.filter((status) => {
    if (!status.detected || status.enabled) {
      return false;
    }
    const consent = context.globalState.get<{ state?: string; updatedAt?: number }>(
      `atoaxis.aiConsent.${status.id}`
    );
    if (consent?.state === "denied") {
      return false;
    }
    if (
      consent?.state === "deferred" &&
      consent.updatedAt &&
      Date.now() - consent.updatedAt < AI_SETUP_SNOOZE_MS
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Offer AI attribution once a key is verified. "Enable all" sets up every eligible
 * tool in one click; "Choose…" keeps the per-tool picker. Nothing is installed until
 * the user picks one of them.
 */
export async function maybeOfferAiSetup(
  context: vscode.ExtensionContext,
  aiIntegrations: Pick<AiIntegrationController, "getStatus">,
  logger: Logger
): Promise<void> {
  if (!vscode.workspace.getConfiguration("wakaclock").get<boolean>("autoInstallAgentHooks", true)) {
    return;
  }
  const lastPromptedAt = context.globalState.get<number>(AI_SETUP_PROMPTED_AT_KEY);
  if (lastPromptedAt && Date.now() - lastPromptedAt < AI_SETUP_SNOOZE_MS) {
    return;
  }

  try {
    const eligible = eligibleAgents(context, await aiIntegrations.getStatus());
    if (eligible.length === 0) {
      return;
    }
    const names = eligible.map((status) => status.label).join(", ");
    const choice = await vscode.window.showInformationMessage(
      `AtoAxis can show how much of your code ${names} wrote. Enable AI tracking?`,
      ENABLE_ALL,
      CHOOSE,
      NOT_NOW
    );
    if (choice === ENABLE_ALL) {
      await vscode.commands.executeCommand("wakaclock.setupAiTracking", {
        agents: eligible.map((status) => status.id)
      });
    } else if (choice === CHOOSE) {
      await vscode.commands.executeCommand("wakaclock.setupAiTracking");
    }
    // Snooze after every answer, including a partial or failed setup: the command
    // already reported the outcome, and a tool that cannot be configured must not
    // re-prompt on every window. "Not now" means later, not never.
    await context.globalState.update(AI_SETUP_PROMPTED_AT_KEY, Date.now());
  } catch (error) {
    logger.warn("AI setup detection failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
