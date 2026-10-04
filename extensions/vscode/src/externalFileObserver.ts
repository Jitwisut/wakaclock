import * as fs from "node:fs";
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
// A batch is the set of files one workspace folder reported before it went quiet for
// DEBOUNCE_MS. More distinct files than this in one batch is a bulk filesystem operation
// (branch switch, pull, unzip, worktree add/remove), not someone writing code.
const BULK_BATCH_FILES = 200;
// A folder that never goes quiet is flushed anyway so a steady trickle cannot starve it.
const MAX_BATCH_MS = 5_000;
// After a bulk batch, the folder's events keep being dropped until it has been quiet this
// long, so the tail of a large operation that arrives in later chunks is not reported.
const BULK_QUIET_MS = 1_500;
// Files git writes while creating a nested worktree or clone carry an mtime right after
// that tree's `.git` entry was created. Later writes in the same tree are real edits.
const CHECKOUT_WINDOW_MS = 60_000;
const GIT_ROOT_CACHE_TTL_MS = 30_000;
const MAX_GIT_ROOT_CACHE = 4_096;

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

type ChangeKind = "create" | "modify" | "delete";

interface PendingBatch {
  events: Map<string, { kind: ChangeKind; uri: vscode.Uri }>;
  startedAt: number;
  timer?: NodeJS.Timeout;
}

interface NestedGitRootEntry {
  /** When the nested tree's `.git` entry was created; undefined when `dir` is not a git root. */
  createdAt?: number;
  checkedAt: number;
}

/** Watches the VS Code workspace for writes that do not produce a document event. */
export class ExternalFileObserver implements vscode.Disposable {
  private readonly folderWatchers = new Map<string, vscode.Disposable[]>();
  private readonly snapshots = new Map<string, FileSnapshot>();
  private readonly batches = new Map<string, PendingBatch>();
  private readonly bulkUntil = new Map<string, number>();
  private readonly suppressions = new Map<string, Suppression>();
  private readonly gitRoots = new Map<string, NestedGitRootEntry>();
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
    for (const key of [oldKey, newKey]) this.cancelPending(key);

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
    for (const batch of this.batches.values()) {
      if (batch.timer) clearTimeout(batch.timer);
    }
    this.batches.clear();
    this.bulkUntil.clear();
    for (const subscriptions of this.folderWatchers.values()) {
      for (const subscription of subscriptions) subscription.dispose();
    }
    this.folderWatchers.clear();
  }

  /**
   * Collect events per workspace folder until the folder has been quiet for DEBOUNCE_MS
   * (or MAX_BATCH_MS has passed), then process the batch. Only the last event per file
   * counts, as with a per-file debounce.
   */
  private schedule(kind: ChangeKind, uri: vscode.Uri): void {
    if (this.disposed || !this.isEligible(uri)) return;
    const key = this.key(uri);
    const root = this.batchRoot(uri);
    const now = Date.now();
    if ((this.bulkUntil.get(root) ?? 0) > now) {
      this.bulkUntil.set(root, now + BULK_QUIET_MS);
      this.snapshots.delete(key);
      return;
    }
    this.bulkUntil.delete(root);
    let batch = this.batches.get(root);
    if (!batch) {
      batch = { events: new Map(), startedAt: now };
      this.batches.set(root, batch);
    }
    batch.events.delete(key);
    batch.events.set(key, { kind, uri });
    if (batch.timer) clearTimeout(batch.timer);
    const delay = now - batch.startedAt >= MAX_BATCH_MS ? 0 : DEBOUNCE_MS;
    batch.timer = setTimeout(() => this.flush(root), delay);
  }

  private flush(root: string): void {
    const batch = this.batches.get(root);
    if (!batch) return;
    this.batches.delete(root);
    if (this.disposed) return;
    if (batch.events.size > BULK_BATCH_FILES) {
      // Reading thousands of files to fingerprint a checkout would cost more than the
      // events are worth, so their snapshots are dropped too.
      for (const key of batch.events.keys()) this.snapshots.delete(key);
      this.bulkUntil.set(root, Date.now() + BULK_QUIET_MS);
      this.logger?.debug("skipped bulk filesystem write", {
        workspaceRoot: root || undefined,
        files: batch.events.size,
      });
      return;
    }
    for (const { kind, uri } of batch.events.values()) void this.process(kind, uri);
  }

  private cancelPending(key: string): void {
    for (const batch of this.batches.values()) batch.events.delete(key);
  }

  private batchRoot(uri: vscode.Uri): string {
    const root = this.workspaceRootForUri(uri);
    return root ? normalizeFsPath(root) : "";
  }

  private async process(kind: ChangeKind, uri: vscode.Uri): Promise<void> {
    if (this.disposed || !this.isEligible(uri)) return;
    const key = this.key(uri);
    const now = Date.now();
    const previous = this.snapshots.get(key);
    const current = kind === "delete" ? undefined : await this.readSnapshot(uri);
    if (current && this.isNestedCheckoutWrite(key, uri, current, now)) {
      // Leave no snapshot behind: removing the tree later must not read as deletions.
      this.snapshots.delete(key);
      return;
    }
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

  /**
   * True when git wrote this file while checking out a working tree nested inside the
   * workspace (a linked worktree under `.worktrees/`, a clone, a submodule). Edits made
   * in that tree afterwards still count; the workspace's own repository is never treated
   * as nested.
   */
  private isNestedCheckoutWrite(
    key: string,
    uri: vscode.Uri,
    snapshot: FileSnapshot,
    now: number,
  ): boolean {
    if (snapshot.mtime === undefined) return false;
    const workspaceRoot = this.workspaceRootForUri(uri);
    if (!workspaceRoot) return false;
    const createdAt = this.nestedGitRootCreatedAt(key, normalizeFsPath(workspaceRoot), now);
    return createdAt !== undefined && snapshot.mtime <= createdAt + CHECKOUT_WINDOW_MS;
  }

  private nestedGitRootCreatedAt(
    file: string,
    workspaceRoot: string,
    now: number,
  ): number | undefined {
    const prefix = workspaceRoot.endsWith("/") ? workspaceRoot : `${workspaceRoot}/`;
    let dir = path.posix.dirname(file);
    while (dir.startsWith(prefix)) {
      let entry = this.gitRoots.get(dir);
      if (!entry || now - entry.checkedAt > GIT_ROOT_CACHE_TTL_MS) {
        entry = { createdAt: gitEntryCreatedAt(dir), checkedAt: now };
        if (this.gitRoots.size >= MAX_GIT_ROOT_CACHE) this.gitRoots.clear();
        this.gitRoots.set(dir, entry);
      }
      if (entry.createdAt !== undefined) return entry.createdAt;
      dir = path.posix.dirname(dir);
    }
    return undefined;
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

/**
 * When `dir/.git` (a directory for a clone, a file for a linked worktree) was created,
 * or undefined when there is none or the time is unknowable. birthtime is 0 on
 * filesystems that do not record it. A worktree's `.git` file is written once, so its
 * mtime is an exact fallback; a `.git` directory's mtime moves with every git command,
 * so without a birthtime the checkout rule does not apply and only the bulk guard does.
 */
function gitEntryCreatedAt(dir: string): number | undefined {
  try {
    const stat = fs.statSync(path.join(dir, ".git"));
    if (stat.birthtimeMs > 0) return stat.birthtimeMs;
    return stat.isFile() ? stat.mtimeMs : undefined;
  } catch {
    return undefined;
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
