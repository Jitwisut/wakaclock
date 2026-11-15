/**
 * The buildings on each place's island (owner decision 2026-11-15): small bar charts built
 * like a model town, so the scene says what the product does — it measures coding time. Each
 * bar is a tower: gold for the human's time, sea-teal stacked on top for the AI's. Every
 * place gets a chart in the spirit of its section. Demo shapes, not anyone's data.
 *
 * Pure data, no three.js: the scene and the still drawing both read it.
 */

export interface Bar {
  /** Height of the AI's share, stacked on top of the human's (m). */
  ai: number;
  /** Footprint (m). */
  depth: number;
  /** Height of the human's share (m). */
  human: number;
  width: number;
  /** Centre of the footprint on the island (m); +z faces the arriving camera. */
  x: number;
  z: number;
}

/** A row of bars along x, centred, from [human, ai] heights. */
function row(
  heights: readonly (readonly [number, number])[],
  width: number,
  gap: number,
  z = 0,
  depth = width
): Bar[] {
  const span = heights.length * width + (heights.length - 1) * gap;
  return heights.map(([human, ai], index) => ({
    x: -span / 2 + width / 2 + index * (width + gap),
    z,
    width,
    depth,
    human,
    ai,
  }));
}

/** Bars standing round a circle, one per entry, starting at twelve o'clock. */
function ring(heights: readonly (readonly [number, number])[], radius: number, size: number) {
  return heights.map(([human, ai], index) => {
    const angle = (index / heights.length) * Math.PI * 2;
    return {
      x: Math.sin(angle) * radius,
      z: -Math.cos(angle) * radius,
      width: size,
      depth: size,
      human,
      ai,
    };
  });
}

/** One demo hour's coding: [human, ai] tower heights (m). Idle hours are a low stub. */
function demoHour(hour: number): readonly [number, number] {
  if (hour >= 9 && hour <= 11) return [4.5 + hour - 9, 1];
  if (hour >= 13 && hour <= 17) return [7 - Math.abs(hour - 15), 1.5 + (hour % 2) * 1.5];
  if (hour >= 20 && hour <= 21) return [3, 0.5];
  return [0.35, 0];
}

/** Minutes coded in the demo day by `minute` (00:00 = 0): every active hour counts in full. */
export function codedMinutes(minute: number) {
  let total = 0;
  for (let hour = 0; hour < 24 && hour * 60 < minute; hour += 1) {
    if (demoHour(hour)[0] > 0.5) total += Math.min(60, minute - hour * 60);
  }
  return Math.round(total);
}

/** "4h 05m": a span of minutes as a duration readout. */
export function formatCoded(minutes: number) {
  const whole = Math.max(0, Math.round(minutes));
  return `${Math.floor(whole / 60)}h ${String(whole % 60).padStart(2, '0')}m`;
}

/** The whole demo day's coding: total, and how it splits between you and the AI (minutes). */
export function dayTotals() {
  const total = codedMinutes(24 * 60);
  let human = 0;
  let ai = 0;
  for (let hour = 0; hour < 24; hour += 1) {
    const [you, them] = demoHour(hour);
    if (you <= 0.5) continue;
    human += you;
    ai += them;
  }
  const aiMinutes = Math.round((total * ai) / (human + ai) / 5) * 5;
  return { ai: aiMinutes, human: total - aiMinutes, total };
}

/** Coding through one demo day, hour by hour: [human, ai] tower heights. */
export const DEMO_HOURS: readonly (readonly [number, number])[] = Array.from(
  { length: 24 },
  (_, hour) => demoHour(hour)
);

const CHARTS: Record<string, readonly Bar[]> = {
  // Heartbeats: a pulse, drawn as a row of thin towers.
  lighthouse: row(
    [1, 1, 1.4, 0.8, 5, 13, 2.2, 0.6, 1.8, 1, 1, 1.3, 1].map((human) => [human, 0] as const),
    0.75,
    0.35
  ),
  // One day: the 24 hours round a dial.
  clocktower: ring(DEMO_HOURS, 6.2, 1.15),
  // Human + AI: two towers side by side.
  twinlights: [
    { x: -2.4, z: 0, width: 3.4, depth: 3.4, human: 12.5, ai: 0 },
    { x: 2.4, z: 0, width: 3.4, depth: 3.4, human: 0, ai: 9 },
  ],
  // The product: a week, every day's human time with the AI's on top.
  market: row(
    [
      [6, 2],
      [8, 3],
      [5, 4],
      [9, 2.5],
      [7, 4.5],
      [3, 1],
      [2, 0.5],
    ],
    1.7,
    0.7
  ),
  // Begin: a first tower going up in steps.
  ship: row(
    [
      [2, 0],
      [4, 0.5],
      [6.5, 1],
      [9, 2],
    ],
    2.2,
    0.8
  ),
  // Quick start: three steps, one per step of the setup.
  dock: row(
    [
      [3.5, 0],
      [7, 0],
      [10.5, 0],
    ],
    3,
    1
  ),
  // What it is: a block of projects, a small skyline in three rows.
  library: [
    ...row(
      [
        [5, 1],
        [9, 2],
        [4, 0],
      ],
      2.4,
      0.9,
      -3.3
    ),
    ...row(
      [
        [7, 3],
        [11, 2.5],
        [6, 1.5],
      ],
      2.4,
      0.9,
      0
    ),
    ...row(
      [
        [3, 0.5],
        [6, 1],
        [8, 3],
      ],
      2.4,
      0.9,
      3.3
    ),
  ],
  // Compare: the same day counted twice; one side also shows the AI's share.
  signal: [
    ...row(
      [
        [6, 0],
        [9, 0],
        [7.5, 0],
      ],
      1.6,
      0.5,
      0
    ).map((bar) => ({ ...bar, x: bar.x - 3.6 })),
    ...row(
      [
        [4, 2],
        [6, 3],
        [5.5, 2],
      ],
      1.6,
      0.5,
      0
    ).map((bar) => ({ ...bar, x: bar.x + 3.6 })),
  ],
  // Pricing: three plans, small to large.
  trading: row(
    [
      [3.5, 1],
      [6.5, 2],
      [10, 3.5],
    ],
    2.8,
    1.2
  ),
  // Questions: a round table of short towers.
  tavern: ring(
    [
      [3, 1],
      [4.5, 0],
      [2.5, 1.5],
      [5, 0.5],
      [3.5, 1],
      [2, 2],
      [4, 0],
      [3, 1.5],
    ],
    4.2,
    1.6
  ),
};

/** The chart on a place's island (empty for places off the tour). */
export function chartBars(id: string): readonly Bar[] {
  return CHARTS[id] ?? [];
}

/** The tallest tower of a chart (m). */
export function chartTop(bars: readonly Bar[]) {
  return bars.reduce((top, bar) => Math.max(top, bar.human + bar.ai), 0);
}

/** Every chart is drawn within this height; the hotspot floats just above it. */

export { CHART_HEIGHT } from './file-plan';
