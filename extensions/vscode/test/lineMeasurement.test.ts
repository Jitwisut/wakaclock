import { describe, expect, it } from "vitest";
import { measureLineDelta } from "../src/lineMeasurement";

describe("measureLineDelta", () => {
  it("counts inserted and deleted logical lines without returning source", () => {
    const result = measureLineDelta("one\ntwo\n", "one\nnew\ntwo\nthree\n");

    expect(result).toEqual({
      status: "measured",
      linesAdded: 2,
      linesDeleted: 0
    });
    expect(result).not.toHaveProperty("before");
    expect(result).not.toHaveProperty("after");
  });

  it("handles a replacement as one added and one deleted line", () => {
    expect(measureLineDelta("old\n", "new\n")).toMatchObject({
      status: "measured",
      linesAdded: 1,
      linesDeleted: 1
    });
  });
});
