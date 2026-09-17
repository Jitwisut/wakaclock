import * as path from "node:path";
import { createHash } from "node:crypto";
import * as vscode from "vscode";
import { measureLineDelta } from "./lineMeasurement";
import { Logger } from "./logging";
import type { ExternalFileChangeMetadata } from "./types";
import { normalizeFsPath } from "./utils";

const MAX_READ_BYTES = 512 * 1024;
const DEBOUNCE_MS = 150;
const SUPPRESSION_TTL_MS = 2_000;
const MAX_SNAPSHOTS = 2_048;

const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "target",
  ".next",
  "dist",
  "build",
  "coverage",
  "vendor",
  ".cache",
  ".turbo",
]);

export type ExternalFileChangeReceiver = (
  entity: string,
  metadata: ExternalFileChangeMetadata,
  now: number,
  project?: string,
  workspaceRoot?: string,
) => Promise<void>;

interface FileSnapshot {
  text?: string;
  fingerprint?: string;
  mtime?: number;
  size?: number;
}

interface Suppression {
  fingerprint?: string;
  expiresAt: number;
}

/** Watches the VS Code workspace for writes that do not produce a document event. */
export class ExternalFileObserver implements vscode.Disposable {
  private readonly folderWatchers = new Map<string, vscode.Disposable[]>();
  private readonly snapshots = new Map<string, FileSnapshot>();
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private readonly suppressions = new Map<string, Suppression>();
  private disposed = false;

  public constructor(
    private readonly receive: ExternalFileChangeReceiver,
    private readonly projectForUri: (uri: vscode.Uri) => string | undefined,
    private readonly workspaceRootForUri: (uri: vscode.Uri) => string | undefined,
    private readonly logger?: Logger,
  ) {}

