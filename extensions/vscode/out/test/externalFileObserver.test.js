"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const vitest_1 = require("vitest");
const watchers = vitest_1.vi.hoisted(() => ({
    create: [],
    change: [],
    remove: [],
}));
vitest_1.vi.mock("vscode", async () => {
    const nodeFs = await Promise.resolve().then(() => __importStar(require("node:fs")));
    const subscription = (list) => (handler) => {
        list.push(handler);
        return { dispose: () => undefined };
    };
    return {
        FileType: { File: 1, Directory: 2 },
        RelativePattern: class {
            base;
            pattern;
            constructor(base, pattern) {
                this.base = base;
                this.pattern = pattern;
            }
        },
        workspace: {
            createFileSystemWatcher: () => ({
                dispose: () => undefined,
                onDidCreate: subscription(watchers.create),
                onDidChange: subscription(watchers.change),
                onDidDelete: subscription(watchers.remove),
            }),
            fs: {
                stat: async (uri) => {
                    const stat = await nodeFs.promises.stat(uri.fsPath);
                    return { type: stat.isFile() ? 1 : 2, mtime: stat.mtimeMs, size: stat.size };
                },
                readFile: async (uri) => new Uint8Array(await nodeFs.promises.readFile(uri.fsPath)),
            },
        },
    };
});
const externalFileObserver_1 = require("../src/externalFileObserver");
const uri = (fsPath) => ({ scheme: "file", fsPath });
(0, vitest_1.describe)("ExternalFileObserver", () => {
    let workspace;
    let received;
    let observer;
    (0, vitest_1.beforeEach)(() => {
        watchers.create.length = 0;
        watchers.change.length = 0;
        watchers.remove.length = 0;
        workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "observer-")));
        // The workspace is itself a repository; its own .git must never count as nested.
        fs.mkdirSync(path.join(workspace, ".git"));
        received = [];
        observer = new externalFileObserver_1.ExternalFileObserver(async (entity, metadata) => {
            received.push({ entity, kind: metadata.change_kind });
        }, () => "project", () => workspace);
        observer.watchWorkspace(uri(workspace));
    });
    (0, vitest_1.afterEach)(() => {
        observer.dispose();
        fs.rmSync(workspace, { recursive: true, force: true });
    });
    const write = (relative, text = "content\n", mtimeMs) => {
        const file = path.join(workspace, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
        if (mtimeMs !== undefined)
            fs.utimesSync(file, mtimeMs / 1000, mtimeMs / 1000);
        return file;
    };
    const emit = (kind, file) => {
        for (const handler of watchers[kind])
            handler(uri(file));
    };
    const settle = () => new Promise((resolve) => setTimeout(resolve, 400));
    /** A linked worktree: its root holds a `.git` file pointing back at the main repository. */
    const makeNestedWorktree = (name) => {
        const root = path.join(workspace, ".worktrees", name);
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(path.join(root, ".git"), `gitdir: ${workspace}/.git/worktrees/${name}\n`);
        return root;
    };
    (0, vitest_1.it)("reports a write to a file in the workspace's own repository", async () => {
        const file = write("src/a.ts");
        emit("create", file);
        await settle();
        (0, vitest_1.expect)(received).toEqual([{ entity: file, kind: "create" }]);
    });
    (0, vitest_1.it)("skips the files git writes while creating a nested worktree", async () => {
        makeNestedWorktree("feature");
        const files = ["src/a.ts", "src/b.ts", "README.md"].map((name) => write(path.join(".worktrees/feature", name)));
        for (const file of files)
            emit("create", file);
        await settle();
        (0, vitest_1.expect)(received).toEqual([]);
    });
    (0, vitest_1.it)("still reports a later edit inside a nested worktree", async () => {
        makeNestedWorktree("feature");
        const file = write(".worktrees/feature/src/a.ts", "edited\n", Date.now() + 5 * 60_000);
        emit("change", file);
        await settle();
        (0, vitest_1.expect)(received).toEqual([{ entity: file, kind: "modify" }]);
    });
    (0, vitest_1.it)("treats a nested clone with a .git directory the same way", async () => {
        fs.mkdirSync(path.join(workspace, "vendor-src", "lib", ".git"), { recursive: true });
        const checkout = write("vendor-src/lib/index.ts");
        const later = write("vendor-src/lib/edit.ts", "edited\n", Date.now() + 5 * 60_000);
        emit("create", checkout);
        emit("change", later);
        await settle();
        (0, vitest_1.expect)(received).toEqual([{ entity: later, kind: "modify" }]);
    });
    (0, vitest_1.it)("drops a bulk write of more than 200 files in one burst", async () => {
        const files = Array.from({ length: 250 }, (_, index) => write(`src/generated/f${index}.ts`));
        for (const file of files)
            emit("change", file);
        await settle();
        (0, vitest_1.expect)(received).toEqual([]);
    });
    (0, vitest_1.it)("drops the tail of a bulk write that arrives in a later chunk", async () => {
        const files = Array.from({ length: 300 }, (_, index) => write(`src/generated/f${index}.ts`));
        for (const file of files.slice(0, 250))
            emit("change", file);
        await new Promise((resolve) => setTimeout(resolve, 200));
        for (const file of files.slice(250))
            emit("change", file);
        await settle();
        (0, vitest_1.expect)(received).toEqual([]);
    });
    (0, vitest_1.it)("reports edits again once a folder is quiet after a bulk write", async () => {
        const files = Array.from({ length: 250 }, (_, index) => write(`src/generated/f${index}.ts`));
        for (const file of files)
            emit("change", file);
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        const edited = write("src/a.ts", "edited\n");
        emit("change", edited);
        await settle();
        (0, vitest_1.expect)(received).toEqual([{ entity: edited, kind: "modify" }]);
    });
    (0, vitest_1.it)("reports every file of a small multi-file write", async () => {
        const files = Array.from({ length: 5 }, (_, index) => write(`src/f${index}.ts`));
        for (const file of files)
            emit("change", file);
        await settle();
        (0, vitest_1.expect)(received.map((entry) => entry.entity).sort()).toEqual([...files].sort());
    });
    (0, vitest_1.it)("reports a file once when it changes several times in one burst", async () => {
        const file = write("src/a.ts");
        emit("create", file);
        emit("change", file);
        emit("change", file);
        await settle();
        (0, vitest_1.expect)(received).toEqual([{ entity: file, kind: "modify" }]);
    });
});
//# sourceMappingURL=externalFileObserver.test.js.map