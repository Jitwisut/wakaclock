import { afterEach, describe, expect, it, vi } from 'vitest';

import { dayTotals } from '@/components/marketing/time/editor/charts';
import { LINE_COUNT, TEXT_LEFT, TEXT_RIGHT } from '@/components/marketing/time/editor/file-plan';
import {
  collectHeart,
  dayLight,
  endDay,
  HEARTS,
  heartReached,
  MINUTES_PER_METRE,
  play,
  playVersion,
  resetDay,
  showTip,
  subscribePlay,
  towerText,
} from '@/components/marketing/time/editor/play';
import { DAY_END, SPEAKERS, STORY } from '@/components/marketing/time/editor/story';
import { TOUR } from '@/components/marketing/time/voyage/world-places';

/*
 * The story game on the editor world (owner decisions 2026-11-15): hearts to collect, what a
 * tapped tower says, the day's light, the end of the day, and the approved dialogue.
 */

afterEach(() => resetDay());

describe('the hearts', () => {
  it('plants two on every stretch of the file and one on every island', () => {
    const route = HEARTS.filter((heart) => heart.stop === 0);
    const islands = HEARTS.filter((heart) => heart.stop > 0);
    expect(route).toHaveLength(TOUR.length * 2);
    expect(islands.map((heart) => heart.stop)).toEqual(TOUR.map((_, index) => index + 1));
    expect(new Set(HEARTS.map((heart) => heart.id)).size).toBe(HEARTS.length);
    for (const heart of route) {
      expect(heart.line).toBeGreaterThan(0);
      expect(heart.line).toBeLessThan(LINE_COUNT);
      expect(heart.x).toBeGreaterThan(TEXT_LEFT);
      expect(heart.x).toBeLessThan(TEXT_RIGHT);
    }
  });

  it('lets the cursor collect file hearts in passing, never island ones', () => {
    const [first] = HEARTS;
    const island = HEARTS.find((heart) => heart.stop > 0);
    expect(first && heartReached(first, first.line - 1)).toBe(false);
    expect(first && heartReached(first, first.line)).toBe(true);
    expect(island && heartReached(island, LINE_COUNT)).toBe(false);
  });

  it('counts each heart once and tells its listeners', () => {
    const listener = vi.fn();
    const stop = subscribePlay(listener);
    const before = playVersion();
    expect(collectHeart(3)).toBe(true);
    expect(collectHeart(3)).toBe(false);
    expect(play.hearts.size).toBe(1);
    expect(playVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    collectHeart(4);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('the end of the day', () => {
  it('ends once, and a new day clears everything and starts the typing over', () => {
    collectHeart(1);
    showTip('x', 1, 2);
    const day = play.day;
    endDay();
    expect(play.ended).toBe(true);
    const version = playVersion();
    endDay();
    expect(playVersion()).toBe(version);
    resetDay();
    expect(play.ended).toBe(false);
    expect(play.hearts.size).toBe(0);
    expect(play.tip).toBeNull();
    expect(play.day).toBe(day + 1);
  });

  it('adds up the demo day the end card shows', () => {
    const totals = dayTotals();
    expect(totals.total).toBe(600);
    expect(totals.human + totals.ai).toBe(totals.total);
    expect(totals.ai).toBeGreaterThan(0);
    expect(totals.ai % 5).toBe(0);
  });
});

describe('a tapped tower', () => {
  it('says how much time it stands for, the AI only when it has any', () => {
    const labels = { you: SPEAKERS.dev.en, ai: SPEAKERS.bot.en };
    expect(towerText(5, 0, labels)).toBe('You 1h 00m');
    expect(towerText(5, 2.5, labels)).toBe(
      `You 1h 00m · AI 0h ${String(2.5 * MINUTES_PER_METRE)}m`
    );
    expect(towerText(1, 0, { you: SPEAKERS.dev.th, ai: SPEAKERS.bot.th })).toBe('คุณ 0h 12m');
  });

  it('remembers where it was tapped', () => {
    showTip('You 1h 00m', 120, 340);
    expect(play.tip).toMatchObject({ text: 'You 1h 00m', x: 120, y: 340 });
  });
});

describe("the day's light", () => {
  it('goes from a bright afternoon to a lamp-lit night', () => {
    const afternoon = dayLight(0);
    const evening = dayLight(0.5);
    const night = dayLight(1);
    expect(afternoon.window).toBeGreaterThan(night.window);
    expect(afternoon.room).toBeGreaterThan(night.room);
    expect(night.lamp).toBeGreaterThan(afternoon.lamp);
    expect(night.glow).toBeGreaterThan(afternoon.glow);
    // The evening sun is the warmest light of the day.
    expect(evening.warmth).toBeGreaterThan(afternoon.warmth);
    expect(evening.warmth).toBeGreaterThan(night.warmth);
    // Out of range clamps; the end of the day turns the lamp down.
    expect(dayLight(-2)).toEqual(afternoon);
    expect(dayLight(7)).toEqual(night);
    expect(dayLight(1, true).lamp).toBeLessThan(night.lamp);
  });
});

describe('the dialogue', () => {
  it('has a line for the map and every stop, in both languages', () => {
    expect(STORY).toHaveLength(TOUR.length + 1);
    for (const line of STORY) {
      expect(line.en.length).toBeGreaterThan(10);
      expect(line.th.length).toBeGreaterThan(10);
      expect(SPEAKERS[line.speaker]).toBeDefined();
    }
    for (const entry of Object.values(DAY_END)) {
      expect(entry.en).toBeTruthy();
      expect(entry.th).toBeTruthy();
    }
  });
});

describe('tapping the model', () => {
  it('leaves the page its own clicks: controls, text and the open panel', async () => {
    const { clickIsForScene } = await import('@/components/marketing/time/editor/pick');
    document.body.innerHTML = `
      <section class="tx-chapter"><div class="tx-veil"></div><p>Copy</p><button>Go</button></section>
      <div data-world-place="faq" data-world-open=""><div class="inside"></div></div>
      <div class="tx-story"><p class="tx-story-bubble">Hi</p></div>`;
    const pick = (selector: string) => document.querySelector(selector);
    expect(clickIsForScene(pick('.tx-veil'))).toBe(true);
    expect(clickIsForScene(pick('.tx-chapter'))).toBe(true);
    expect(clickIsForScene(pick('p'))).toBe(false);
    expect(clickIsForScene(pick('button'))).toBe(false);
    expect(clickIsForScene(pick('.inside'))).toBe(false);
    expect(clickIsForScene(pick('.tx-story-bubble'))).toBe(false);
    expect(clickIsForScene(null)).toBe(false);
  });
});

describe('the tour glide', () => {
  it('walks to the next stop at most at its pace, easing in and never overshooting', async () => {
    const { glideStep, MAX_TOUR_SPEED } =
      await import('@/components/marketing/time/scene/time-rig');
    let tour = 0;
    let velocity = 0;
    let seconds = 0;
    let fastest = 0;
    while (tour < 1 && seconds < 30) {
      const before = tour;
      ({ tour, velocity } = glideStep(tour, 1, velocity, 1 / 60));
      fastest = Math.max(fastest, (tour - before) * 60);
      seconds += 1 / 60;
    }
    expect(tour).toBe(1);
    expect(velocity).toBe(0);
    expect(fastest).toBeLessThanOrEqual(MAX_TOUR_SPEED + 1e-9);
    // One stop takes a few seconds: never a dash.
    expect(seconds).toBeGreaterThan(1 / MAX_TOUR_SPEED);
    // A long jump (ten stops) is allowed to go faster, so it still ends in seconds.
    let far = 0;
    let farVelocity = 0;
    let farSeconds = 0;
    while (far < 10 && farSeconds < 60) {
      ({ tour: far, velocity: farVelocity } = glideStep(far, 10, farVelocity, 1 / 60));
      farSeconds += 1 / 60;
    }
    expect(far).toBe(10);
    expect(farSeconds).toBeLessThan(15);
  });
});

describe('the speech bubble', () => {
  it('sits over the speaker, inside the window, and never under the title card', async () => {
    const { blink, placeBubble } = await import('@/components/marketing/time/editor/figures');
    const bubble = { width: 300, height: 90 };
    const other = { x: 2000, y: 500 };
    // Nothing in the way: straight over the head.
    expect(
      placeBubble({ bubble, card: null, head: { x: 400, y: 500 }, other, viewWidth: 1000 })
    ).toEqual({
      side: 'above',
      x: 400,
      y: 500,
    });
    // Near the edge: pulled inside the window.
    expect(
      placeBubble({ bubble, card: null, head: { x: 980, y: 500 }, other, viewWidth: 1000 }).x
    ).toBe(1000 - 162);
    // Over the card: beside the speaker, to the left of the card.
    const card = { left: 536, right: 900, top: 200, bottom: 440 };
    const beside = placeBubble({ bubble, card, head: { x: 580, y: 500 }, other, viewWidth: 1000 });
    expect(beside.side).toBe('left');
    expect(beside.x + bubble.width / 2).toBeLessThanOrEqual(card.left - 12);
    // …and above the other figurine's head when that one stands under it.
    const crowded = placeBubble({
      bubble,
      card,
      head: { x: 580, y: 500 },
      other: { x: 400, y: 480 },
      viewWidth: 1000,
    });
    expect(crowded.y).toBe(480 - 14);
    // No room beside it: above the card instead.
    const narrow = placeBubble({
      bubble,
      card: { left: 200, right: 390, top: 300, bottom: 500 },
      head: { x: 250, y: 520 },
      other,
      viewWidth: 390,
    });
    expect(narrow.side).toBe('above');
    expect(narrow.y).toBe(300 - 12);
    // Eyes blink briefly, then stay open.
    expect(blink(0)).toBeLessThan(1);
    expect(blink(1)).toBe(1);
  });
});
