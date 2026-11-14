import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import { devNull } from "node:os";
import { isAbsolute, relative, sep } from "node:path";

const objectId = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const mode = /^(?:000000|100644|100755|120000|160000)$/;
const previewBytes = 1024 * 1024;
const outputLimit = 16 * 1024 * 1024;
export const commitPageSize = 50;

export class GitReadError extends Error {
  constructor(readonly reason: "unavailable" | "incomplete" | "limit" | "cancelled", message: string) {
    super(message);
    this.name = "GitReadError";
  }
}

export interface CodeRevisionPair {
  readonly schema_version: 1;
  readonly repository: string;
  readonly base: string | null;
  readonly head: string;
}

export interface Commit {
  readonly id: string;
  readonly subject: string;
}

export interface BlobRef {
  readonly id: string;
  readonly path: string;
  readonly pathBytesBase64: string;
  readonly mode: string;
}

export interface FileChange {
  readonly kind: "added" | "deleted" | "modified" | "renamed";
  readonly before: BlobRef | null;
  readonly after: BlobRef | null;
}

export type TextPreview =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "submodule" | "lfs" | "binary" | "too_large" };

function localGit(cwd: string, args: string[], signal?: AbortSignal, maxBytes = outputLimit): Promise<Buffer> {
  signal?.throwIfAborted();
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^git_/i.test(name)));
  Object.assign(env, {
    GIT_ALLOW_PROTOCOL: "",
    GIT_CONFIG_GLOBAL: devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C"
  });

  return new Promise((resolve, reject) => {
    const child = spawn("git", [
      "-c", "core.fsmonitor=false", "-c", "core.quotePath=true", "--no-pager", ...args
    ], { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    let size = 0;
    let failure: Error | undefined;
    const stop = (error: Error) => {
      failure ??= error;
      child.kill("SIGKILL");
    };
    const abort = () => stop(new GitReadError("cancelled", "Git read cancelled."));
    const timer = setTimeout(
      () => stop(new GitReadError("limit", "Git read exceeded its time limit.")),
      10_000
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on("data", (chunk: Buffer) => {
      if (failure) return;
      size += chunk.length;
      if (size > maxBytes) {
        stop(new GitReadError("limit", "Git output exceeded the size limit."));
        return;
      }
      chunks.push(chunk);
    });
    child.on("error", () => {
      failure ??= new GitReadError("unavailable", "Git could not be started.");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (code !== 0) reject(new GitReadError("incomplete", "Git could not read the selected revision or object locally."));
      else resolve(Buffer.concat(chunks, size));
    });
  });
}

function checkedId(id: string): string {
  if (!objectId.test(id)) throw new GitReadError("incomplete", "Invalid Git object identifier.");
  return id;
}

function nulFields(raw: Buffer): Buffer[] {
  const fields: Buffer[] = [];
  let start = 0;
  for (let end = raw.indexOf(0); end >= 0; end = raw.indexOf(0, start)) {
    fields.push(raw.subarray(start, end));
    start = end + 1;
  }
  if (start !== raw.length) throw new GitReadError("incomplete", "Incomplete Git output.");
  return fields;
}

function displayPath(raw: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw)
      .replace(/\\/g, "\\\\")
      .replace(/[\x00-\x1f\x7f]/g, char => "\\x" + char.charCodeAt(0).toString(16).padStart(2, "0"));
  } catch {
    return [...raw].map(byte => byte >= 32 && byte <= 126 && byte !== 92
      ? String.fromCharCode(byte) : "\\x" + byte.toString(16).padStart(2, "0")).join("");
  }
}

function exactRenames(changes: FileChange[]): FileChange[] {
  const added = new Map<string, number[]>();
  const deleted = new Map<string, number[]>();
  for (const [index, change] of changes.entries()) {
    const side = change.kind === "added" ? change.after : change.kind === "deleted" ? change.before : null;
    if (!side || side.mode === "160000") continue;
    const key = side.mode + ":" + side.id;
    const group = change.kind === "added" ? added : deleted;
    const matches = group.get(key);
    if (matches) matches.push(index);
    else group.set(key, [index]);
  }
  const replacements = new Map<number, FileChange>();
  const removed = new Set<number>();
  for (const [key, from] of deleted) {
    const to = added.get(key);
    if (from.length !== 1 || to?.length !== 1) continue;
    replacements.set(to[0], { kind: "renamed", before: changes[from[0]].before, after: changes[to[0]].after });
    removed.add(from[0]);
  }
  return changes.flatMap((change, index) => removed.has(index) ? [] : [replacements.get(index) ?? change]);
}

export class LocalGitReader {
  private constructor(readonly root: string) {}

  static async open(workspaceFolder: string, signal?: AbortSignal): Promise<LocalGitReader> {
    const folder = await realpath(workspaceFolder);
    const result = await localGit(folder, ["rev-parse", "--show-toplevel"], signal);
    const root = await realpath(result.toString("utf8").replace(/\n$/, ""));
    const rel = relative(folder, root);
    if (isAbsolute(rel) || rel === ".." || rel.startsWith(".." + sep)) {
      throw new GitReadError("unavailable", "Open the repository root as a trusted workspace folder.");
    }
    return new LocalGitReader(root);
  }

