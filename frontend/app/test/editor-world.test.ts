import { describe, expect, it } from 'vitest';

import {
  cursorAt,
  generateLines,
  BASE_DEPTH,
  CHART_HEIGHT,
  deskY,
  ISLAND_LIFT,
  ISLAND_TOP,
  LANDMARK_HEIGHT,
  GUTTER_RIGHT,
  INDENT,
  LANDMARK_X,
  LINE_COUNT,
  LINE_GAP,
  lineAtTour,
  LINES,
  lineNumberBlocks,
  LINES_PER_STOP,
  lineY,
  lineZ,
  STOP_COUNT,
  stopBase,
  TEXT_LEFT,
  TEXT_RIGHT,
} from '@/components/marketing/time/editor/file-plan';
import { buildIsland, ISLAND_RADIUS, rimWobble } from '@/components/marketing/time/editor/island';
import { AI_LEAD, caretBlink, chartGrowth } from '@/components/marketing/time/editor/scene';
import {
  chartBars,
  chartTop,
  codedMinutes,
  dayTotals,
  DEMO_HOURS,
  formatCoded,
} from '@/components/marketing/time/editor/charts';
import { demoMinute } from '@/components/marketing/time/editor/desk';
import { dprFloor } from '@/components/marketing/time/scene/time-canvas';
import {
  landmark,
  placeById,
  PLACES,
  TOUR,
  tourKeys,
} from '@/components/marketing/time/voyage/world-places';

/*
 * The editor world: the homepage's 3D scene is one source file seen as a landscape. These
 * cover its plan — the lines, the steps and valleys, the cursor's path, the landmarks.
 */

describe('the file', () => {
  it('is the same file every time, with a top-level block at every stop', () => {
    expect(LINES).toHaveLength(LINE_COUNT);
    expect(generateLines(60, 7)).toEqual(generateLines(60, 7));
    for (let stop = 0; stop <= STOP_COUNT; stop += 1) {
      const head = LINES[stop * LINES_PER_STOP];
      expect(head?.depth).toBe(0);
      expect(head?.tokens.length).toBeGreaterThan(0);
    }
  });

  it('keeps every token inside the text area and in order along its line', () => {
    for (const line of LINES) {
      let edge = TEXT_LEFT + line.depth * INDENT;
      for (const token of line.tokens) {
        expect(token.x).toBeGreaterThanOrEqual(edge - 1e-6);
        expect(token.x + token.width).toBeLessThanOrEqual(TEXT_RIGHT + 1e-6);
        edge = token.x + token.width;
      }
      expect(line.end).toBeCloseTo(edge);
    }
    // Some of it is the AI's, most of it is not.
    const ai = LINES.filter((line) => line.ai).length;
    expect(ai).toBeGreaterThan(0);
    expect(ai).toBeLessThan(LINES.length / 2);
  });

  it('steps down with every line and sinks into each block', () => {
    expect(lineZ(0)).toBeCloseTo(0);
    expect(lineZ(10)).toBe(-10 * LINE_GAP);
    expect(lineY(0)).toBeCloseTo(0);
    const head = LINES_PER_STOP;
    const nested = LINES.find((line) => line.index > head && line.depth > 0);
    expect(nested).toBeDefined();
    // A nested line lies lower than the slope alone would put it.
    expect(lineY(nested?.index ?? 0)).toBeLessThan(lineY(head) - 1e-6);
    expect(lineY(LINE_COUNT + 50)).toBeLessThan(lineY(head));
  });
});

describe('the cursor', () => {
  it('types along each line from its indentation to its end, then drops to the next', () => {
    const line = LINES.find((entry) => entry.tokens.length > 1) as (typeof LINES)[number];
    const [startX, , startZ] = cursorAt(line.index);
    const [endX] = cursorAt(line.index + 0.999);
    expect(startX).toBeCloseTo(TEXT_LEFT + line.depth * INDENT);
    expect(endX).toBeGreaterThan(startX);
    expect(startZ).toBe(lineZ(line.index));
    expect(lineAtTour(0)).toBe(0);
    expect(lineAtTour(2)).toBe(2 * LINES_PER_STOP);
    expect(lineAtTour(999)).toBe(LINE_COUNT - 1);
  });

  it('blinks like a heartbeat and leaves room for the AI ahead of it', () => {
    expect(caretBlink(0)).toBe(1);
    expect(caretBlink(0.91)).toBeLessThan(0.5);
    expect(caretBlink(-0.2)).toBeGreaterThan(0);
    expect(AI_LEAD).toBeGreaterThan(0);
  });
});

