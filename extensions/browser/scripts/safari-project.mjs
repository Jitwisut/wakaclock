import { execFileSync } from "node:child_process";
import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist/safari-xcode");
execFileSync(
    "xcrun",
    [
        "safari-web-extension-converter",
        path.resolve("dist/safari"),
        "--project-location",
        root,
        "--app-name",
        "AtoAxis Browser",
        "--bundle-identifier",
        "com.atoaxis.browser",
        "--swift",
        "--macos-only",
        "--copy-resources",
        "--no-open",
        "--no-prompt",
        "--force",
    ],
    { stdio: "inherit" },
);
async function files(dir) {
    const result = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const target = path.join(dir, entry.name);
        if (entry.isDirectory()) result.push(...(await files(target)));
        else result.push(target);
    }
    return result;
}
const all = await files(root);
for (const filename of all) {
    if (filename.endsWith("/AppDelegate.swift"))
        await cp("safari/AppDelegate.swift", filename);
    if (filename.endsWith("/SafariWebExtensionHandler.swift"))
        await cp("safari/SafariWebExtensionHandler.swift", filename);
    if (filename.endsWith(".entitlements"))
        await cp("safari/companion.entitlements", filename);
}
const project = all.find((p) => p.endsWith("/project.pbxproj"));
if (!project) throw new Error("Safari project generation failed");
let text = await readFile(project, "utf8");
// The default converter omits entitlements on some Xcode versions. Give both targets
// the same App Group; distribution signing must provision it for the owner's team.
text = text.replace(
    /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g,
    (_match, value) =>
        "PRODUCT_BUNDLE_IDENTIFIER = " +
        (value.includes("Extension")
            ? "com.atoaxis.browser.Extension"
            : "com.atoaxis.browser") +
        ";",
);
text = text.replace(
    /MACOSX_DEPLOYMENT_TARGET = [\d.]+;/g,
    "MACOSX_DEPLOYMENT_TARGET = 13.0;",
);
text = text.replace(
    /INFOPLIST_KEY_NSPrincipalClass = NSApplication;/g,
    'INFOPLIST_KEY_NSPrincipalClass = NSApplication;\n\t\t\t\tINFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.productivity";',
);
text = text.replace(
    /CODE_SIGN_STYLE = Automatic;/g,
    'CODE_SIGN_STYLE = Automatic;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = "companion.entitlements";',
);
await cp(
    "safari/companion.entitlements",
    path.dirname(path.dirname(project)) + "/companion.entitlements",
);
await writeFile(project, text);
console.log("Generated Safari project at " + root);
