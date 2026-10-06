/** Sole outbound activity boundary. Paths are used locally, never emitted. */
export interface ProjectRule {
    domain: string;
    includeSubdomains: boolean;
    pathPrefix: string;
    project: string;
}
export interface BrowserTrackerOptions {
    enabled: boolean;
    denylist: string[];
    afkTimeoutMs: number;
    rules: ProjectRule[];
}
export const DEFAULT_BROWSER_TRACKER_OPTIONS: BrowserTrackerOptions = {
    enabled: false,
    denylist: [],
    afkTimeoutMs: 300_000,
    rules: [],
};
export interface BrowserHeartbeat {
    heartbeat_id: string;
    category: "browsing";
    entity: string;
    entity_type: "domain";
    is_write: false;
    language: null;
    project: string | null;
    time: number;
    editor: string;
    actor_type: "unknown";
    activity_segments: Array<{
        segment_id: string;
        start: number;
        end: number;
        source: "browser_foreground_v1";
    }>;
}

export function normalizedDomain(value: string): string {
    const input = value.trim().toLowerCase().replace(/\.$/, "");
    if (!input || /[\s/@?#:*]/.test(input))
        throw new Error("Enter a hostname without a URL or wildcard");
    const url = new URL("https://" + input);
    if (url.hostname !== input && !input.startsWith("xn--"))
        return url.hostname;
    return input;
}
export function normalizeOptions(input: unknown): BrowserTrackerOptions {
    if (!input || typeof input !== "object")
        throw new Error("Invalid settings");
    const value = input as Record<string, unknown>;
    if (
        typeof value.enabled !== "boolean" ||
        !Array.isArray(value.denylist) ||
        !Array.isArray(value.rules)
    )
        throw new Error("Invalid settings");
    const timeout = Number(value.afkTimeoutMs);
    if (!Number.isFinite(timeout) || timeout < 60_000 || timeout > 86_400_000)
        throw new Error("AFK timeout must be between 1 minute and 24 hours");
    if (value.denylist.length > 1000 || value.rules.length > 1000)
        throw new Error("Too many rules");
    const denylist = [
        ...new Set(
            value.denylist.map((d: unknown) => {
                if (typeof d !== "string")
                    throw new Error("Invalid excluded domain");
                return normalizedDomain(d);
            }),
        ),
    ];
    const rules = value.rules.map((raw: unknown): ProjectRule => {
        if (!raw || typeof raw !== "object")
            throw new Error("Invalid project rule");
        const r = raw as Record<string, unknown>;
        if (
            typeof r.domain !== "string" ||
            typeof r.includeSubdomains !== "boolean" ||
            typeof r.pathPrefix !== "string" ||
            typeof r.project !== "string"
        )
            throw new Error("Invalid project rule");
        const pathPrefix = r.pathPrefix.trim().replace(/\/+$/, "") || "/";
        if (!pathPrefix.startsWith("/") || /[?#\u0000-\u001f]/.test(pathPrefix))
            throw new Error("Invalid path prefix");
        const project = r.project.trim();
        if (!project || project.length > 256 || /[\u0000-\u001f]/.test(project))
            throw new Error("Invalid project");
        return {
            domain: normalizedDomain(r.domain),
            includeSubdomains: r.includeSubdomains,
            pathPrefix,
            project,
        };
    });
    const keys = rules.map((r) =>
        [r.domain, r.includeSubdomains, r.pathPrefix].join("|"),
    );
    if (new Set(keys).size !== keys.length)
        throw new Error("Duplicate project rules");
    return { enabled: value.enabled, denylist, rules, afkTimeoutMs: timeout };
}
export function importSettings(json: string): BrowserTrackerOptions {
    const payload = JSON.parse(json);
    if (payload.version !== 1) throw new Error("Unsupported settings version");
    // Import never turns tracking on without a separate explicit user action.
    return normalizeOptions({ ...payload.settings, enabled: false });
}
export function exportSettings(options: BrowserTrackerOptions): string {
    return JSON.stringify(
        { version: 1, settings: { ...options, enabled: false } },
        null,
        2,
    );
}
export function matchesDomain(
    host: string,
    domain: string,
    subdomains = true,
): boolean {
    return host === domain || (subdomains && host.endsWith("." + domain));
}
export function isPrivateHost(host: string): boolean {
    const h = host.toLowerCase().replace(/^\[|\]$/g, "");
    if (!h.includes(".") && !h.includes(":")) return true;
    if (
        h === "localhost" ||
        /\.(localhost|local|internal|lan|home|test|invalid)$/.test(h)
    )
        return true;
    if (h.includes(":")) {
        const mapped = h.match(
            /^(?:::ffff:|::ffff:0:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
        );
        if (mapped) {
            const a = parseInt(mapped[1], 16),
                b = parseInt(mapped[2], 16);
            return isPrivateHost([a >> 8, a & 255, b >> 8, b & 255].join("."));
        }
        return h === "::" || h === "::1" || /^(::|f[cd]|fe[89ab]|ff)/.test(h);
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
        const [a, b] = h.split(".").map(Number);
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            a >= 224 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127)
        );
    }
    return /(^|\.)(bank|health|medical|password)/i.test(h);
}
export function trackedPage(
    url: string | undefined,
    incognito: boolean,
    options: BrowserTrackerOptions,
): { domain: string; project: string | null } | null {
    if (!url || incognito || !options.enabled) return null;
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    const domain = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (
        !["http:", "https:"].includes(parsed.protocol) ||
        isPrivateHost(domain) ||
        options.denylist.some((d) => matchesDomain(domain, d))
    )
        return null;
    const matches = options.rules.filter(
        (r) =>
            matchesDomain(domain, r.domain, r.includeSubdomains) &&
            (r.pathPrefix === "/" ||
                parsed.pathname === r.pathPrefix ||
                parsed.pathname.startsWith(r.pathPrefix + "/")),
    );
    matches.sort(
        (a, b) =>
            b.pathPrefix.length - a.pathPrefix.length ||
            Number(b.domain === domain) - Number(a.domain === domain) ||
            a.domain.localeCompare(b.domain),
    );
    return { domain, project: matches[0]?.project ?? null };
}
export function buildHeartbeat(
    page: { domain: string; project: string | null },
    startMs: number,
    endMs: number,
    editor: string,
    id: string,
): BrowserHeartbeat {
    return {
        heartbeat_id: id,
        category: "browsing",
        entity: page.domain,
        entity_type: "domain",
        is_write: false,
        language: null,
        project: page.project,
        time: endMs / 1000,
        editor,
        actor_type: "unknown",
        activity_segments: [
            {
                segment_id: id,
                start: startMs / 1000,
                end: endMs / 1000,
                source: "browser_foreground_v1",
            },
        ],
    };
}