describe('landmarks', () => {
  it('gives every place of the tour a bar chart that fits on its island', () => {
    for (const id of TOUR) {
      const bars = chartBars(id);
      expect(bars.length, id).toBeGreaterThan(1);
      expect(chartTop(bars), id).toBeLessThanOrEqual(CHART_HEIGHT);
      for (const bar of bars) {
        // Inside the grass, with room to spare for the trees at the rim.
        const reach = Math.hypot(Math.abs(bar.x) + bar.width / 2, Math.abs(bar.z) + bar.depth / 2);
        expect(reach, id).toBeLessThan(ISLAND_RADIUS - 1.5);
        expect(bar.human + bar.ai, id).toBeGreaterThan(0);
        expect(Math.min(bar.human, bar.ai, bar.width, bar.depth)).toBeGreaterThanOrEqual(0);
      }
    }
    // The AI's share shows on the charts about it, and the human's everywhere.
    expect(chartBars('twinlights').some((bar) => bar.ai > 0)).toBe(true);
    expect(chartBars('market').every((bar) => bar.human > bar.ai)).toBe(true);
    expect(chartBars('nowhere')).toEqual([]);
    expect(DEMO_HOURS).toHaveLength(24);
  });

  it('raises a chart as the tour arrives at its stop', () => {
    expect(chartGrowth(3, 3)).toBe(1);
    expect(chartGrowth(1, 3)).toBe(0);
    expect(chartGrowth(2.6, 3)).toBeGreaterThan(0);
    expect(chartGrowth(2.6, 3)).toBeLessThan(1);
  });

  it('stands the model on a desk, with every island held clear above the base', () => {
    // The desk lies under every line, well below the deepest valley.
    for (const line of LINES) expect(deskY(lineZ(line.index))).toBeLessThan(lineY(line.index) - 3);
    // Under the head of every block (no valley there) it is exactly the base's depth down.
    for (let stop = 0; stop <= STOP_COUNT; stop += 1) {
      const head = stop * LINES_PER_STOP;
      expect(deskY(lineZ(head))).toBeCloseTo(lineY(head) - BASE_DEPTH);
    }
    expect(LANDMARK_HEIGHT).toBe(ISLAND_LIFT + ISLAND_TOP + CHART_HEIGHT);
    expect(demoMinute(0, TOUR.length)).toBe(9 * 60);
    expect(demoMinute(TOUR.length, TOUR.length)).toBe(22 * 60);
    expect(demoMinute(99, TOUR.length)).toBe(22 * 60);
    // The readout's coded time at the end of the tour is the end card's total.
    expect(codedMinutes(demoMinute(TOUR.length, TOUR.length))).toBe(dayTotals().total);
  });

  it('stands each place in the margin beside the head of its block', () => {
    for (const [index, id] of TOUR.entries()) {
      const place = placeById(id) as (typeof PLACES)[number];
      const [x, y, z] = stopBase(index + 1);
      expect(place.at).toEqual([x, z]);
      expect(x).toBe(LANDMARK_X);
      expect(landmark(place)[1]).toBeGreaterThan(y);
    }
    // The far places (links) stand in the other margin.
    for (const place of PLACES.filter((entry) => entry.href)) {
      expect(place.at[0]).toBeGreaterThan(TEXT_RIGHT);
    }
  });

  it('flies the camera behind the cursor, down the file', () => {
    const keys = tourKeys();
    for (let stop = 1; stop < keys.length; stop += 1) {
      const key = keys[stop] as (typeof keys)[number];
      const before = keys[stop - 1] as (typeof keys)[number];
      // Each stop is further down the file, and the camera stays up-file of its landmark.
      if (stop > 1) expect(key.pos[2]).toBeLessThan(before.pos[2]);
      expect(key.pos[2]).toBeGreaterThan(key.center[2]);
      expect(key.pos[1]).toBeGreaterThan(key.center[1] - 20);
    }
  });
});

