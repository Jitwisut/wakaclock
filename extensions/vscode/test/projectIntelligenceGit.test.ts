import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalGitReader } from "../project-intelligence/gitReader";

let repo: string;
function git(...args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function file(path: string, content: string | Buffer): void {
  writeFileSync(join(repo, path), content);
}
function commit(message: string): string {
  git("add", "-A");
  git("commit", "--quiet", "--allow-empty", "-m", message);
  return git("rev-parse", "HEAD");
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "atoaxis-git-fixture-"));
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "/dev/null");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("local Git history", () => {
  it("reads immutable revisions and compares a root commit to the empty tree", async () => {
    file("line.txt", "root\n");
    const root = commit("first");
    const reader = await LocalGitReader.open(repo);
    const before = await reader.resolve("HEAD");
    file("line.txt", "second\n");
    const head = commit("second");
    file("line.txt", "unsaved in Git\n");

    expect(before).toBe(root);
    expect(await reader.parents(root)).toEqual([]);
    const rootChanges = (await reader.compare(null, root)).changes;
    expect(rootChanges).toMatchObject([{ kind: "added", before: null, after: { path: "line.txt" } }]);
    const { changes, pair } = await reader.compare(before, head);
    expect(pair).toMatchObject({ base: root, head, schema_version: 1 });
    expect(await reader.preview(changes[0].before)).toEqual({ kind: "text", text: "root\n" });
    expect(await reader.preview(changes[0].after)).toEqual({ kind: "text", text: "second\n" });
    expect(git("status", "--porcelain")).toBe("M line.txt");
    expect(git("rev-parse", "HEAD")).toBe(head);
  });

  it("paginates a pinned history with Unicode subjects", async () => {
    for (let i = 0; i < 51; i++) commit("ข้อความ " + i);
    const reader = await LocalGitReader.open(repo);
    const tip = await reader.resolve("HEAD");
    commit("new branch tip");
    const first = await reader.commits(tip, 0);
    const last = await reader.commits(tip, 50);
    expect(first.items).toHaveLength(50);
    expect(first.items[0]).toEqual({ id: tip, subject: "ข้อความ 50" });
    expect(first.hasMore).toBe(true);
    expect(last).toMatchObject({ items: [{ subject: "ข้อความ 0" }], hasMore: false });
  });

  it("reports unambiguous exact renames and keeps duplicate blobs separate", async () => {
    file("one.txt", "unique");
    file("a.txt", "duplicate");
    file("b.txt", "duplicate");
    const base = commit("before");
    renameSync(join(repo, "one.txt"), join(repo, "name\twith space.txt"));
    renameSync(join(repo, "a.txt"), join(repo, "c.txt"));
    renameSync(join(repo, "b.txt"), join(repo, "d.txt"));
    const head = commit("after");
    const reader = await LocalGitReader.open(repo);
    const { changes } = await reader.compare(base, head);
    expect(changes.filter(change => change.kind === "renamed")).toMatchObject([
      { before: { path: "one.txt" }, after: { path: "name\\x09with space.txt" } }
    ]);
    expect(changes.filter(change => change.kind === "added")).toHaveLength(2);
    expect(changes.filter(change => change.kind === "deleted")).toHaveLength(2);
  });

  it("lets callers compare either parent of a merge", async () => {
    const root = commit("root");
    git("switch", "-c", "topic");
    file("topic.txt", "topic");
    const topic = commit("topic");
    git("switch", "main");
    file("main.txt", "main");
    const main = commit("main");
    git("merge", "--no-ff", "-m", "merge", "topic");
    const reader = await LocalGitReader.open(repo);
    const merge = await reader.resolve("HEAD");
    expect(await reader.parents(merge)).toEqual([main, topic]);
    expect((await reader.compare(main, merge)).changes).toMatchObject([{ after: { path: "topic.txt" } }]);
    expect((await reader.compare(topic, merge)).changes).toMatchObject([{ after: { path: "main.txt" } }]);
    expect((await reader.compare(root, merge)).changes).toHaveLength(2);
  });

  it("distinguishes binary, LFS and over-limit files", async () => {
    file("bin", Buffer.from([0, 255]));
    file("lfs", "version https://git-lfs.github.com/spec/v1\noid sha256:fixture\nsize 12\n");
    file("many-lines", "x\n".repeat(20_001));
    file("large", "x".repeat(1024 * 1024 + 1));
    const reader = await LocalGitReader.open(repo);
    const { changes } = await reader.compare(null, commit("root"));
    const previews = await Promise.all(changes.map(async change => [
      change.after?.path, (await reader.preview(change.after)).kind
    ]));
    expect(Object.fromEntries(previews)).toEqual({
      bin: "binary", lfs: "lfs", "many-lines": "too_large", large: "too_large"
    });
  });

  it("reads symlink blobs without following their target and recognizes gitlinks", async () => {
    const target = join(tmpdir(), "outside-atoaxis-fixture.txt");
    symlinkSync(target, join(repo, "link"));
    const base = commit("root");
    git("update-index", "--add", "--cacheinfo", "160000," + base + ",nested");
    git("commit", "--quiet", "-m", "add gitlink");
    const reader = await LocalGitReader.open(repo);
    const head = await reader.resolve("HEAD");
    const { changes } = await reader.compare(base, head);
    expect(await reader.preview(changes[0].after)).toEqual({ kind: "submodule" });
    const root = await reader.compare(null, base);
    expect(await reader.preview(root.changes[0].after)).toEqual({ kind: "text", text: target });
  });

  it("rejects a workspace below the repository root instead of reading its parent", async () => {
    const child = join(repo, "nested");
    mkdirSync(child);
    await expect(LocalGitReader.open(child)).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("preserves different paths when tab and literal escape sequences look similar", async () => {
    const names = ["a\tb.ts", "a\\x09b.ts"];
    names.forEach((name, index) => file(name, "content " + index));
    const reader = await LocalGitReader.open(repo);
    const { changes } = await reader.compare(null, commit("names"));
    expect(new Set(changes.map(change => change.after!.path)).size).toBe(2);
    expect(changes.map(change => Buffer.from(change.after!.pathBytesBase64, "base64").toString()).sort())
      .toEqual(names.sort());
  });

  it("treats missing objects as incomplete even with a promisor remote", async () => {
    file("file", "local blob");
    const reader = await LocalGitReader.open(repo);
    const { changes } = await reader.compare(null, commit("root"));
    const blob = changes[0].after!;
    git("config", "remote.origin.url", "file:///nonexistent-atoaxis-fixture");
    git("config", "remote.origin.promisor", "true");
    git("config", "remote.origin.partialclonefilter", "blob:none");
    rmSync(join(repo, ".git", "objects", blob.id.slice(0, 2), blob.id.slice(2)));
    await expect(reader.preview(blob)).rejects.toMatchObject({ reason: "incomplete" });
  });

  it("does not treat a shallow boundary as a root commit", async () => {
    commit("first");
    file("file", "new");
    const tip = commit("second");
    const reader = await LocalGitReader.open(repo);
    const [parent] = await reader.parents(tip);
    writeFileSync(join(repo, ".git", "shallow"), tip + "\n");
    rmSync(join(repo, ".git", "objects", parent.slice(0, 2), parent.slice(2)));
    expect(await reader.parents(tip)).toEqual([parent]);
    await expect(reader.compare(null, tip)).rejects.toMatchObject({ reason: "incomplete" });
    await expect(reader.compare(parent, tip)).rejects.toMatchObject({ reason: "incomplete" });
  });

  it("reads a linked worktree by its own checked-out revision", async () => {
    const base = commit("root");
    file("changed", "tip");
    const head = commit("second");
    const worktree = mkdtempSync(join(tmpdir(), "atoaxis-linked-fixture-"));
    try {
      git("worktree", "add", "--quiet", "--detach", worktree, base);
      const reader = await LocalGitReader.open(worktree);
      expect(await reader.resolve("HEAD")).toBe(base);
      expect((await reader.compare(base, head)).changes).toMatchObject([{ after: { path: "changed" } }]);
    } finally {
      git("worktree", "remove", worktree);
    }
  });
});
