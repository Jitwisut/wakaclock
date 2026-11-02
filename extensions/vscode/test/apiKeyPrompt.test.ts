import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import {
  API_KEY_PROMPT_DISMISSED_KEY,
  API_KEY_PROMPT_SHOWN_KEY,
  EARLY_ACCESS_URL,
  maybePromptForApiKey
} from "../src/apiKeyPrompt";
import { Logger } from "../src/logging";

const showInformationMessage = vi.fn();
const executeCommand = vi.fn().mockResolvedValue(undefined);
const openExternal = vi.fn().mockResolvedValue(true);

vi.mock("vscode", () => ({
  window: {
    showInformationMessage: (...args: unknown[]) => showInformationMessage(...args)
  },
  commands: {
    executeCommand: (...args: unknown[]) => executeCommand(...args)
  },
  env: {
    openExternal: (...args: unknown[]) => openExternal(...args)
  },
  Uri: {
    parse: (value: string) => ({ toString: () => value })
  }
}));

function createContext(
  options: { secrets?: Record<string, string>; state?: Record<string, unknown> } = {}
) {
  const secrets = new Map(Object.entries(options.secrets ?? {}));
  const state = new Map(Object.entries(options.state ?? {}));
  const context = {
    secrets: { get: async (key: string) => secrets.get(key) },
    globalState: {
      get: (key: string) => state.get(key),
      update: vi.fn(async (key: string, value: unknown) => {
        state.set(key, value);
      })
    }
  };
  return { context: context as unknown as vscode.ExtensionContext, state };
}

const logger = new Logger(() => false);

describe("maybePromptForApiKey", () => {
  beforeEach(() => {
    showInformationMessage.mockReset();
    executeCommand.mockClear();
    openExternal.mockClear();
  });

  it("shows the Early Access prompt when no key exists", async () => {
    showInformationMessage.mockResolvedValue(undefined);
    const { context, state } = createContext();

    await maybePromptForApiKey(context, logger);

    expect(showInformationMessage).toHaveBeenCalledWith(
      "AtoAxis needs an API key. Keys are issued to invite-only Early Access members.",
      "Set API Key",
      "Join Early Access",
      "Don't show again"
    );
    expect(state.get(API_KEY_PROMPT_SHOWN_KEY)).toBe(true);
    expect(state.get(API_KEY_PROMPT_DISMISSED_KEY)).toBeUndefined();
  });

  it.each([["wakaclock.apiKey"], ["wakaclock.pendingApiKey"]])(
    "stays silent when %s is set",
    async (secret) => {
      const { context, state } = createContext({ secrets: { [secret]: "wcl_test" } });

      await maybePromptForApiKey(context, logger);

      expect(showInformationMessage).not.toHaveBeenCalled();
      expect(state.get(API_KEY_PROMPT_SHOWN_KEY)).toBeUndefined();
    }
  );

  it("shows at most once per install", async () => {
    showInformationMessage.mockResolvedValue(undefined);
    const { context } = createContext();

    await maybePromptForApiKey(context, logger);
    await maybePromptForApiKey(context, logger);

    expect(showInformationMessage).toHaveBeenCalledTimes(1);
  });

  it("respects a persisted Don't show again", async () => {
    const { context } = createContext({ state: { [API_KEY_PROMPT_DISMISSED_KEY]: true } });

    await maybePromptForApiKey(context, logger);

    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it("shows again when explicitly forced", async () => {
    showInformationMessage.mockResolvedValue(undefined);
    const { context } = createContext({
      state: { [API_KEY_PROMPT_SHOWN_KEY]: true, [API_KEY_PROMPT_DISMISSED_KEY]: true }
    });

    await maybePromptForApiKey(context, logger, { force: true });

    expect(showInformationMessage).toHaveBeenCalledTimes(1);
  });

  it("records the prompt as shown before the user answers", async () => {
    showInformationMessage.mockReturnValue(new Promise(() => undefined));
    const { context, state } = createContext();

    void maybePromptForApiKey(context, logger);
    await vi.waitFor(() => expect(showInformationMessage).toHaveBeenCalled());

    expect(state.get(API_KEY_PROMPT_SHOWN_KEY)).toBe(true);
  });

  it("runs the Set API Key command", async () => {
    showInformationMessage.mockResolvedValue("Set API Key");
    const { context } = createContext();

    await maybePromptForApiKey(context, logger);

    expect(executeCommand).toHaveBeenCalledWith("wakaclock.setApiKey");
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("opens the Early Access page", async () => {
    showInformationMessage.mockResolvedValue("Join Early Access");
    const { context } = createContext();

    await maybePromptForApiKey(context, logger);

    expect(openExternal).toHaveBeenCalledTimes(1);
    expect(String(openExternal.mock.calls[0][0])).toBe(EARLY_ACCESS_URL);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("persists Don't show again", async () => {
    showInformationMessage.mockResolvedValue("Don't show again");
    const { context, state } = createContext();

    await maybePromptForApiKey(context, logger);

    expect(state.get(API_KEY_PROMPT_DISMISSED_KEY)).toBe(true);
    expect(executeCommand).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("never rejects when the notification fails", async () => {
    showInformationMessage.mockRejectedValue(new Error("window closed"));
    const { context } = createContext();
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    await expect(maybePromptForApiKey(context, logger)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("API key prompt failed", { error: "window closed" });
    warn.mockRestore();
  });
});
