// Run from extensions/browser after npm run package. Requires Chrome and unzip.
import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const archive = path.resolve("dist/packages/atoaxis-chromium-" + version + ".zip");
const digest = createHash("sha256").update(await readFile(archive)).digest("hex");
expect((await readFile(archive + ".sha256", "utf8")).split(/\s+/)[0]).toBe(digest);
const unpacked = await mkdtemp(path.join(tmpdir(), "atoaxis-chrome-package-"));
let context;
try {
    execFileSync("unzip", ["-q", archive, "-d", unpacked]);
    context = await chromium.launchPersistentContext("", {
        channel: "chrome",
        headless: true,
        ignoreDefaultArgs: ["--disable-extensions"],
        args: ["--enable-unsafe-extension-debugging"],
    });
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: unpacked });
    const page = await context.newPage();
    await page.goto("chrome-extension://" + id + "/options.html");
    await expect(page.locator("#connection")).toContainText("Connect your");
    await expect(page.locator("#afk")).toHaveValue("5");
    const manifest = await page.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.version).toBe(version);
    expect(manifest.host_permissions).toEqual(["https://api.atoaxis.com/*"]);
    expect(manifest.incognito).toBe("not_allowed");
    await page.goto("chrome-extension://" + id + "/" + manifest.action.default_popup);
    await expect(page.locator("#connection")).toContainText("Connect your");
    const state = await page.evaluate(() => chrome.runtime.sendMessage({ type: "status" }));
    expect(state).toMatchObject({ connected: false, tracking: false, pending: 0, seconds: 0 });
    console.log(JSON.stringify({ version, chrome: context.browser().version(), sha256: digest }));
} finally {
    try {
        await context?.close();
    } finally {
        await rm(unpacked, { recursive: true, force: true });
    }
}
