import { readFile } from "node:fs/promises";
for (const family of ["chromium", "firefox", "safari"]) {
    const dir = "dist/" + family;
    const manifest = JSON.parse(await readFile(dir + "/manifest.json", "utf8"));
    if (
        manifest.manifest_version !== 3 ||
        manifest.content_scripts ||
        manifest.externally_connectable
    )
        throw new Error("Unexpected executable surface");
    if (
        family === "chromium" &&
        manifest.background.service_worker !== "background.js"
    )
        throw new Error("Chromium requires a service worker");
    if (
        family === "firefox" &&
        (manifest.background.service_worker || !manifest.background.scripts)
    )
        throw new Error("Firefox requires background scripts");
    if (
        family !== "safari" &&
        manifest.host_permissions.some(
            (p) => p.includes("*://") || p.includes("://*"),
        )
    )
        throw new Error("Broad website host permission");
    for (const file of [
        "background.js",
        "ui.js",
        "popup.html",
        "options.html",
        "ui.css",
        ...Object.values(manifest.icons),
    ])
        await readFile(dir + "/" + file);
    for (const page of ["popup.html", "options.html"]) {
        const html = await readFile(dir + "/" + page, "utf8");
        if (
            /<script(?![^>]*\bsrc=)[^>]*>/i.test(html) ||
            /\son\w+=/i.test(html)
        )
            throw new Error("Inline executable code in extension page");
    }
}
console.log(
    "All three browser packages have valid entrypoints and local executable resources.",
);
