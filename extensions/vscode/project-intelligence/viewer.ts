import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { commitPageSize, GitReadError, LocalGitReader } from "./gitReader";
import type { CodeRevisionPair, FileChange, TextPreview } from "./gitReader";

const viewId = "wakaclock.projectIntelligence";
const scheme = "atoaxis-revision";
const setting = "projectIntelligence.enabled";
const openCommand = "wakaclock.openProjectIntelligence";
const selectCommand = "wakaclock.projectIntelligence.selectRevisions";
const diffCommand = "wakaclock.projectIntelligence.openDiff";

const previewLabels: Record<Exclude<TextPreview["kind"], "text">, string> = {
  binary: "Binary or non-UTF-8 content",
  lfs: "Git LFS pointer",
  submodule: "Git submodule",
  too_large: "Text exceeds 1 MiB or 20,000 lines"
};

type Comparison = Awaited<ReturnType<LocalGitReader["compare"]>>;

function cancellationToken(signal: AbortSignal, context: vscode.Disposable[]): vscode.CancellationToken {
  const source = new vscode.CancellationTokenSource();
  const abort = () => source.cancel();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  context.push({ dispose: () => {
    signal.removeEventListener("abort", abort);
    source.dispose();
  } });
  return source.token;
}

function short(id: string | null): string {
  return id?.slice(0, 12) ?? "Empty tree";
}

function revisionLabel(pair: CodeRevisionPair): string {
  return short(pair.base) + " → " + short(pair.head);
}

