import type { Credential, Database, DeviceGrant } from "./database";
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        readonly retryAfterMs = 0,
    ) {
        super(code);
        this.name = "ApiError";
    }
}
interface Tokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}
export class Api {
    private refreshFlight: Promise<Credential> | null = null;
    constructor(
        readonly db: Database,
        readonly base: string,
        readonly client: string,
        private request = fetch,
        private now = Date.now,
    ) {}
    private async call(path: string, init: RequestInit = {}): Promise<unknown> {
        const response = await this.request.call(globalThis, this.base + path, {
            ...init,
            cache: "no-store",
            credentials: "omit",
            redirect: "error",
            signal: AbortSignal.timeout(15_000),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const allowed = [
                "authorization_pending",
                "slow_down",
                "expired_token",
                "access_denied",
                "invalid_grant",
            ];
            const code = allowed.includes(body.error)
                ? body.error
                : "Request failed (" + response.status + ")";
            const retry = response.headers.get("retry-after");
            const retryMs = retry
                ? Number.isFinite(Number(retry))
                    ? Number(retry) * 1000
                    : Date.parse(retry) - this.now()
                : 0;
            throw new ApiError(
                response.status,
                code,
                Math.max(0, retryMs || 0),
            );
        }
        return body;
    }
    private form(
        path: string,
        values: Record<string, string>,
    ): Promise<unknown> {
        return this.call(path, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(values).toString(),
        });
    }
    private tokens(body: unknown, account: string): Credential {
        const t = body as Tokens;
        if (
            !t ||
            typeof t.access_token !== "string" ||
            typeof t.refresh_token !== "string" ||
            !Number.isFinite(t.expires_in) ||
            t.expires_in <= 0
        )
            throw new Error("Invalid token response");
        return {
            accessToken: t.access_token,
            refreshToken: t.refresh_token,
            expiresAt: this.now() + Math.max(0, t.expires_in - 30) * 1000,
            account,
        };
    }
    async connect(): Promise<DeviceGrant> {
        const raw = (await this.form("/oauth/device/code", {
            client_id: this.client,
            scope: "write_logged_time read_projects",
        })) as Record<string, unknown>;
        if (
            typeof raw.device_code !== "string" ||
            typeof raw.user_code !== "string" ||
            typeof raw.verification_uri !== "string" ||
            !Number.isFinite(raw.expires_in) ||
            Number(raw.expires_in) <= 0 ||
            !Number.isFinite(raw.interval) ||
            Number(raw.interval) <= 0
        )
            throw new Error("Invalid device authorization response");
        const url = new URL(raw.verification_uri);
        if (
            url.protocol !== "https:" &&
            !(
                url.protocol === "http:" &&
                ["localhost", "127.0.0.1"].includes(url.hostname)
            )
        )
            throw new Error("Unsafe approval URL");
        url.searchParams.set("code", raw.user_code);
        const device = {
            deviceCode: raw.device_code,
            userCode: raw.user_code,
            verificationUri: url.toString(),
            expiresAt: this.now() + Number(raw.expires_in) * 1000,
            intervalMs: Math.max(5, Number(raw.interval)) * 1000,
            nextPollAt: this.now() + Math.max(5, Number(raw.interval)) * 1000,
        };
        await this.db.update((s) => {
            s.device = device;
            s.error = null;
        });
        return device;
    }
    async poll(): Promise<void> {
        const { device } = await this.db.read();
        if (!device || this.now() < device.nextPollAt) return;
        if (this.now() >= device.expiresAt) {
            await this.db.update((s) => {
                if (s.device?.deviceCode === device.deviceCode) {
                    s.device = null;
                    s.error = "Device authorization expired. Connect again.";
                }
            });
            return;
        }
        // Persist the deadline BEFORE dispatch, including across worker suspension.
        await this.db.update((s) => {
            if (s.device?.deviceCode === device.deviceCode)
                s.device.nextPollAt = this.now() + device.intervalMs;
        });
        try {
            const credential = this.tokens(
                await this.form("/oauth/device/token", {
                    device_code: device.deviceCode,
                    client_id: this.client,
                }),
                crypto.randomUUID(),
            );
            let adopted = false;
            await this.db.update((s) => {
                if (s.device?.deviceCode !== device.deviceCode) return;
                s.device = null;
                s.credential = credential;
                s.blocked = false;
                s.error = null;
                s.checkpoint = null;
                s.nextRetryAt = 0;
                s.retryCount = 0;
                adopted = true;
            });
            if (!adopted)
                await this.form("/oauth/revoke", {
                    token: credential.refreshToken,
                });
        } catch (error) {
            await this.db.update((s) => {
                if (s.device?.deviceCode !== device.deviceCode) return;
                if (
                    error instanceof ApiError &&
                    error.code === "authorization_pending"
                )
                    return;
                if (error instanceof ApiError && error.code === "slow_down") {
                    s.device.intervalMs += 5000;
                    s.device.nextPollAt = this.now() + s.device.intervalMs;
                    return;
                }
                if (
                    !(error instanceof ApiError) ||
                    error.status >= 500 ||
                    error.status === 429
                ) {
                    s.error =
                        "Connection unavailable. Authorization will retry.";
                    return;
                }
                s.device = null;
                s.error = "Device authorization failed. Connect again.";
            });
        }
    }
    async credential(force = false): Promise<Credential> {
        const { credential: current, blocked } = await this.db.read();
        if (!current || blocked)
            throw new ApiError(401, "Connect your AtoAxis account");
        if (!force && current.expiresAt > this.now()) return current;
        if (this.refreshFlight) return this.refreshFlight;
        this.refreshFlight = (async () => {
            try {
                const next = this.tokens(
                    await this.form("/oauth/token", {
                        grant_type: "refresh_token",
                        refresh_token: current.refreshToken,
                        client_id: this.client,
                    }),
                    current.account,
                );
                let adopted = false;
                await this.db.update((s) => {
                    if (s.credential?.refreshToken === current.refreshToken) {
                        s.credential = next;
                        adopted = true;
                    }
                });
                if (!adopted) {
                    await this.form("/oauth/revoke", {
                        token: next.refreshToken,
                    });
                    throw new Error("Account changed");
                }
                return next;
            } catch (error) {
                if (
                    error instanceof ApiError &&
                    error.code === "invalid_grant"
                ) {
                    await this.db.update((s) => {
                        if (
                            s.credential?.refreshToken === current.refreshToken
                        ) {
                            s.blocked = true;
                            s.checkpoint = null;
                            s.error = "Session expired. Reconnect to continue.";
                        }
                    });
                }
                throw error;
            }
        })();
        try {
            return await this.refreshFlight;
        } finally {
            this.refreshFlight = null;
        }
    }
    async authorized(
        path: string,
        init: RequestInit = {},
        account?: string,
    ): Promise<unknown> {
        let credential = await this.credential();
        if (account && credential.account !== account)
            throw new Error("Account changed");
        const send = () =>
            this.call(path, {
                ...init,
                headers: {
                    ...init.headers,
                    Authorization: "Bearer " + credential.accessToken,
                },
            });
        try {
            return await send();
        } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 401)
                throw error;
            const latest = (await this.db.read()).credential;
            credential =
                latest?.accessToken !== credential.accessToken &&
                latest?.account === credential.account
                    ? latest
                    : await this.credential(true);
            if (account && credential.account !== account)
                throw new Error("Account changed");
            try {
                return await send();
            } catch (retry) {
                if (retry instanceof ApiError && retry.status === 401)
                    await this.db.update((s) => {
                        if (
                            s.credential?.accessToken === credential.accessToken
                        ) {
                            s.blocked = true;
                            s.checkpoint = null;
                            s.error = "Session expired. Reconnect to continue.";
                        }
                    });
                throw retry;
            }
        }
    }
    async disconnect(): Promise<void> {
        const current = (await this.db.read()).credential;
        await this.db.update((s) => {
            s.device = null;
            s.credential = null;
            s.checkpoint = null;
            s.settings.enabled = false;
            s.blocked = false;
            s.error = null;
            s.queue = [];
            s.totals = {};
        });
        if (current) {
            try {
                await this.form("/oauth/revoke", {
                    token: current.refreshToken,
                });
            } catch {
                await this.db.update((s) => {
                    s.error =
                        "Disconnected locally. Revoke this connection in AtoAxis when online.";
                });
            }
        }
    }
}
