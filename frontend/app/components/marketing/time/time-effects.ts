import { type ActivitySlice, MINUTES_PER_DAY, type SliceKind } from './time-data';

/**
 * Pure maths for the scene's three set pieces besides the ring:
 * - code typing itself in the dark around the dial (chapter 02, Heartbeats),
 * - the human and AI strands braided down the week (chapter 04, Human + AI),
 * - the week's hours rising as a city under the ring (the light page, after dawn).
 */

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Trapezoid: 0 before `a`, rising to 1 by `b`, holding to `c`, back to 0 by `d`. */
export function windowFade(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x < b) return (x - a) / (b - a);
  if (x <= c) return 1;
  return (d - x) / (d - c);
}

/** Chapter 02 spans story positions [1, 2): the code drifts in just before and out after. */
export function codeVisibility(g: number): number {
  return windowFade(g, 0.45, 1, 1.85, 2.35);
}

/** Chapter 04 spans [3, 4): the helix arrives with it and leaves as the product begins. */
export function helixVisibility(g: number): number {
  return windowFade(g, 2.5, 3, 3.9, 4.4);
}

/* ---------- code fragments ---------- */

/** Generic, product-neutral lines: they only say "someone is writing code". */
export const CODE_SNIPPETS = [
  'const total = sessions.reduce(sum, 0);',
  'fn parse(input: &str) -> Result<Ast>',
  'git commit -m "fix: flaky date test"',
  'SELECT project, count(*) FROM tasks',
  'export function useSearch(query) {',
  'await agent.run({ task: "refactor" });',
  '// TODO: split this into two passes',
  'import { format } from "./dates";',
  'if (cache.has(key)) return cache.get(key);',
  'def handler(event, context):',
] as const;

export const TYPE_SECONDS = 1.6;
export const SPARK_SECONDS = 0.7;
export const HOLD_SECONDS = 0.9;
export const FADE_SECONDS = 0.5;
export const CODE_CYCLE = TYPE_SECONDS + SPARK_SECONDS + HOLD_SECONDS + FADE_SECONDS;

/**
 * One fragment's loop: it types out, sends its heartbeat to the ring as a spark, holds,
 * then fades before starting again with a new line.
 */
export function codeCycle(time: number): { alpha: number; spark: number; typed: number } {
  const t = ((time % CODE_CYCLE) + CODE_CYCLE) % CODE_CYCLE;
  if (t < TYPE_SECONDS) return { typed: t / TYPE_SECONDS, spark: -1, alpha: 1 };
  const afterType = t - TYPE_SECONDS;
  if (afterType < SPARK_SECONDS) {
    return { typed: 1, spark: afterType / SPARK_SECONDS, alpha: 1 };
  }
  const afterSpark = afterType - SPARK_SECONDS;
  if (afterSpark < HOLD_SECONDS) return { typed: 1, spark: -1, alpha: 1 };
  return { typed: 1, spark: -1, alpha: 1 - (afterSpark - HOLD_SECONDS) / FADE_SECONDS };
}

/** Which snippet a fragment shows on its `round`-th loop: each fragment walks the list. */
export function snippetFor(fragment: number, round: number): string {
  const index = (fragment * 3 + round * 7) % CODE_SNIPPETS.length;
  return CODE_SNIPPETS[index] as string;
}

/* ---------- human + AI helix ---------- */

export type HelixStrand = 'ai' | 'human';
export type HelixFocus = 'ai' | 'all' | 'human' | 'unattributed';

/**
 * A point on one strand of the helix running down the week's tunnel (along -z). `spread`
 * pulls the strands apart; `phase` turns the whole braid.
 */
export function helixPoint(
  index: number,
  count: number,
  strand: HelixStrand,
  phase: number,
  spread: number
): [number, number, number] {
  const t = index / Math.max(1, count - 1);
  const angle = t * Math.PI * 7 + phase + (strand === 'ai' ? Math.PI : 0);
  const radius = 0.9 + spread * 1.1;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius, 3 - t * 18];
}

/**
 * How bright each strand is, and how far the braid spreads, for the chapter's focus
 * control. Focusing one side dims the other and pulls them apart; "Unattributed" dims
 * both, because that is precisely the work neither strand can claim.
 */
export function helixFocus(focus: HelixFocus): { ai: number; human: number; spread: number } {
  if (focus === 'human') return { human: 1, ai: 0.15, spread: 1 };
  if (focus === 'ai') return { human: 0.15, ai: 1, spread: 1 };
  if (focus === 'unattributed') return { human: 0.25, ai: 0.25, spread: 0.4 };
  return { human: 1, ai: 1, spread: 0 };
}

/* ---------- the week as a city ---------- */

export interface CityBlock {
  day: number;
  hour: number;
  /** The kind with the most minutes in that hour (human on a tie). */
  kind: SliceKind;
  /** Minutes of demo activity in that hour, 0–60. */
  minutes: number;
}

/** Demo activity bucketed per day and hour (slices do not start on the hour). */
export function hourlyBlocks(slices: readonly ActivitySlice[], days: number): CityBlock[] {
  const minutes = new Map<string, Record<SliceKind, number>>();
  for (const slice of slices) {
    if (slice.day >= days || slice.minute >= MINUTES_PER_DAY) continue;
    const key = `${slice.day}:${Math.floor(slice.minute / 60)}`;
    const bucket = minutes.get(key) ?? { human: 0, ai: 0, unattributed: 0 };
    bucket[slice.kind] += 5;
    minutes.set(key, bucket);
  }
  const blocks: CityBlock[] = [];
  for (let day = 0; day < days; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const bucket = minutes.get(`${day}:${hour}`) ?? { human: 0, ai: 0, unattributed: 0 };
      const total = Math.min(60, bucket.human + bucket.ai + bucket.unattributed);
      let kind: SliceKind = 'human';
      if (bucket.ai > bucket[kind]) kind = 'ai';
      if (bucket.unattributed > bucket[kind]) kind = 'unattributed';
      blocks.push({ day, hour, minutes: total, kind });
    }
  }
  return blocks;
}

/**
 * How far one block has risen for a 0–1 progress through the light page: the city
 * grows in a wave from the earliest hour of today towards the back of the week.
 */
export function blockRise(day: number, hour: number, progress: number): number {
  const delay = day * 0.05 + (hour / 24) * 0.2;
  const t = clamp01((progress - 0.08 - delay) / 0.3);
  return 1 - (1 - t) ** 3;
}
