import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, TextDocumentContentProvider, TreeDataProvider, TreeItem, Uri } from "vscode";
import { LocalGitReader } from "../project-intelligence/gitReader";
import { registerProjectIntelligence } from "../project-intelligence/viewer";

const host = vi.hoisted(() => ({
  enabled: false,
  trusted: true,
  remote: undefined as string | undefined,
  information: vi.fn(),
  quickPick: vi.fn(),
  execute: vi.fn(),
  warning: vi.fn(),
  progress: vi.fn(),
  provider: undefined as TextDocumentContentProvider | undefined,
  tree: undefined as TreeDataProvider<TreeItem> | undefined,
  close: (_document: { uri: Uri }) => {},
  reset: () => {},
  commands: new Map<string, (...args: unknown[]) => Promise<void>>()
}));

vi.mock("vscode", () => {
  const disposable = () => ({ dispose() {} });
  return {
    env: {
      get remoteName() { return host.remote; },
      uiKind: 1
    },
    UIKind: { Desktop: 1 },
    ProgressLocation: { Notification: 15 },
    FileSystemError: { FileNotFound: (message: string) => new Error(message) },
    CancellationTokenSource: class {
      token = { isCancellationRequested: false };
      cancel() { this.token.isCancellationRequested = true; }
      dispose() {}
    },
    Uri: {
      from: (parts: { scheme: string; path: string }) => ({
        ...parts, toString: () => parts.scheme + ":" + parts.path
      })
    },
    TreeItem: class {
      constructor(public label: string) {}
    },
    workspace: {
      get isTrusted() { return host.trusted; },
      workspaceFolders: [{ name: "Fixture", uri: { scheme: "file", fsPath: "/fixture" } }],
      registerTextDocumentContentProvider: (_scheme: string, provider: TextDocumentContentProvider) => {
        host.provider = provider;
        return disposable();
      },
      onDidCloseTextDocument: (callback: typeof host.close) => { host.close = callback; return disposable(); },
      onDidChangeWorkspaceFolders: (callback: typeof host.reset) => { host.reset = callback; return disposable(); },
      onDidChangeConfiguration: disposable,
      getConfiguration: () => ({ inspect: () => ({ globalValue: host.enabled }) })
    },
    window: {
      createTreeView: (_id: string, options: { treeDataProvider: TreeDataProvider<TreeItem> }) => {
        host.tree = options.treeDataProvider;
        return disposable();
      },
      showInformationMessage: host.information,
      showQuickPick: host.quickPick,
      showWarningMessage: host.warning,
      withProgress: host.progress
    },
    commands: {
      executeCommand: host.execute,
      registerCommand: (name: string, command: (...args: unknown[]) => Promise<void>) => {
        host.commands.set(name, command);
        return disposable();
      }
    },
    EventEmitter: class {
      event = () => {};
      fire() {}
      dispose() {}
    }
  };
});

describe("Project Intelligence command boundaries", () => {
  let subscriptions: ExtensionContext["subscriptions"];
  beforeEach(() => {
    subscriptions = [];
    host.enabled = false;
    host.trusted = true;
    host.remote = undefined;
    [host.information, host.progress, host.execute, host.warning, host.quickPick].forEach(mock => mock.mockReset());
    host.commands.clear();
    host.progress.mockImplementation((_options, work) => work({}, {
      isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} })
    }));
    registerProjectIntelligence({ subscriptions } as ExtensionContext);
  });
  afterEach(() => {
    subscriptions.forEach(item => item.dispose());
    vi.restoreAllMocks();
  });

  it("does not start Git without explicit opt-in", async () => {
    const open = vi.spyOn(LocalGitReader, "open");
    await host.commands.get("wakaclock.projectIntelligence.selectRevisions")!();
    expect(host.progress).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("does not start Git for a remote or untrusted workspace, even when enabled", async () => {
    const open = vi.spyOn(LocalGitReader, "open");
    host.enabled = true;
    host.trusted = false;
    await host.commands.get("wakaclock.openProjectIntelligence")!();
    host.trusted = true;
    host.remote = "ssh-remote";
    await host.commands.get("wakaclock.openProjectIntelligence")!();
    expect(host.information).toHaveBeenCalledTimes(2);
    expect(host.progress).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  async function selectFixture() {
    host.enabled = true;
    const head = "a".repeat(40);
    const before = { id: "b".repeat(40), path: "file.ts", pathBytesBase64: "ZmlsZS50cw==", mode: "100644" };
    const reader = {
      resolve: vi.fn().mockResolvedValue(head),
      commits: vi.fn().mockResolvedValue({ items: [{ id: head, subject: "Fixture" }], hasMore: false }),
      parents: vi.fn().mockResolvedValue([]),
      compare: vi.fn().mockResolvedValue({
        pair: { base: null, head, repository: "/fixture", schema_version: 1 },
        changes: [{ kind: "added", before: null, after: before }]
      }),
      preview: vi.fn().mockImplementation(blob => Promise.resolve({
        kind: "text", text: blob ? "export const value = 1;" : ""
      }))
    };
    vi.spyOn(LocalGitReader, "open").mockResolvedValue(reader as unknown as LocalGitReader);
    host.quickPick.mockImplementation(items => Promise.resolve(items[0]));
    await host.commands.get("wakaclock.openProjectIntelligence")!();
    return reader;
  }

  it("opens the selected diff and reports expired previews without inventing empty content", async () => {
    await selectFixture();
    const items = await host.tree!.getChildren();
    const command = items![2].command!;
    await host.commands.get(command.command)!(...command.arguments!);
    const diff = host.execute.mock.calls.find(call => call[0] === "vscode.diff")!;
    expect(diff).toBeDefined();
    const provider = host.provider!;
    const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) };
    expect(provider.provideTextDocumentContent(diff[1], token)).toBe("");
    expect(provider.provideTextDocumentContent(diff[2], token)).toBe("export const value = 1;");
    host.close({ uri: diff[2] });
    expect(() => provider.provideTextDocumentContent(diff[2], token)).toThrow("preview has expired");
    host.reset();
    expect(() => provider.provideTextDocumentContent(diff[1], token)).toThrow("preview has expired");
    expect(host.warning).not.toHaveBeenCalled();
  });

  it("discards a pending comparison when workspace folders change", async () => {
    const reader = await selectFixture();
    let resolveComparison!: (result: unknown) => void;
    const previous = await reader.compare();
    reader.compare.mockImplementationOnce(() => new Promise(resolve => { resolveComparison = resolve; }));
    const selection = host.commands.get("wakaclock.projectIntelligence.selectRevisions")!();
    await vi.waitFor(() => expect(resolveComparison).toBeTypeOf("function"));
    host.reset();
    resolveComparison(previous);
    await selection;
    const items = await host.tree!.getChildren();
    expect(items).toHaveLength(1);
    expect(host.warning).not.toHaveBeenCalled();
  });
});
