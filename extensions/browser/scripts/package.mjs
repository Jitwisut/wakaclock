import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("dist/packages", { recursive: true });
const zipScript = `from pathlib import Path
import zipfile,sys
root=Path(sys.argv[1])
allowed=sys.argv[3:]
files=[]
for name in allowed:
    item=root/name
    files.extend(item.rglob("*") if item.is_dir() else [item])
with zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED) as archive:
    for item in sorted(set(files)):
        if item.is_file():
            info=zipfile.ZipInfo(item.relative_to(root).as_posix(),(1980,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o100644 << 16
            archive.writestr(info,item.read_bytes())
`;
async function archive(root, filename, entries) {
    execFileSync(process.platform === "win32" ? "python" : "python3", [
        "-c",
        zipScript,
        root,
        "dist/packages/" + filename,
        ...entries,
    ]);
    const sum = createHash("sha256")
        .update(await readFile("dist/packages/" + filename))
        .digest("hex");
    await writeFile(
        "dist/packages/" + filename + ".sha256",
        sum + "  " + filename + "\n",
    );
}
for (const family of ["chromium", "firefox"]) {
    const manifest = JSON.parse(
        await readFile("dist/" + family + "/manifest.json", "utf8"),
    );
    for (const file of [
        "background.js",
        "ui.js",
        "popup.html",
        "options.html",
        "icons/icon-128.png",
    ])
        await readFile("dist/" + family + "/" + file);
    const filename = "atoaxis-" + family + "-" + manifest.version + ".zip";
    // Python stdlib creates portable ZIPs without shell expansion or vendor binaries.
    await archive("dist/" + family, filename, ["."]);
}
const { version } = JSON.parse(await readFile("package.json", "utf8"));
// An explicit allowlist keeps local credentials, generated builds and dependencies out of AMO source.
await archive(".", "atoaxis-browser-source-" + version + ".zip", [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "README.md",
    "STORE.md",
    "RELEASE-CHECKLIST.md",
    "assets",
    "chromium",
    "firefox",
    "safari",
    "scripts",
    "shared",
    "src",
    "test",
]);
