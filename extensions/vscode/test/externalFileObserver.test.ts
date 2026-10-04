import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const watchers = vi.hoisted(() => ({
  create: [] as Array<(uri: unknown) => void>,
  change: [] as Array<(uri: unknown) => void>,
  remove: [] as Array<(uri: unknown) => void>,
}));

vi.mock("vscode", async () => {
  const nodeFs = await import("node:fs");
  const subscription = (list: Array<(uri: unknown) => void>) => (handler: (uri: unknown) => void) => {
    list.push(handler);
    return { dispose: () => undefined };
  };
  return {
    FileType: { File: 1, Directory: 2 },
    RelativePattern: class {
      public constructor(
        public readonly base: unknown,
        public readonly pattern: string,
      ) {}
    },
    workspace: {
      createFileSystemWatcher: () => ({
        dispose: () => undefined,
        onDidCreate: subscription(watchers.create),
        onDidChange: subscription(watchers.change),
        onDidDelete: subscription(watchers.remove),
      }),
      fs: {
        stat: async (uri: { fsPath: string }) => {
          const stat = await nodeFs.promises.stat(uri.fsPath);
          return { type: stat.isFile() ? 1 : 2, mtime: stat.mtimeMs, size: stat.size };
        },
        readFile: async (uri: { fsPath: string }) =>
          new Uint8Array(await nodeFs.promises.readFile(uri.fsPath)),
      },
    },
  };
});

import { ExternalFileObserver } from "../src/externalFileObserver";

const uri = (fsPath: string) => ({ scheme: "file", fsPath });

interface Received {
  entity: string;
  kind?: string;
}

describe("ExternalFileObserver", () => {
  let workspace: string;
  let received: Received[];
  let observer: ExternalFileObserver;

  beforeEach(() => {
    watchers.create.length = 0;
    watchers.change.length = 0;
    watchers.remove.length = 0;
    workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "observer-")));
    // The workspace is itself a repository; its own .git must never count as nested.
    fs.mkdirSync(path.join(workspace, ".git"));
    received = [];
    observer = new ExternalFileObserver(
      async (entity, metadata) => {
        received.push({ entity, kind: metadata.change_kind });
      },
      () => "project",
      () => workspace,
    );
    observer.watchWorkspace(uri(workspace) as never);
  });

  afterEach(() => {
    observer.dispose();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  const write = (relative: string, text = "content\n", mtimeMs?: number) => {
    const file = path.join(workspace, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    if (mtimeMs !== undefined) fs.utimesSync(file, mtimeMs / 1000, mtimeMs / 1000);
    return file;
  };

  const emit = (kind: "create" | "change", file: string) => {
    for (const handler of watchers[kind]) handler(uri(file));
  };

  const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

  /** A linked worktree: its root holds a `.git` file pointing back at the main repository. */
  const makeNestedWorktree = (name: string) => {
    const root = path.join(workspace, ".worktrees", name);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), `gitdir: ${workspace}/.git/worktrees/${name}\n`);
    return root;
  };

  it("reports a write to a file in the workspace's own repository", async () => {
    const file = write("src/a.ts");
    emit("create", file);
    await settle();
    expect(received).toEqual([{ entity: file, kind: "create" }]);
  });

  it("skips the files git writes while creating a nested worktree", async () => {
    makeNestedWorktree("feature");
    const files = ["src/a.ts", "src/b.ts", "README.md"].map((name) =>
      write(path.join(".worktrees/feature", name)),
    );
    for (const file of files) emit("create", file);
    await settle();
    expect(received).toEqual([]);
  });

  it("still reports a later edit inside a nested worktree", async () => {
    makeNestedWorktree("feature");
    const file = write(".worktrees/feature/src/a.ts", "edited\n", Date.now() + 5 * 60_000);
    emit("change", file);
    await settle();
    expect(received).toEqual([{ entity: file, kind: "modify" }]);
  });

  it("treats a nested clone with a .git directory the same way", async () => {
    fs.mkdirSync(path.join(workspace, "vendor-src", "lib", ".git"), { recursive: true });
    const checkout = write("vendor-src/lib/index.ts");
    const later = write("vendor-src/lib/edit.ts", "edited\n", Date.now() + 5 * 60_000);
    emit("create", checkout);
    emit("change", later);
    await settle();
    expect(received).toEqual([{ entity: later, kind: "modify" }]);
  });

  it("drops a bulk write of more than 200 files in one burst", async () => {
    const files = Array.from({ length: 250 }, (_, index) => write(`src/generated/f${index}.ts`));
    for (const file of files) emit("change", file);
    await settle();
    expect(received).toEqual([]);
  });

  it("drops the tail of a bulk write that arrives in a later chunk", async () => {
    const files = Array.from({ length: 300 }, (_, index) => write(`src/generated/f${index}.ts`));
    for (const file of files.slice(0, 250)) emit("change", file);
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const file of files.slice(250)) emit("change", file);
    await settle();
    expect(received).toEqual([]);
  });

  it("reports edits again once a folder is quiet after a bulk write", async () => {
    const files = Array.from({ length: 250 }, (_, index) => write(`src/generated/f${index}.ts`));
    for (const file of files) emit("change", file);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const edited = write("src/a.ts", "edited\n");
    emit("change", edited);
    await settle();
    expect(received).toEqual([{ entity: edited, kind: "modify" }]);
  });

  it("reports every file of a small multi-file write", async () => {
    const files = Array.from({ length: 5 }, (_, index) => write(`src/f${index}.ts`));
    for (const file of files) emit("change", file);
    await settle();
    expect(received.map((entry) => entry.entity).sort()).toEqual([...files].sort());
  });

  it("reports a file once when it changes several times in one burst", async () => {
    const file = write("src/a.ts");
    emit("create", file);
    emit("change", file);
    emit("change", file);
    await settle();
    expect(received).toEqual([{ entity: file, kind: "modify" }]);
  });
});
