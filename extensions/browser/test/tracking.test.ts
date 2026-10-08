import { expect, it } from "vitest";
import { advance, dailySeconds } from "../src/tracking";
import { buildHeartbeat } from "../shared/tracker";
const page = { domain: "example.com", project: "One" };
it("closes the previous page on a tab/project transition and tracks the new page", () => {
    const first = advance(
        null,
        { at: 1000, page, context: "1" },
        "browser",
        "a",
    );
    const next = advance(
        first.checkpoint,
        {
            at: 11000,
            page: { domain: "other.com", project: "Two" },
            context: "2",
        },
        "browser",
        "b",
    );
    expect(next.heartbeat?.entity).toBe("example.com");
    expect(next.heartbeat?.project).toBe("One");
    expect(next.heartbeat?.activity_segments[0].end).toBe(11);
    expect(next.checkpoint?.domain).toBe("other.com");
});
it("stops on pause, focus loss, private windows or idle and never bridges the absence", () => {
    const first = advance(
        null,
        { at: 1000, page, context: "1" },
        "browser",
        "a",
    );
    const paused = advance(
        first.checkpoint,
        { at: 11000, page: null, context: "" },
        "browser",
        "b",
    );
    expect(paused.heartbeat).not.toBeNull();
    expect(paused.checkpoint).toBeNull();
    expect(
        advance(
            paused.checkpoint,
            { at: 71000, page, context: "1" },
            "browser",
            "c",
        ).heartbeat,
    ).toBeNull();
});
it("survives an ordinary worker restart using the persisted checkpoint", () => {
    const first = advance(
        null,
        { at: 1000, page, context: "1" },
        "browser",
        "a",
    );
    expect(
        advance(
            JSON.parse(JSON.stringify(first.checkpoint)),
            { at: 61000, page, context: "1" },
            "browser",
            "b",
        ).heartbeat?.activity_segments[0].start,
    ).toBe(1);
});
it.each([91001, 10_000_000, 0])(
    "does not infer across sleep, long gaps or clock reversal (%s)",
    (at) => {
        expect(
            advance(
                { at: 1000, ...page, context: "1" },
                { at, page, context: "1" },
                "browser",
                "b",
            ).heartbeat,
        ).toBeNull();
    },
);
it("splits local totals at midnight", () => {
    const end = new Date(2026, 9, 6, 0, 0, 30).getTime();
    expect(
        dailySeconds(buildHeartbeat(page, end - 60000, end, "browser", "id")),
    ).toEqual([
        ["2026-10-05", 30],
        ["2026-10-06", 30],
    ]);
});

it("does not emit a final interval when native presence evidence is unavailable", () => {
    const previous = { ...page, at: 1000, context: "1" };
    expect(
        advance(
            previous,
            { at: 61000, page: null, context: "1", verified: false },
            "browser",
            "a",
        ),
    ).toEqual({ checkpoint: null, heartbeat: null });
});
it("rejects a short sleep detected by a wall-clock and monotonic-clock discontinuity", () => {
    const previous = {
        ...page,
        at: 1000,
        context: "1",
        monotonic: 1000,
        clockOrigin: 0,
    };
    expect(
        advance(
            previous,
            { at: 31000, page, context: "1", monotonic: 11000, clockOrigin: 0 },
            "browser",
            "a",
        ).heartbeat,
    ).toBeNull();
});
