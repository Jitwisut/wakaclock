import { describe, expect, it } from "vitest";
import {
    buildHeartbeat,
    DEFAULT_BROWSER_TRACKER_OPTIONS,
    exportSettings,
    importSettings,
    normalizeOptions,
    trackedPage,
} from "../shared/tracker";
const settings = () => ({
    ...structuredClone(DEFAULT_BROWSER_TRACKER_OPTIONS),
    enabled: true,
});
describe("privacy boundary", () => {
    it("requires explicit enablement", () =>
        expect(
            trackedPage(
                "https://example.com",
                false,
                DEFAULT_BROWSER_TRACKER_OPTIONS,
            ),
        ).toBeNull());
    it.each([
        "chrome://settings",
        "about:blank",
        "file:///tmp/a",
        "https://localhost",
        "http://127.1",
        "http://192.168.1.4",
        "http://10.3.4.5",
        "http://172.16.1.1",
        "http://169.254.1.1",
        "http://100.64.1.1",
        "http://[::1]",
        "http://[fc00::1]",
        "http://[fe80::1]",
        "http://[::ffff:192.168.1.1]",
        "https://service.internal",
        "https://password.example.com",
    ])("excludes %s", (url) => {
        expect(trackedPage(url, false, settings())).toBeNull();
    });
    it("always excludes private windows", () =>
        expect(
            trackedPage("https://example.com", true, settings()),
        ).toBeNull());
    it("strips path, credentials, query, fragment and title from outbound records", () => {
        const page = trackedPage(
            "https://user:secret@github.com/team/project?token=secret#secret",
            false,
            settings(),
        )!;
        const hb = buildHeartbeat(
            page,
            1000,
            61000,
            "AtoAxis Browser",
            "stable-id",
        );
        expect(hb.entity).toBe("github.com");
        expect(hb.entity_type).toBe("domain");
        expect(JSON.stringify(hb)).not.toMatch(/secret|team|title|url|user:/);
        expect(hb.activity_segments[0]).toEqual({
            segment_id: "stable-id",
            start: 1,
            end: 61,
            source: "browser_foreground_v1",
        });
    });
});
describe("local project mapping", () => {
    const mapped = () => ({
        ...settings(),
        rules: [
            {
                domain: "github.com",
                includeSubdomains: false,
                pathPrefix: "/",
                project: "General",
            },
            {
                domain: "github.com",
                includeSubdomains: false,
                pathPrefix: "/team/project",
                project: "Project",
            },
        ],
    });
    it("chooses the longest matching path", () =>
        expect(
            trackedPage(
                "https://github.com/team/project/issues",
                false,
                mapped(),
            )?.project,
        ).toBe("Project"));
    it("checks path boundaries", () =>
        expect(
            trackedPage(
                "https://github.com/team/project-other",
                false,
                mapped(),
            )?.project,
        ).toBe("General"));
    it("does not match lookalike hosts", () =>
        expect(
            trackedPage(
                "https://github.com.evil.com/team/project",
                false,
                mapped(),
            )?.project,
        ).toBeNull());
    it("uses explicit subdomain permission", () => {
        const s = mapped();
        expect(
            trackedPage("https://docs.github.com", false, s)?.project,
        ).toBeNull();
        s.rules[0].includeSubdomains = true;
        expect(trackedPage("https://docs.github.com", false, s)?.project).toBe(
            "General",
        );
    });
    it("deny rules win and include subdomains", () => {
        const s = mapped();
        s.denylist = ["github.com"];
        expect(
            trackedPage("https://github.com/team/project", false, s),
        ).toBeNull();
        expect(trackedPage("https://docs.github.com", false, s)).toBeNull();
        expect(trackedPage("https://notgithub.com", false, s)).not.toBeNull();
    });
    it("rejects duplicates and invalid paths", () => {
        const s = mapped();
        s.rules.push(s.rules[0]);
        expect(() => normalizeOptions(s)).toThrow("Duplicate");
        expect(() =>
            normalizeOptions({
                ...mapped(),
                rules: [{ ...mapped().rules[0], pathPrefix: "/?secret" }],
            }),
        ).toThrow();
    });
    it("validates import and never imports consent or credentials", () => {
        const s = mapped();
        expect(importSettings(exportSettings(s))).toEqual({
            ...s,
            enabled: false,
        });
        expect(() => importSettings('{"version":2}')).toThrow();
        expect(() => normalizeOptions({ ...s, afkTimeoutMs: NaN })).toThrow();
        expect(exportSettings(s)).not.toMatch(/token|credential|queue/);
    });
});