class EvolutionView implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private readonly change = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.change.event;
  private reader?: LocalGitReader;
  private comparison?: Comparison & { readonly key: string };
  private pending?: AbortController;
  private readonly documents = new Map<string, string>();
  private readonly disposables: vscode.Disposable[];
  private readonly view: vscode.TreeView<vscode.TreeItem>;

  constructor() {
    this.view = vscode.window.createTreeView(viewId, { treeDataProvider: this, showCollapseAll: false });
    this.disposables = [
      this.view,
      this.change,
      vscode.workspace.registerTextDocumentContentProvider(scheme, {
        provideTextDocumentContent: uri => {
          const text = this.documents.get(uri.toString());
          if (text === undefined) {
            throw vscode.FileSystemError.FileNotFound(
              "This revision preview has expired. Open it again from AtoAxis Project Intelligence."
            );
          }
          return text;
        }
      }),
      vscode.workspace.onDidCloseTextDocument(document => {
        if (document.uri.scheme === scheme) this.documents.delete(document.uri.toString());
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.reset()),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration("wakaclock." + setting) && !this.enabled()) this.reset();
      })
    ];
  }

  private reset() {
    this.pending?.abort();
    this.pending = undefined;
    this.reader = undefined;
    this.comparison = undefined;
    this.view.description = undefined;
    this.documents.clear();
    this.change.fire();
  }

  dispose() {
    this.reset();
    this.disposables.forEach(disposable => disposable.dispose());
  }

  private enabled(): boolean {
    return vscode.workspace.getConfiguration("wakaclock").inspect<boolean>(setting)?.globalValue === true;
  }

  private supported(): boolean {
    return vscode.workspace.isTrusted && !vscode.env.remoteName
      && vscode.env.uiKind === vscode.UIKind.Desktop && process.platform === "darwin";
  }

  getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(): vscode.TreeItem[] {
    const compare = new vscode.TreeItem("Choose repository and revisions");
    compare.command = { command: selectCommand, title: "Choose repository and revisions" };
    const current = this.comparison;
    if (!current) return [compare];

    const range = new vscode.TreeItem(revisionLabel(current.pair));
    range.description = current.changes.length + (current.changes.length === 1 ? " file" : " files");
    const files = current.changes.map((file, index) => {
      const path = file.after?.path ?? file.before?.path ?? "";
      const item = new vscode.TreeItem(path);
      item.description = file.kind === "renamed" ? "renamed from " + file.before?.path : file.kind;
      item.command = { command: diffCommand, title: "Open Revision Diff", arguments: [current.key, index] };
      return item;
    });
    if (files.length === 0) files.push(new vscode.TreeItem("No files changed"));
    return [compare, range, ...files];
  }

  async open(): Promise<void> {
    if (!this.supported()) {
      void vscode.window.showInformationMessage("Project Intelligence requires a trusted local workspace in VS Code on macOS.");
      return;
    }
    if (!this.enabled()) {
      const selected = await vscode.window.showInformationMessage(
        "Enable Project Intelligence to compare Git revisions on this Mac?", "Enable"
      );
      if (selected !== "Enable") return;
      await vscode.workspace.getConfiguration("wakaclock").update(setting, true, vscode.ConfigurationTarget.Global);
    }
    await vscode.commands.executeCommand(viewId + ".focus");
    await this.select();
  }

  private async run(work: (signal: AbortSignal, token: vscode.CancellationToken) => Promise<void>): Promise<void> {
    if (!this.supported() || !this.enabled()) return;
    this.pending?.abort();
    const operation = new AbortController();
    this.pending = operation;
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Project Intelligence",
        cancellable: true
      }, async (_progress, token) => {
        const listener = token.onCancellationRequested(() => operation.abort());
        if (token.isCancellationRequested) operation.abort();
        const disposables = [listener];
        try {
          await work(operation.signal, cancellationToken(operation.signal, disposables));
        } finally {
          disposables.forEach(disposable => disposable.dispose());
        }
      });
    } catch (error) {
      if (!operation.signal.aborted) {
        const message = error instanceof GitReadError ? error.message : "The selected repository or revision could not be opened.";
        void vscode.window.showWarningMessage(message);
      }
    } finally {
      if (this.pending === operation) this.pending = undefined;
    }
  }

  private async pickCommit(
    reader: LocalGitReader, start: string, title: string, signal: AbortSignal, token: vscode.CancellationToken, includeHead = false
  ): Promise<string | undefined> {
    for (let offset = 0; ; offset += commitPageSize) {
      const page = await reader.commits(start, offset, signal);
      signal.throwIfAborted();
      type Pick = vscode.QuickPickItem & { id?: string; action?: "more" | "ref" };
      const items: Pick[] = page.items.map(commit => ({
        label: short(commit.id), description: commit.subject, id: commit.id
      }));
      items.unshift({ label: "Enter branch, tag or commit", action: "ref", alwaysShow: true });
      if (includeHead && offset === 0) items.unshift({ label: "HEAD", description: short(start), id: start });
      if (page.hasMore) items.push({ label: "Next 50 commits", action: "more", alwaysShow: true });
      const selected = await vscode.window.showQuickPick(items, { placeHolder: title }, token);
      signal.throwIfAborted();
      if (!selected) return;
      if (selected.action === "more") continue;
      if (selected.action === "ref") {
        const ref = await vscode.window.showInputBox({ prompt: title }, token);
        signal.throwIfAborted();
        return ref ? reader.resolve(ref.trim(), signal) : undefined;
      }
      return selected.id;
    }
  }

  async select(): Promise<void> {
    await this.run(async (signal, token) => {
      const folders = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === "file");
      if (!folders.length) throw new GitReadError("unavailable", "Open a trusted local Git repository as a workspace folder.");
      const folder = folders.length === 1 ? folders[0] : (await vscode.window.showQuickPick(
        folders.map(folder => ({ label: folder.name, description: folder.uri.fsPath, folder })),
        { placeHolder: "Choose a Git workspace folder" }, token
      ))?.folder;
      signal.throwIfAborted();
      if (!folder) return;
      const reader = await LocalGitReader.open(folder.uri.fsPath, signal);
      const tip = await reader.resolve("HEAD", signal);
      const head = await this.pickCommit(reader, tip, "Choose the head revision", signal, token, true);
      if (!head) return;
      const parents = await reader.parents(head, signal);
      signal.throwIfAborted();
      const baseChoices = [
        ...parents.map((id, index) => ({ label: "Parent " + (index + 1), description: short(id), id })),
        ...(parents.length === 0 ? [{ label: "Empty tree", description: "Root commit", id: null }] : []),
        { label: "Choose another revision", description: "", id: undefined }
      ];
      const choice = await vscode.window.showQuickPick(baseChoices, { placeHolder: "Choose the base revision" }, token);
      signal.throwIfAborted();
      if (!choice) return;
      const base = choice.id === undefined ? await this.pickCommit(reader, tip, "Choose the base revision", signal, token) : choice.id;
      if (base === undefined) return;
      const comparison = await reader.compare(base, head, signal);
      signal.throwIfAborted();
      this.reader = reader;
      this.comparison = { ...comparison, key: randomUUID() };
      this.view.description = folder.name;
      this.change.fire();
    });
  }

  private document(file: FileChange, side: "before" | "after", text: string): vscode.Uri {
    const name = (file[side]?.path ?? file.before?.path ?? file.after?.path ?? "file").split("/").pop();
    const uri = vscode.Uri.from({ scheme, path: "/" + randomUUID() + "/" + name });
    this.documents.set(uri.toString(), text);
    return uri;
  }

  async diff(key: string, index: number): Promise<void> {
    const reader = this.reader;
    const comparison = this.comparison;
    if (!reader || !comparison || key !== comparison.key || !Number.isSafeInteger(index)) return;
    const file = comparison.changes[index];
    if (!file) return;
    await this.run(async signal => {
      const [before, after] = await Promise.all([
        reader.preview(file.before, signal), reader.preview(file.after, signal)
      ]);
      signal.throwIfAborted();
      if (before.kind !== "text" || after.kind !== "text") {
        const reasons = [before, after].flatMap(side => side.kind === "text" ? [] : [previewLabels[side.kind]]);
        void vscode.window.showInformationMessage([...new Set(reasons)].join(" · "));
        return;
      }
      if (this.documents.size >= 64) {
        void vscode.window.showInformationMessage("Close a revision diff before opening another.");
        return;
      }
      const left = this.document(file, "before", before.text);
      const right = this.document(file, "after", after.text);
      const path = file.after?.path ?? file.before?.path ?? "File";
      try {
        await vscode.commands.executeCommand("vscode.diff", left, right, path + " · " + revisionLabel(comparison.pair), { preview: true });
      } catch (error) {
        this.documents.delete(left.toString());
        this.documents.delete(right.toString());
        throw error;
      }
    });
  }
}

export function registerProjectIntelligence(context: vscode.ExtensionContext): void {
  const view = new EvolutionView();
  context.subscriptions.push(
    view,
    vscode.commands.registerCommand(openCommand, () => view.open()),
    vscode.commands.registerCommand(selectCommand, () => view.select()),
    vscode.commands.registerCommand(diffCommand, (key: string, index: number) => view.diff(key, index))
  );
}