describe('the gutter', () => {
  it('right-aligns one block per digit of the line number, a narrow one for a 1', () => {
    expect(lineNumberBlocks(0)).toHaveLength(1); // line 1
    expect(lineNumberBlocks(8)).toHaveLength(1); // line 9
    expect(lineNumberBlocks(9)).toHaveLength(2); // line 10
    expect(lineNumberBlocks(99)).toHaveLength(3); // line 100
    const ten = lineNumberBlocks(9);
    expect(ten[0]?.width).toBeLessThan(ten[1]?.width ?? 0);
    // Every number ends at the same right edge, left of the text.
    for (const index of [0, 9, 120, LINE_COUNT - 1]) {
      const last = lineNumberBlocks(index).at(-1);
      expect(last?.centre).toBeLessThan(GUTTER_RIGHT);
      expect(GUTTER_RIGHT).toBeLessThan(TEXT_LEFT);
    }
    expect(lineNumberBlocks(0).at(-1)?.centre).toBeCloseTo(
      lineNumberBlocks(120).at(-1)?.centre ?? 0
    );
  });
});

describe('the floating islands', () => {
  it('builds the same island for the same place, and a different one for another', () => {
    const one = buildIsland(38);
    const again = buildIsland(38);
    const other = buildIsland(69);
    const position = one.getAttribute('position');
    expect(position.count).toBeGreaterThan(300);
    expect(Array.from(again.getAttribute('position').array)).toEqual(Array.from(position.array));
    expect(
      other.getAttribute('position').count === position.count &&
        Array.from(other.getAttribute('position').array).every((v, i) => v === position.array[i])
    ).toBe(false);
    // Coloured per vertex and lit with flat facets: no uvs, nothing left undefined.
    expect(one.getAttribute('color').count).toBe(position.count);
    expect(one.getAttribute('normal').count).toBe(position.count);
    expect(one.getAttribute('uv')).toBeUndefined();
    let top = -Infinity;
    let bottom = Infinity;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      top = Math.max(top, y);
      bottom = Math.min(bottom, y);
    }
    // Trees stand above the grass; the rock hangs below it, but clear of the desk on its rod.
    expect(top).toBeGreaterThan(ISLAND_TOP + 2);
    expect(bottom).toBeLessThan(ISLAND_TOP - 6);
    expect(ISLAND_LIFT + bottom).toBeGreaterThan(-BASE_DEPTH + 2);
    for (const geometry of [one, again, other]) geometry.dispose();
  });

  it('keeps the rim wobble gentle', () => {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
      expect(Math.abs(rimWobble(angle, 1.2))).toBeLessThanOrEqual(1);
    }
  });
});

describe('the demo day counter', () => {
  it('counts only the active hours up to the clock, as a duration', () => {
    expect(codedMinutes(0)).toBe(0);
    expect(codedMinutes(9 * 60)).toBe(0); // nothing before nine
    expect(codedMinutes(9 * 60 + 30)).toBe(30);
    expect(codedMinutes(12 * 60 + 30)).toBe(180); // 09–12, lunch is idle
    expect(codedMinutes(24 * 60)).toBe(10 * 60); // 3 + 5 + 2 active hours
    expect(formatCoded(0)).toBe('0h 00m');
    expect(formatCoded(185)).toBe('3h 05m');
    expect(formatCoded(-4)).toBe('0h 00m');
  });
});

describe('sharpness', () => {
  it('keeps a high-density screen at 1.5x or more on the full tier only', () => {
    expect(dprFloor(2, 2)).toBe(1.5);
    expect(dprFloor(2, 3)).toBe(1.5);
    expect(dprFloor(2, 1)).toBe(1);
    expect(dprFloor(1.5, 3)).toBe(1);
  });
});