  public watchWorkspace(folder: vscode.Uri): void {
    if (this.disposed) return;
    const folderKey = normalizeFsPath(folder.fsPath);
    if (this.folderWatchers.has(folderKey)) return;
    try {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, "**/*"),
        false,
        false,
        false,
      );
      const subscriptions = [
        watcher,
        watcher.onDidCreate((uri) => this.schedule("create", uri)),
        watcher.onDidChange((uri) => this.schedule("modify", uri)),
        watcher.onDidDelete((uri) => this.schedule("delete", uri)),
      ];
      this.folderWatchers.set(folderKey, subscriptions);
    } catch (error) {
      this.logger?.warn("external file watcher unavailable", {
        folder: folderKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public unwatchWorkspace(folder: vscode.Uri): void {
    const folderKey = normalizeFsPath(folder.fsPath);
    const subscriptions = this.folderWatchers.get(folderKey);
    if (!subscriptions) return;
    for (const subscription of subscriptions) subscription.dispose();
    this.folderWatchers.delete(folderKey);
  }

  public seedDocument(
    document: Pick<vscode.TextDocument, "uri" | "getText"> & { isDirty?: boolean },
  ): void {
    if (!this.isEligible(document.uri) || document.isDirty) return;
    try {
      const text = document.getText();
      this.storeSnapshot(this.key(document.uri), {
        text: text.length <= MAX_READ_BYTES ? text : undefined,
        fingerprint: fingerprintText(text),
      });
    } catch {
      // The document may close during activation; the next filesystem event seeds it.
    }
  }

  public noteEditorChange(uri: vscode.Uri, text?: string, isDirty = false): void {
    if (!this.isEligible(uri) || text === undefined) return;
    const key = this.key(uri);
    const fingerprint = fingerprintText(text);
    if (!isDirty) {
      this.storeSnapshot(key, {
        text: text.length <= MAX_READ_BYTES ? text : undefined,
        fingerprint,
      });
    }
    this.suppressions.set(key, {
      fingerprint,
      expiresAt: Date.now() + SUPPRESSION_TTL_MS,
    });
  }

  /**
   * Observe a rename reported by VS Code itself. The filesystem watcher emits a
   * delete/create pair for the same operation; suppress both of those lower-level
   * notifications so the broker receives one rename observation instead.
   */
  public async observeRename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    now = Date.now(),
  ): Promise<void> {
    if (this.disposed || !this.isEligible(oldUri) || !this.isEligible(newUri)) return;
    const newRoot = this.workspaceRootForUri(newUri);
    const oldRoot = this.workspaceRootForUri(oldUri) ?? newRoot;
    if (!oldRoot || !newRoot || normalizeFsPath(oldRoot) !== normalizeFsPath(newRoot)) return;

    const oldKey = this.key(oldUri);
    const newKey = this.key(newUri);
    for (const key of [oldKey, newKey]) {
      const timer = this.pending.get(key);
      if (timer) clearTimeout(timer);
      this.pending.delete(key);
    }

    const previous = this.snapshots.get(oldKey);
    const current = await this.readSnapshot(newUri);
    if (!current) return;

    this.suppressions.set(oldKey, { expiresAt: now + SUPPRESSION_TTL_MS });
    this.suppressions.set(newKey, {
      fingerprint: current.fingerprint,
      expiresAt: now + SUPPRESSION_TTL_MS,
    });

    const metadata: ExternalFileChangeMetadata = {
      event_id: externalEventId(
        newKey,
        "rename",
        current.fingerprint,
        current.mtime,
        now,
      ),
      change_kind: "rename",
      previous_entity: oldKey,
      content_fingerprint: current.fingerprint,
    };
    if (previous?.text !== undefined && current.text !== undefined) {
      const delta = measureLineDelta(previous.text, current.text);
      if (delta.status === "measured") {
        metadata.lines_added = delta.linesAdded;
        metadata.lines_deleted = delta.linesDeleted;
      }
    } else if (current.text !== undefined) {
      metadata.lines_added = logicalLineCount(current.text);
    }

    this.snapshots.delete(oldKey);
    this.storeSnapshot(newKey, current);
    try {
      await this.receive(
        newKey,
        metadata,
        now,
        this.projectForUri(newUri),
        newRoot,
      );
    } catch (error) {
      this.logger?.debug("external rename receiver failed", {
        entity: newKey,
        previousEntity: oldKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public dispose(): void {
    this.disposed = true;
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    for (const subscriptions of this.folderWatchers.values()) {
      for (const subscription of subscriptions) subscription.dispose();
    }
    this.folderWatchers.clear();
  }

  private schedule(kind: "create" | "modify" | "delete", uri: vscode.Uri): void {
    if (this.disposed || !this.isEligible(uri)) return;
    const key = this.key(uri);
    const previous = this.pending.get(key);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.pending.delete(key);
      void this.process(kind, uri);
    }, DEBOUNCE_MS);
    this.pending.set(key, timer);
  }

  private async process(
    kind: "create" | "modify" | "delete",
    uri: vscode.Uri,
  ): Promise<void> {
    if (this.disposed || !this.isEligible(uri)) return;
    const key = this.key(uri);
    const now = Date.now();
    const previous = this.snapshots.get(key);
    const current = kind === "delete" ? undefined : await this.readSnapshot(uri);
    const suppression = this.suppressions.get(key);
    if (suppression && suppression.expiresAt >= now) {
      const matches =
        suppression.fingerprint === undefined ||
        suppression.fingerprint === current?.fingerprint;
      if (matches) {
        this.suppressions.delete(key);
        if (current) this.storeSnapshot(key, current);
        else this.snapshots.delete(key);
        return;
      }
    } else if (suppression) {
      this.suppressions.delete(key);
    }

    if (kind !== "delete" && !current) return;
    if (kind === "delete" && !previous) return;
    if (current && previous?.fingerprint && current.fingerprint === previous.fingerprint) {
      this.storeSnapshot(key, current);
      return;
    }

    const metadata: ExternalFileChangeMetadata = {
      event_id: externalEventId(key, kind, current?.fingerprint, current?.mtime, now),
      change_kind: kind,
      content_fingerprint: current?.fingerprint,
    };
    if (current?.text !== undefined && previous?.text !== undefined) {
      const delta = measureLineDelta(previous.text, current.text);
      if (delta.status === "measured") {
        metadata.lines_added = delta.linesAdded;
        metadata.lines_deleted = delta.linesDeleted;
      }
    }
    if (kind === "delete" && previous?.text !== undefined) {
      metadata.lines_deleted = logicalLineCount(previous.text);
    }

    if (current) this.storeSnapshot(key, current);
    else this.snapshots.delete(key);

    try {
      await this.receive(
        key,
        metadata,
        now,
        this.projectForUri(uri),
        this.workspaceRootForUri(uri),
      );
    } catch (error) {
      this.logger?.debug("external file-change receiver failed", {
        entity: key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async readSnapshot(uri: vscode.Uri): Promise<FileSnapshot | undefined> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type !== vscode.FileType.File) return undefined;
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.subarray(0, Math.min(bytes.length, 8 * 1024)).includes(0)) return undefined;
      const fingerprint = fingerprintBytes(bytes);
      const text = bytes.length <= MAX_READ_BYTES ? new TextDecoder().decode(bytes) : undefined;
      return { text, fingerprint, mtime: stat.mtime, size: stat.size };
    } catch {
      return undefined;
    }
  }

  private storeSnapshot(key: string, snapshot: FileSnapshot): void {
    this.snapshots.delete(key);
    this.snapshots.set(key, snapshot);
    while (this.snapshots.size > MAX_SNAPSHOTS) {
      const oldest = this.snapshots.keys().next().value as string | undefined;
      if (!oldest) break;
      this.snapshots.delete(oldest);
    }
  }

  private key(uri: vscode.Uri): string {
    return normalizeFsPath(uri.fsPath);
  }

  private isEligible(uri: vscode.Uri): boolean {
    if (uri.scheme !== "file") return false;
    const normalized = this.key(uri);
    const components = normalized.split("/").filter(Boolean);
    if (components.some((component) => IGNORED_DIRECTORY_NAMES.has(component))) return false;
    const base = path.basename(normalized);
    return (
      !base.endsWith("~") &&
      !base.endsWith(".swp") &&
      !base.endsWith(".swo") &&
      !base.startsWith(".#") &&
      base !== "4913"
    );
  }
}

function fingerprintBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fingerprintText(text: string): string {
  return fingerprintBytes(new TextEncoder().encode(text));
}

function logicalLineCount(text: string): number {
  if (!text) return 0;
  const lines = text.split(/\r?\n/);
  return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

function externalEventId(
  entity: string,
  kind: string,
  fingerprint: string | undefined,
  mtime: number | undefined,
  now: number,
): string {
  const material = `${entity}\0${kind}\0${fingerprint ?? ""}\0${mtime ?? 0}\0${Math.floor(now / 1000)}`;
  return `observer:${createHash("sha256").update(material).digest("hex")}`;
}

export const externalFileObserverInternals = {
  logicalLineCount,
  externalEventId,
};
