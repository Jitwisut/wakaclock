import { describe, expect, it } from "vitest";
import { ClipboardActivityTracker, PASTE_CHANGE_MATCH_WINDOW_MS } from "../src/clipboardTracking";

const range = (startLine: number, startCharacter: number, endLine: number, endCharacter: number) => ({
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter }
});

const document = (fsPath: string, version = 1) => ({
  uri: { fsPath, scheme: "file" },
  version,
  offsetAt: (position: { line: number; character: number }) => position.line * 100 + position.character
});

describe("ClipboardActivityTracker", () => {
  it("counts multi-selection copy volume without reading clipboard text", () => {
    const tracker = new ClipboardActivityTracker();
    const prepared = tracker.prepareCopy(
      document("/workspace/a.ts"),
      [range(0, 2, 0, 8), range(2, 0, 4, 3)],
      "/workspace",
      1_000
    );

    expect(prepared.token).toBeTruthy();
    expect(prepared.metrics).toEqual({ copiedChars: 209, copiedLines: 4 });
  });

  it("classifies same-file, same-workspace, and missing-token pastes", () => {
    const tracker = new ClipboardActivityTracker();
    const copied = tracker.prepareCopy(document("/workspace/a.ts"), [range(0, 0, 0, 2)], "/workspace", 1_000);

    tracker.preparePaste(document("/workspace/a.ts", 4), [range(2, 0, 2, 0)], "/workspace", copied.token, 1_100);
    expect(tracker.consumePaste(document("/workspace/a.ts", 5), [{ range: range(2, 0, 2, 0) }], undefined, 1_200)?.origin).toBe("same_file");

    tracker.preparePaste(document("/workspace/b.ts", 8), [range(1, 0, 1, 0)], "/workspace", copied.token, 1_300);
    expect(tracker.consumePaste(document("/workspace/b.ts", 9), [{ range: range(1, 0, 1, 0) }], undefined, 1_400)?.origin).toBe("same_workspace");

    tracker.preparePaste(document("/workspace/c.ts", 2), [range(0, 0, 0, 0)], "/workspace", undefined, 1_500);
    expect(tracker.consumePaste(document("/workspace/c.ts", 3), [{ range: range(0, 0, 0, 0) }], undefined, 1_600)?.origin).toBe("external_or_unknown");
  });

  it("rejects expired, mismatched-version, and undo markers and consumes each marker once", () => {
    const tracker = new ClipboardActivityTracker();
    const target = range(0, 0, 0, 0);

    tracker.preparePaste(document("/workspace/a.ts", 1), [target], "/workspace", undefined, 1_000);
    expect(tracker.consumePaste(document("/workspace/a.ts", 2), [{ range: target }], undefined, 1_000 + PASTE_CHANGE_MATCH_WINDOW_MS + 1)).toBeUndefined();

    tracker.preparePaste(document("/workspace/a.ts", 2), [target], "/workspace", undefined, 4_000);
    expect(tracker.consumePaste(document("/workspace/a.ts", 4), [{ range: target }], undefined, 4_100)).toBeUndefined();

    tracker.preparePaste(document("/workspace/a.ts", 4), [target], "/workspace", undefined, 5_000);
    expect(tracker.consumePaste(document("/workspace/a.ts", 5), [{ range: target }], 1, 5_100)).toBeUndefined();
    expect(tracker.consumePaste(document("/workspace/a.ts", 5), [{ range: target }], undefined, 5_100)).toBeUndefined();
  });
});
