import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
const api = new URL(
    process.env.ATOAXIS_BROWSER_API_URL ?? "https://api.atoaxis.com",
);
if (
    api.protocol !== "https:" &&
    !(
        api.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(api.hostname)
    )
)
    throw new Error("API URL must use HTTPS");
const crc = (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) {
        c ^= b;
        for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
};
function png(size) {
    const chunk = (type, data) => {
        const name = Buffer.from(type);
        const out = Buffer.alloc(data.length + 12);
        out.writeUInt32BE(data.length);
        name.copy(out, 4);
        data.copy(out, 8);
        out.writeUInt32BE(crc(Buffer.concat([name, data])), out.length - 4);
        return out;
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    const rows = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const ax = x / size,
                ay = y / size;
            const stroke =
                ay > 0.16 &&
                ay < 0.83 &&
                (Math.abs(ax - (0.5 - (ay - 0.16) * 0.4)) < 0.055 ||
                    Math.abs(ax - (0.5 + (ay - 0.16) * 0.4)) < 0.055 ||
                    (ay > 0.57 && ay < 0.66 && ax > 0.31 && ax < 0.69));
            const i = y * (size * 4 + 1) + 1 + x * 4;
            rows.set(stroke ? [144, 238, 182, 255] : [16, 30, 26, 255], i);
        }
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(rows)),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}
for (const family of ["chromium", "firefox", "safari"]) {
    const dir =
        (process.env.ATOAXIS_BROWSER_BUILD_DIR ?? "dist") + "/" + family;
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir + "/icons", { recursive: true });
    await cp("assets", dir, { recursive: true });
    const manifest = JSON.parse(
        await readFile(family + "/manifest.json", "utf8"),
    );
    manifest.host_permissions = [api.origin + "/*"];
    await writeFile(dir + "/manifest.json", JSON.stringify(manifest, null, 2));
    for (const size of [16, 32, 48, 128, 512, 1024])
        await writeFile(dir + "/icons/icon-" + size + ".png", png(size));
    await build({
        entryPoints: ["src/background.ts", "src/ui.ts"],
        bundle: true,
        outdir: dir,
        format: "iife",
        target: "es2022",
        define: {
            __API_URL__: JSON.stringify(api.origin),
            __FAMILY__: JSON.stringify(family),
        },
    });
}