  async resolve(ref: string, signal?: AbortSignal): Promise<string> {
    if (!ref || Buffer.byteLength(ref) > 1024 || /[\x00-\x20\x7f]/.test(ref)) {
      throw new GitReadError("unavailable", "Enter a Git revision.");
    }
    const raw = await localGit(this.root, ["rev-parse", "--verify", "--end-of-options", ref + "^{commit}"], signal);
    return checkedId(raw.toString("ascii").trim());
  }

  async parents(commit: string, signal?: AbortSignal): Promise<string[]> {
    // Read the actual commit headers. Shallow history can hide parents from git log.
    const raw = await localGit(this.root, ["cat-file", "commit", checkedId(commit)], signal, previewBytes);
    const headerEnd = raw.indexOf("\n\n");
    if (headerEnd < 0) throw new GitReadError("incomplete", "Invalid Git commit headers.");
    return raw.subarray(0, headerEnd).toString("ascii").split("\n")
      .filter(line => line.startsWith("parent ")).map(line => checkedId(line.slice(7)));
  }

  async commits(start: string, offset: number, signal?: AbortSignal): Promise<{ items: Commit[]; hasMore: boolean }> {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new RangeError("Invalid history offset");
    const raw = await localGit(this.root, [
      "log", "--no-show-signature", "--topo-order", "--format=%H%x00%s", "--encoding=UTF-8", "-z",
      "--max-count=" + (commitPageSize + 1), "--skip=" + offset, checkedId(start), "--"
    ], signal);
    const fields = nulFields(raw);
    if (fields.length % 2 !== 0) throw new GitReadError("incomplete", "Incomplete Git commit history.");
    const items: Commit[] = [];
    for (let index = 0; index < fields.length; index += 2) {
      items.push({ id: checkedId(fields[index].toString("ascii")), subject: fields[index + 1].toString("utf8") });
    }
    return { items: items.slice(0, commitPageSize), hasMore: items.length > commitPageSize };
  }

  async compare(base: string | null, head: string, signal?: AbortSignal): Promise<{
    pair: CodeRevisionPair; changes: FileChange[];
  }> {
    checkedId(head);
    if (base === null && (await this.parents(head, signal)).length) {
      throw new GitReadError("incomplete", "An empty base is only available for a root commit.");
    }
    if (base !== null) checkedId(base);
    const raw = await localGit(this.root, [
      "diff-tree", "-r", "--raw", "--no-abbrev", "--no-commit-id", "-z", "--no-renames",
      "--no-ext-diff", "--no-textconv", "--ignore-submodules=none",
      ...(base === null ? ["--root", head] : [base, head]), "--"
    ], signal);
    const fields = nulFields(raw);
    if (fields.length % 2 !== 0) throw new GitReadError("incomplete", "Incomplete Git file list.");
    const changes: FileChange[] = [];
    for (let index = 0; index < fields.length; index += 2) {
      const [oldMode, newMode, oldId, newId, status] = fields[index].toString("ascii").slice(1).split(" ");
      if (!mode.test(oldMode) || !mode.test(newMode) || !/^[ADMT]$/.test(status)) {
        throw new GitReadError("incomplete", "Unsupported Git file change.");
      }
      const path = displayPath(fields[index + 1]);
      const pathBytesBase64 = fields[index + 1].toString("base64");
      const before = oldMode === "000000" ? null : { id: checkedId(oldId), mode: oldMode, path, pathBytesBase64 };
      const after = newMode === "000000" ? null : { id: checkedId(newId), mode: newMode, path, pathBytesBase64 };
      changes.push({ before, after, kind: status === "A" ? "added" : status === "D" ? "deleted" : "modified" });
    }
    return { pair: { schema_version: 1, repository: this.root, base, head }, changes: exactRenames(changes) };
  }

  async preview(blob: BlobRef | null, signal?: AbortSignal): Promise<TextPreview> {
    if (!blob) return { kind: "text", text: "" };
    if (blob.mode === "160000") return { kind: "submodule" };
    const id = checkedId(blob.id);
    const size = Number((await localGit(this.root, ["cat-file", "-s", id], signal, 64)).toString("ascii").trim());
    if (!Number.isSafeInteger(size) || size < 0) throw new GitReadError("incomplete", "Invalid Git blob size.");
    if (size > previewBytes) return { kind: "too_large" };
    const raw = await localGit(this.root, ["cat-file", "blob", id], signal, previewBytes);
    if (raw.includes(0)) return { kind: "binary" };
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
    } catch {
      return { kind: "binary" };
    }
    if (/^version https:\/\/git-lfs\.github\.com\/spec\/v1\r?\n/.test(text)) return { kind: "lfs" };
    if (text.split(/\r\n|\r|\n/).length > 20_000) return { kind: "too_large" };
    return { kind: "text", text };
  }
}
