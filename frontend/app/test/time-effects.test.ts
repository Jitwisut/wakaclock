import { describe, expect, it } from 'vitest';

import {
  blockRise,
  CODE_CYCLE,
  CODE_SNIPPETS,
  codeCycle,
  codeVisibility,
  FADE_SECONDS,
  helixFocus,
  helixPoint,
  helixVisibility,
  HOLD_SECONDS,
  hourlyBlocks,
  snippetFor,
  SPARK_SECONDS,
  TYPE_SECONDS,
  windowFade,
} from '@/components/marketing/time/time-effects';

describe('visibility windows', () => {
  it('rises, holds and falls as a trapezoid', () => {
    expect(windowFade(0, 1, 2, 3, 4)).toBe(0);
    expect(windowFade(1.5, 1, 2, 3, 4)).toBeCloseTo(0.5);
    expect(windowFade(2.5, 1, 2, 3, 4)).toBe(1);
    expect(windowFade(3.5, 1, 2, 3, 4)).toBeCloseTo(0.5);
    expect(windowFade(4, 1, 2, 3, 4)).toBe(0);
  });

  it('shows the code in chapter 02 and the helix in chapter 04 only', () => {
    expect(codeVisibility(0)).toBe(0);
    expect(codeVisibility(1.4)).toBe(1);
    expect(codeVisibility(3)).toBe(0);
    expect(helixVisibility(1.4)).toBe(0);
    expect(helixVisibility(3.5)).toBe(1);
    expect(helixVisibility(5)).toBe(0);
  });
});

describe('code fragments', () => {
  it('types, sparks, holds and fades, then loops', () => {
    const typing = codeCycle(TYPE_SECONDS / 2);
    expect(typing.typed).toBeCloseTo(0.5);
    expect(typing).toMatchObject({ spark: -1, alpha: 1 });
    const spark = codeCycle(TYPE_SECONDS + SPARK_SECONDS / 2);
    expect(spark.spark).toBeCloseTo(0.5);
    expect(spark).toMatchObject({ typed: 1, alpha: 1 });
    expect(codeCycle(TYPE_SECONDS + SPARK_SECONDS + HOLD_SECONDS / 2)).toEqual({
      typed: 1,
      spark: -1,
      alpha: 1,
    });
    const fading = codeCycle(TYPE_SECONDS + SPARK_SECONDS + HOLD_SECONDS + FADE_SECONDS / 2);
    expect(fading.alpha).toBeCloseTo(0.5);
    expect(codeCycle(CODE_CYCLE + TYPE_SECONDS / 2).typed).toBeCloseTo(0.5);
    expect(codeCycle(-CODE_CYCLE + TYPE_SECONDS / 2).typed).toBeCloseTo(0.5);
  });

  it('walks every fragment through the snippet list', () => {
    expect(CODE_SNIPPETS).toContain(snippetFor(0, 0));
    expect(snippetFor(1, 0)).not.toBe(snippetFor(1, 1));
    const seen = new Set(Array.from({ length: 10 }, (_, round) => snippetFor(2, round)));
    expect(seen.size).toBe(CODE_SNIPPETS.length);
  });
});

describe('helix', () => {
  it('runs two strands half a turn apart down the tunnel', () => {
    const [hx, hy, hz] = helixPoint(0, 10, 'human', 0, 0);
    const [ax, ay, az] = helixPoint(0, 10, 'ai', 0, 0);
    expect(hx).toBeCloseTo(-ax);
    expect(hy).toBeCloseTo(-ay);
    expect(hz).toBe(az);
    expect(helixPoint(9, 10, 'human', 0, 0)[2]).toBeCloseTo(3 - 18);
    const spread = helixPoint(0, 1, 'human', 0, 1);
    expect(Math.hypot(spread[0], spread[1])).toBeCloseTo(2);
  });

  it('dims the side out of focus and dims both for unattributed', () => {
    expect(helixFocus('all')).toEqual({ human: 1, ai: 1, spread: 0 });
    expect(helixFocus('human').ai).toBeLessThan(0.5);
    expect(helixFocus('ai').human).toBeLessThan(0.5);
    const unattributed = helixFocus('unattributed');
    expect(unattributed.human).toBe(unattributed.ai);
    expect(unattributed.human).toBeLessThan(0.5);
  });
});

describe('time city', () => {
  it('buckets demo slices by day and hour, capped at an hour, with the dominant kind', () => {
    const blocks = hourlyBlocks(
      [
        { day: 0, minute: 9 * 60 + 55, kind: 'human', project: 0 },
        { day: 0, minute: 10 * 60 + 3, kind: 'ai', project: 0 },
        { day: 0, minute: 10 * 60 + 8, kind: 'ai', project: 0 },
        { day: 0, minute: 11 * 60, kind: 'unattributed', project: 0 },
        { day: 0, minute: 11 * 60 + 5, kind: 'unattributed', project: 0 },
        { day: 0, minute: 11 * 60 + 10, kind: 'ai', project: 0 },
        { day: 1, minute: 12 * 60, kind: 'human', project: 0 },
        { day: 3, minute: 12 * 60, kind: 'human', project: 0 },
        { day: 0, minute: 1440, kind: 'human', project: 0 },
        ...Array.from({ length: 14 }, (_, index) => ({
          day: 1,
          minute: 14 * 60 + index * 5,
          kind: 'human' as const,
          project: 0,
        })),
      ],
      2
    );
    expect(blocks).toHaveLength(48);
    const at = (day: number, hour: number) =>
      blocks.find((block) => block.day === day && block.hour === hour);
    expect(at(0, 9)).toEqual({ day: 0, hour: 9, minutes: 5, kind: 'human' });
    expect(at(0, 10)).toMatchObject({ minutes: 10, kind: 'ai' });
    expect(at(0, 11)).toMatchObject({ minutes: 15, kind: 'unattributed' });
    expect(at(1, 12)).toMatchObject({ minutes: 5, kind: 'human' });
    expect(at(1, 14)?.minutes).toBe(60);
    expect(at(0, 0)).toMatchObject({ minutes: 0, kind: 'human' });
  });

  it('rises in a wave from today forward through the week', () => {
    expect(blockRise(0, 0, 0)).toBe(0);
    expect(blockRise(0, 0, 1)).toBe(1);
    expect(blockRise(0, 0, 0.2)).toBeGreaterThan(blockRise(6, 23, 0.2));
  });
});
