"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const lineMeasurement_1 = require("../src/lineMeasurement");
(0, vitest_1.describe)("measureLineDelta", () => {
    (0, vitest_1.it)("counts inserted and deleted logical lines without returning source", () => {
        const result = (0, lineMeasurement_1.measureLineDelta)("one\ntwo\n", "one\nnew\ntwo\nthree\n");
        (0, vitest_1.expect)(result).toEqual({
            status: "measured",
            linesAdded: 2,
            linesDeleted: 0
        });
        (0, vitest_1.expect)(result).not.toHaveProperty("before");
        (0, vitest_1.expect)(result).not.toHaveProperty("after");
    });
    (0, vitest_1.it)("handles a replacement as one added and one deleted line", () => {
        (0, vitest_1.expect)((0, lineMeasurement_1.measureLineDelta)("old\n", "new\n")).toMatchObject({
            status: "measured",
            linesAdded: 1,
            linesDeleted: 1
        });
    });
});
//# sourceMappingURL=lineMeasurement.test.js.map