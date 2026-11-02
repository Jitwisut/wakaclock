import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import {
  AI_SETUP_PROMPTED_AT_KEY,
  AI_SETUP_SNOOZE_MS,
  CHOOSE,
  ENABLE_ALL,
  NOT_NOW,
  maybeOfferAiSetup
} from "../src/aiSetupPrompt";
import type { AiAgentStatus } from "../src/agentSetup";
import { Logger } from "../src/logging";

const showInformationMessage = vi.fn();
const executeCommand = vi.fn().mockResolvedValue(true);
let autoInstall = true;

vi.mock("vscode", () => ({
  window: {
    showInformationMessage: (...args: unknown[]) => showInformationMessage(...args)
  },
  commands: {
    executeCommand: (...args: unknown[]) => executeCommand(...args)
  },
  workspace: {
    getConfiguration: () => ({ get: () => autoInstall })
  }
}));

function agent(id: string, label: string, overrides: Partial<AiAgentStatus> = {}): AiAgentStatus {
  return { id, label, provider: "test", detected: true, enabled: false, ...overrides };
}

function createContext(state: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(state));
  const context = {
    globalState: {
      get: (key: string) => values.get(key),
      update: vi.fn(async (key: string, value: unknown) => {
        values.set(key, value);
      })
    }
  };
  return { context: context as unknown as vscode.ExtensionContext, values };
}

const logger = new Logger(() => false);
const integrations = (statuses: AiAgentStatus[]) => ({ getStatus: vi.fn().mockResolvedValue(statuses) });

describe("maybeOfferAiSetup", () => {
  beforeEach(() => {
    autoInstall = true;
    showInformationMessage.mockReset();
    executeCommand.mockClear();
  });

  it("names the detected tools and offers Enable all, Choose and Not now", async () => {
    showInformationMessage.mockResolvedValue(undefined);
    const { context } = createContext();

    await maybeOfferAiSetup(
      context,
      integrations([agent("claude-code", "Claude Code"), agent("codex", "Codex")]),
      logger
    );

    expect(showInformationMessage).toHaveBeenCalledWith(
      "AtoAxis can show how much of your code Claude Code, Codex wrote. Enable AI tracking?",
      ENABLE_ALL,
      CHOOSE,
      NOT_NOW
    );
  });

  it("Enable all sets up every eligible tool in one step, without the picker", async () => {
    showInformationMessage.mockResolvedValue(ENABLE_ALL);
    const { context, values } = createContext({
      "atoaxis.aiConsent.gemini-cli": { state: "denied" }
    });

    await maybeOfferAiSetup(
      context,
      integrations([
        agent("claude-code", "Claude Code"),
        agent("codex", "Codex", { enabled: true }),
        agent("cursor", "Cursor", { detected: false }),
        agent("gemini-cli", "Gemini CLI"),
        agent("kilo-code", "Kilo Code")
      ]),
      logger
    );

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith("wakaclock.setupAiTracking", {
      agents: ["claude-code", "kilo-code"]
    });
    expect(values.get(AI_SETUP_PROMPTED_AT_KEY)).toEqual(expect.any(Number));
  });

  it("Choose opens the existing per-tool picker", async () => {
    showInformationMessage.mockResolvedValue(CHOOSE);
    const { context } = createContext();

    await maybeOfferAiSetup(context, integrations([agent("codex", "Codex")]), logger);

    expect(executeCommand).toHaveBeenCalledWith("wakaclock.setupAiTracking");
  });

  it("snoozes after a failed setup so the prompt does not return on every window", async () => {
    showInformationMessage.mockResolvedValue(ENABLE_ALL);
    executeCommand.mockResolvedValueOnce(false);
    const { context, values } = createContext();

    await maybeOfferAiSetup(context, integrations([agent("kilo-code", "Kilo Code")]), logger);

    expect(values.get(AI_SETUP_PROMPTED_AT_KEY)).toEqual(expect.any(Number));
  });

  it("Not now and a dismissed notification install nothing and snooze", async () => {
    for (const answer of [NOT_NOW, undefined]) {
      showInformationMessage.mockResolvedValue(answer);
      executeCommand.mockClear();
      const { context, values } = createContext();

      await maybeOfferAiSetup(context, integrations([agent("codex", "Codex")]), logger);

      expect(executeCommand).not.toHaveBeenCalled();
      expect(values.get(AI_SETUP_PROMPTED_AT_KEY)).toEqual(expect.any(Number));
    }
  });

  it("stays quiet while snoozed", async () => {
    const { context } = createContext({ [AI_SETUP_PROMPTED_AT_KEY]: Date.now() - AI_SETUP_SNOOZE_MS / 2 });

    await maybeOfferAiSetup(context, integrations([agent("codex", "Codex")]), logger);

    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it("stays quiet when autoInstallAgentHooks is off", async () => {
    autoInstall = false;
    const { context } = createContext();

    await maybeOfferAiSetup(context, integrations([agent("codex", "Codex")]), logger);

    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it("stays quiet when nothing is eligible", async () => {
    const { context } = createContext({
      "atoaxis.aiConsent.codex": { state: "deferred", updatedAt: Date.now() }
    });

    await maybeOfferAiSetup(
      context,
      integrations([
        agent("claude-code", "Claude Code", { enabled: true }),
        agent("codex", "Codex"),
        agent("cursor", "Cursor", { detected: false })
      ]),
      logger
    );

    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it("logs and continues when detection fails", async () => {
    const warn = vi.spyOn(logger, "warn");
    const { context } = createContext();

    await maybeOfferAiSetup(context, { getStatus: vi.fn().mockRejectedValue(new Error("boom")) }, logger);

    expect(showInformationMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("AI setup detection failed", { error: "boom" });
  });
});
