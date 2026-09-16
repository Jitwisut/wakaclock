import * as path from "node:path";
import { createHash } from "node:crypto";
import * as vscode from "vscode";
import { measureLineDelta } from "./lineMeasurement";
import { Logger } from "./logging";
import type { ExternalFileChangeMetadata } from "./types";
import { normalizeFsPath } from "./utils";

/** Maximum file size for a local before/after comparison. */
const MAX_READ_BYTES = 512 * 1024;
/** Coalesce atomic-save bursts and suppress the matching editor event. */
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

/**
 * Receives file-system changes that do not reliably produce a VS Code document
 * event.  This is the path used by Codex Desktop's `apply_patch`, external editors,
 * and atomic-save writers.  It observes only the configured workspace folders and
 * forwards metadata into the same CLI/queue path as normal editor heartbeats.
 */
export class ExternalFileObserver implements vscode.Disposable {
  private readonly folderWatchers = new Map<string, vscode.Disposable[]>();
  private readonly snapshots = new Map<string, FileSnapshot>();
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private readonly suppressions = new Map<string, Suppression>();
  private disposed = false;

  public constructor(
    private readonly receive: ExternalFileChangeReceiver,
    private readonly projectForUri: (uri: vscode.Uri) => string | undefined,
    private readonly logger?: Logger,
  ) {}

  /** Start watching one VS Code workspace folder. */
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

  /** Stop watching a workspace folder that was removed from the current window. */
  public unwatchWorkspace(folder: vscode.Uri): void {
    const folderKey = normalizeFsPath(folder.fsPath);
    const subscriptions = this.folderWatchers.get(folderKey);
    if (!subscriptions) return;
    for (const subscription of subscriptions) subscription.dispose();
    this.folderWatchers.delete(folderKey);
  }

  /** Seed a snapshot from an already-open, clean document without reading it again. */
  public seedDocument(
    document: Pick<vscode.TextDocument, "uri" | "getText"> & { isDirty?: boolean },
  ): void {
    if (!this.isEligible(document.uri)) return;
    // A dirty document is ahead of disk. Treating its in-memory text as the disk
    // baseline would turn a later Codex/formatter write into an incorrect delta.
    if (document.isDirty) return;
    try {
      const text = document.getText();
      this.storeSnapshot(this.key(document.uri), {
        text: text.length <= MAX_READ_BYTES ? text : undefined,
        fingerprint: fingerprintText(text),
      });
    } catch {
      // A document can close between activation and this call; the watcher will
      // establish a fresh baseline on the next disk event.
    }
  }

  /** Mark an editor-side event so the corresponding watcher notification is ignored. */
  public noteEditorChange(uri: vscode.Uri, text?: string, isDirty = false): void {
    if (!this.isEligible(uri)) return;
    // If VS Code cannot read the document during shutdown, do not suppress a
    // possibly independent external write with an unknown fingerprint.
    if (text === undefined) return;
    const key = this.key(uri);
    const fingerprint = fingerprintText(text);
    // Keep the on-disk snapshot separate from a dirty in-memory editor version.
    // The latter is useful only for suppressing the matching watcher notification;
    // it must not become the before-version for an external write.
    if (!isDirty) {
      this.storeSnapshot(key, {
        text: text.length <= MAX_READ_BYTES ? text : undefined,
        fingerprint,
      });
    }
    this.suppressions.set(key, { fingerprint, expiresAt: Date.now() + SUPPRESSION_TTL_MS });
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

  private async process(kind: "create" | "modify" | "delete", uri: vscode.Uri): Promise<void> {
    if (this.disposed || !this.isEligible(uri)) return;
    const key = this.key(uri);
    const now = Date.now();
    const previous = this.snapshots.get(key);
    const current = kind === "delete" ? undefined : await this.readSnapshot(uri);
    const suppression = this.suppressions.get(key);
    if (suppression && suppression.expiresAt >= now) {
      const matches = suppression.fingerprint === undefined ||
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
    // Do not emit a deletion marker for a file whose creation/change we never
    // observed (most commonly a binary asset). This keeps workspace noise out of
    // the coding stream while preserving deletes for tracked text files.
    if (kind === "delete" && !previous) return;
    if (current && previous?.fingerprint && current.fingerprint === previous.fingerprint) {
      // macOS FSEvents often reports both the atomic rename and the final write.
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
      await this.receive(key, metadata, now, this.projectForUri(uri));
    } catch (error) {
      // Receiver implementations own durable retry/queue semantics. Keep the
      // watcher alive if one individual CLI invocation fails.
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
      // Binary assets are not editor coding activity. A bounded NUL-byte probe
      // avoids storing or forwarding them while keeping the watcher generic for
      // Markdown and extension-less source files.
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
    return !base.endsWith("~") && !base.endsWith(".swp") && !base.endsWith(".swo") &&
      !base.startsWith(".#") && base !== "4913";
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
  // Keep the content fingerprint in the identity for retry stability, but also
  // include the file's modification time. A file can legitimately change A→B→A;
  // using the fingerprint alone would make the second A write look like a server
  // duplicate and lose a real activity marker.
  const material = `${entity}\0${kind}\0${fingerprint ?? ""}\0${mtime ?? 0}\0${Math.floor(now / 1000)}`;
  return `observer:${createHash("sha256").update(material).digest("hex")}`;
}

/** Pure helpers kept exported for focused unit tests without a VS Code host. */
export const externalFileObserverInternals = {
  logicalLineCount,
  externalEventId,
};
