import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { Api, ApiError } from "../src/api";
import { Database, enqueue } from "../src/database";
import { acceptedIndices, deliver } from "../src/delivery";
import { buildHeartbeat } from "../shared/tracker";
const db = () => new Database(crypto.randomUUID());
const response = (body: unknown, status = 200, headers?: HeadersInit) =>
    new Response(JSON.stringify(body), { status, headers });
const credential = {
    account: "account-a",
    accessToken: "a",
    refreshToken: "r",
    expiresAt: 1_000_000,
};
const heartbeat = (id: string) =>
    buildHeartbeat(
        { domain: "example.com", project: null },
        1000,
        61000,
        "browser",
        id,
    );
describe("transactional offline queue", () => {
    it("persists checkpoint and queued heartbeat atomically and counts duplicates once", async () => {
        const store = db();
        await store.update((s) => {
            s.credential = credential;
            enqueue(s, "account-a", heartbeat("a"));
            enqueue(s, "account-a", heartbeat("a"));
        });
        expect((await store.read()).queue).toHaveLength(1);
        expect(Object.values((await store.read()).totals["account-a"])[0]).toBe(
            60,
        );
        await expect(
            store.update((s) => {
                enqueue(s, "account-a", heartbeat("b"));
                throw new Error("crash");
            }),
        ).rejects.toThrow();
        expect((await store.read()).queue).toHaveLength(1);
    });
    it("retains queued items when full", async () => {
        const store = db();
        await store.update((s) => {
            s.queue = Array.from({ length: 10000 }, (_, i) => ({
                account: "a",
                heartbeat: heartbeat(String(i)),
            }));
            expect(enqueue(s, "a", heartbeat("overflow"))).toBe(false);
        });
        expect((await store.read()).queue).toHaveLength(10000);
        expect((await store.read()).error).toContain("full");
    });
    it("reports capacity as soon as the final slot is filled", async () => {
        const store = db();
        await store.update((s) => {
            s.queue = Array.from({ length: 9999 }, (_, i) => ({
                account: "a",
                heartbeat: heartbeat(String(i)),
            }));
            expect(enqueue(s, "a", heartbeat("final"))).toBe(true);
        });
        expect((await store.read()).queue).toHaveLength(10000);
        expect((await store.read()).error).toContain("full");
    });
    it("acknowledges only individually successful records", async () => {
        const store = db();
        await store.update((s) => {
            s.credential = credential;
            enqueue(s, "account-a", heartbeat("a"));
            enqueue(s, "account-a", heartbeat("b"));
        });
        const fetcher = vi.fn().mockResolvedValue(
            response(
                {
                    responses: [
                        [{}, 201],
                        [{}, 503],
                    ],
                },
                202,
            ),
        );
        await deliver(
            store,
            new Api(
                store,
                "https://api.example.com",
                "browser",
                fetcher,
                () => 10,
            ),
            10,
        );
        expect(
            (await store.read()).queue.map((q) => q.heartbeat.heartbeat_id),
        ).toEqual(["b"]);
        expect(acceptedIndices({ responses: [[{}, 201]] }, 2)).toEqual([]);
    });
    it("isolates accounts and keeps stable IDs on retry", async () => {
        const store = db();
        await store.update((s) => {
            s.credential = credential;
            enqueue(s, "account-a", heartbeat("a"));
            enqueue(s, "other-account", heartbeat("other"));
        });
        const fetcher = vi
            .fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce(response({ responses: [[{}, 201]] }));
        const api = new Api(
            store,
            "https://api.example.com",
            "browser",
            fetcher,
            () => 10,
        );
        await deliver(store, api, 10);
        const after = await store.read();
        expect(after.queue).toHaveLength(2);
        await deliver(store, api, after.nextRetryAt + 1);
        expect((await store.read()).queue.map((q) => q.account)).toEqual([
            "other-account",
        ]);
        expect(
            fetcher.mock.calls.map(
                (c) => JSON.parse(c[1].body)[0].heartbeat_id,
            ),
        ).toEqual(["a", "a"]);
    });
    it("honors Retry-After for throttling", async () => {
        const store = db();
        await store.update((s) => {
            s.credential = credential;
            enqueue(s, "account-a", heartbeat("a"));
        });
        await deliver(
            store,
            new Api(
                store,
                "https://api.example.com",
                "browser",
                async () => response({}, 429, { "retry-after": "300" }),
                () => 10,
            ),
            10,
        );
        expect((await store.read()).nextRetryAt).toBe(300010);
    });
});
describe("device authorization and rotation", () => {
    it("stores pending authorization and obeys slow_down across restarts", async () => {
        const store = db();
        let now = 0;
        const fetcher = vi
            .fn()
            .mockResolvedValueOnce(
                response({
                    device_code: "d",
                    user_code: "ABC",
                    verification_uri: "https://atoaxis.com/device",
                    expires_in: 300,
                    interval: 5,
                }),
            )
            .mockResolvedValueOnce(response({ error: "slow_down" }, 400))
            .mockResolvedValueOnce(
                response({
                    access_token: "a",
                    refresh_token: "r",
                    expires_in: 3600,
                }),
            );
        const api = new Api(
            store,
            "https://api.example.com",
            "browser",
            fetcher,
            () => now,
        );
        await api.connect();
        await api.poll();
        expect(fetcher).toHaveBeenCalledTimes(1);
        now = 5000;
        await api.poll();
        expect((await store.read()).device?.intervalMs).toBe(10000);
        now = 15000;
        await api.poll();
        expect((await store.read()).credential?.accessToken).toBe("a");
        expect((await store.read()).device).toBeNull();
    });
    it("expires pending authorization without sending a token request", async () => {
        const store = db();
        await store.update((s) => {
            s.device = {
                deviceCode: "d",
                userCode: "c",
                verificationUri: "https://atoaxis.com",
                expiresAt: 10,
                intervalMs: 5000,
                nextPollAt: 0,
            };
        });
        const fetcher = vi.fn();
        await new Api(
            store,
            "https://api.example.com",
            "browser",
            fetcher,
            () => 100,
        ).poll();
        expect(fetcher).not.toHaveBeenCalled();
        expect((await store.read()).device).toBeNull();
    });
    it("refreshes once for concurrent requests and persists the rotating token", async () => {
        const store = db();
        await store.update((s) => {
            s.credential = { ...credential, expiresAt: 0 };
        });
        const fetcher = vi.fn().mockResolvedValue(
            response({
                access_token: "new-a",
                refresh_token: "new-r",
                expires_in: 3600,
            }),
        );
        const api = new Api(
            store,
            "https://api.example.com",
            "browser",
            fetcher,
            () => 100,
        );
        await Promise.all([api.credential(), api.credential()]);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect((await store.read()).credential?.refreshToken).toBe("new-r");
    });
    it("retains credentials after a transient refresh failure", async () => {
        const store = db();
        await store.update((s) => {
            s.credential = { ...credential, expiresAt: 0 };
        });
        const api = new Api(
            store,
            "https://api.example.com",
            "browser",
            async () => response({}, 503),
            () => 100,
        );
        await expect(api.credential()).rejects.toBeInstanceOf(ApiError);
        expect((await store.read()).credential?.refreshToken).toBe("r");
        expect((await store.read()).blocked).toBe(false);
    });
    it("halts on invalid_grant while retaining offline records", async () => {
        const store = db();
        await store.update((s) => {
            s.credential = { ...credential, expiresAt: 0 };
            enqueue(s, "account-a", heartbeat("a"));
        });
        const api = new Api(
            store,
            "https://api.example.com",
            "browser",
            async () => response({ error: "invalid_grant" }, 400),
            () => 100,
        );
        await expect(api.credential()).rejects.toBeInstanceOf(ApiError);
        expect((await store.read()).blocked).toBe(true);
        expect((await store.read()).queue).toHaveLength(1);
    });
    it("disconnects locally even offline, clears account data and attempts revocation", async () => {
        const store = db();
        await store.update((s) => {
            s.credential = credential;
            enqueue(s, "account-a", heartbeat("a"));
        });
        const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
        await new Api(
            store,
            "https://api.example.com",
            "browser",
            fetcher,
        ).disconnect();
        const s = await store.read();
        expect(s.credential).toBeNull();
        expect(s.queue).toEqual([]);
        expect(s.totals).toEqual({});
        expect(fetcher.mock.calls[0][0]).toContain("/oauth/revoke");
    });
});
