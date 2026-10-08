import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AttributionFocus } from '@/components/marketing/time/attribution-focus';
import { ClockReadout } from '@/components/marketing/time/clock-readout';
import { CountUp } from '@/components/marketing/time/count-up';
import { HoverTip } from '@/components/marketing/time/hover-tip';
import { Scramble, scrambleFrame } from '@/components/marketing/time/scramble';
import { SmoothScroll } from '@/components/marketing/time/smooth-scroll';
import {
  MIDNIGHT_DURATION,
  MIDNIGHT_FIRE_AT,
  MIDNIGHT_MIN_SCENE_AGE,
  MIDNIGHT_REARM_BELOW,
  MIDNIGHT_START,
  MIDNIGHT_STRIKE,
  midnightFrame,
  nextMidnight,
  PULSE_SECONDS,
  pulseShape,
  waveShape,
} from '@/components/marketing/time/time-midnight';
import { TIME_COPY } from '@/components/marketing/time/time-copy';
import {
  angleForMinute,
  arcPath,
  generateDemoDays,
  kindShares,
  MINUTES_PER_DAY,
  pointOnRing,
  seededRandom,
  SLICE_MINUTES,
  sliceAt,
  sliceRuns,
} from '@/components/marketing/time/time-data';
import {
  arcLevel,
  bloomFade,
  CAMERA_KEYS,
  CHAPTER_COUNT,
  DAY_CAMERA_KEYS,
  dayCameraParameterAt,
  daylightAt,
  cameraParameterAt,
  chapterAt,
  dampFactor,
  DAY_END_MINUTE,
  DAY_START_MINUTE,
  formatClock,
  FUTURE_LEVEL,
  handMinuteAt,
  minuteAtPoint,
  onRingBand,
  RING_RADIUS,
  ringDepth,
  ringOpacity,
  RING_SPACING,
  ringTwist,
  sweepStrength,
  trailAt,
  TRAIL_MINUTES,
  warpTarget,
} from '@/components/marketing/time/time-keyframes';
import { TimeExperience } from '@/components/marketing/time/time-experience';
import {
  chooseTimeQuality,
  type DeviceSignals,
  QUALITY_TIERS,
  readDeviceSignals,
} from '@/components/marketing/time/time-quality';
import { TimeStage, whenIdle } from '@/components/marketing/time/time-stage';
import {
  getTimeUi,
  resetTimeUi,
  setTimeUi,
  timeMotion,
  useTimeUi,
} from '@/components/marketing/time/time-store';
import { useTimeScroll } from '@/components/marketing/time/use-time-scroll';

// The WebGL scene never enters the test graph: the dynamic loader resolves to a stub.
vi.mock('@/components/marketing/time/scene/time-canvas', () => ({ default: () => null }));
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    void loader();
    return function DynamicCanvas({ mode }: { mode: string }) {
      return <div data-mode={mode} data-testid="time-canvas" />;
    };
  },
}));

type TriggerConfig = {
  end: string;
  onRefresh: (self: TriggerSelf) => void;
  onUpdate: (self: TriggerSelf) => void;
  start: string;
  trigger: Element;
};
type TriggerSelf = { progress: number; trigger?: Element };
const scroll = vi.hoisted(() => ({
  refreshes: 0,
  registered: 0,
  triggers: [] as { config: TriggerConfig; killed: boolean }[],
  ticks: new Set<(time: number) => void>(),
  lag: [] as number[][],
}));
vi.mock('gsap', () => ({
  gsap: {
    registerPlugin: () => {
      scroll.registered += 1;
    },
    ticker: {
      add: (tick: (time: number) => void) => {
        scroll.ticks.add(tick);
      },
      remove: (tick: (time: number) => void) => {
        scroll.ticks.delete(tick);
      },
      lagSmoothing: (...values: number[]) => {
        scroll.lag.push(values);
      },
    },
  },
}));

type LenisOptions = { autoRaf: boolean; lerp: number };
const smooth = vi.hoisted(() => ({
  instances: [] as {
    destroyed: boolean;
    listeners: Record<string, () => void>;
    options: LenisOptions;
    rafs: number[];
    scrolls: { options: unknown; target: unknown }[];
  }[],
}));
vi.mock('lenis', () => ({
  default: class {
    record;
    constructor(options: LenisOptions) {
      this.record = {
        destroyed: false,
        listeners: {} as Record<string, () => void>,
        options,
        rafs: [] as number[],
        scrolls: [] as { options: unknown; target: unknown }[],
      };
      smooth.instances.push(this.record);
    }
    on(event: string, listener: () => void) {
      this.record.listeners[event] = listener;
    }
    raf(time: number) {
      this.record.rafs.push(time);
    }
    scrollTo(target: unknown, options: unknown) {
      this.record.scrolls.push({ target, options });
    }
    destroy() {
      this.record.destroyed = true;
    }
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    update: () => {},
    refresh: () => {
      scroll.refreshes += 1;
    },
    create: (config: TriggerConfig) => {
      const record = { config, killed: false };
      scroll.triggers.push(record);
      return {
        kill: () => {
          record.killed = true;
        },
      };
    },
  },
}));

type ObserverRecord = { callback: IntersectionObserverCallback; targets: Element[] };
const observers: ObserverRecord[] = [];

class ControlledIntersectionObserver {
  record: ObserverRecord;
  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, targets: [] };
    observers.push(this.record);
  }
  observe = (target: Element) => {
    this.record.targets.push(target);
  };
  unobserve = () => {};
  disconnect = () => {};
}

function intersect(record: ObserverRecord, target: Element, isIntersecting: boolean) {
  act(() => {
    record.callback(
      [{ isIntersecting, target } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  });
}

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;

function setMedia(matching: string[]) {
  window.matchMedia = ((query: string) => ({
    matches: matching.some((part) => query.includes(part)),
    media: query,
  })) as typeof window.matchMedia;
}

const baseSignals: DeviceSignals = {
  compact: false,
  cores: 8,
  memory: 8,
  reducedMotion: false,
  saveData: false,
  webgl: true,
};

beforeEach(() => {
  observers.length = 0;
  scroll.triggers.length = 0;
  scroll.ticks.clear();
  scroll.lag.length = 0;
  smooth.instances.length = 0;
  frames.clear();
  resetTimeUi();
  window.IntersectionObserver =
    ControlledIntersectionObserver as unknown as typeof IntersectionObserver;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  setMedia([]);
});

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  document.body.innerHTML = '';
});

describe('time-data', () => {
  it('generates the same non-overlapping working days for the same seed', () => {
    const first = generateDemoDays(7);
    expect(generateDemoDays(7)).toEqual(first);
    expect(new Set(first.map((slice) => slice.kind))).toEqual(
      new Set(['human', 'ai', 'unattributed'])
    );
    for (let day = 0; day < 7; day += 1) {
      const minutes = first.filter((slice) => slice.day === day).map((slice) => slice.minute);
      expect(minutes.length).toBeGreaterThan(0);
      expect(new Set(minutes).size).toBe(minutes.length);
      expect(Math.min(...minutes)).toBeGreaterThanOrEqual(8 * 60);
      expect(Math.max(...minutes)).toBeLessThan(MINUTES_PER_DAY);
    }
  });

  it('stops a day before midnight when sessions run late', () => {
    // A long run of seeds guarantees at least one day hits the late-evening cut-off.
    const late = Array.from({ length: 40 }, (_, seed) => generateDemoDays(3, seed)).flat();
    expect(Math.max(...late.map((slice) => slice.minute))).toBeLessThan(MINUTES_PER_DAY);
  });

  it('puts midnight at the top of the dial and runs clockwise', () => {
    expect(angleForMinute(0)).toBeCloseTo(Math.PI / 2);
    const [x, y, z] = pointOnRing(MINUTES_PER_DAY / 4, 2, -3);
    expect(x).toBeCloseTo(2);
    expect(y).toBeCloseTo(0);
    expect(z).toBe(-3);
    expect(pointOnRing(0, 1)[2]).toBe(0);
    expect(seededRandom(1)()).toBeGreaterThanOrEqual(0);
  });

  it('summarises shares, runs and arcs for one day', () => {
    const slices = [
      { day: 0, minute: 600, kind: 'human' as const, project: 0 },
      { day: 0, minute: 605, kind: 'human' as const, project: 0 },
      { day: 0, minute: 610, kind: 'ai' as const, project: 1 },
      { day: 0, minute: 700, kind: 'ai' as const, project: 1 },
      { day: 0, minute: 705, kind: 'unattributed' as const, project: 2 },
      { day: 1, minute: 600, kind: 'human' as const, project: 0 },
    ];
    expect(kindShares(slices)).toEqual({ human: 0.4, ai: 0.4, unattributed: 0.2 });
    expect(kindShares(slices, 5)).toEqual({ human: 0, ai: 0, unattributed: 0 });
    expect(sliceRuns(slices)).toEqual([
      { start: 600, end: 600 + 2 * SLICE_MINUTES, kind: 'human' },
      { start: 610, end: 615, kind: 'ai' },
      { start: 700, end: 705, kind: 'ai' },
      { start: 705, end: 710, kind: 'unattributed' },
    ]);
    expect(arcPath(0, 0, 10, 0, 60)).toMatch(/A10 10 0 0 1/);
    expect(arcPath(0, 0, 10, 0, 1000)).toMatch(/A10 10 0 1 1/);
    expect(sliceAt(slices, 612)?.kind).toBe('ai');
    expect(sliceAt(slices, 615)).toBeUndefined();
    expect(sliceAt(slices, 602, 1)?.day).toBe(1);
  });
});

describe('time-keyframes', () => {
  it('has one camera key per chapter and clamps story positions', () => {
    expect(CAMERA_KEYS).toHaveLength(CHAPTER_COUNT);
    expect(chapterAt(-2)).toBe(0);
    expect(chapterAt(2.4)).toBe(2);
    expect(chapterAt(99)).toBe(CHAPTER_COUNT - 1);
    expect(cameraParameterAt(-1)).toBe(0);
    expect(cameraParameterAt(2.5)).toBeCloseTo(0.5);
    expect(cameraParameterAt(40)).toBe(1);
  });

  it('eases frame-rate independently and reveals the week from chapter 03', () => {
    expect(dampFactor(-1)).toBe(0);
    expect(dampFactor(1 / 60)).toBeGreaterThan(0);
    expect(dampFactor(1 / 60, 10)).toBeGreaterThan(dampFactor(1 / 60));
    expect(ringOpacity(0, 0)).toBe(1);
    expect(ringOpacity(3, 0)).toBe(0);
    expect(ringOpacity(1, 4)).toBeCloseTo(0.88);
    expect(ringOpacity(9, 4)).toBeCloseTo(0.18);
  });

  it('runs the hand from 08:00 at the top of the page to midnight at the end', () => {
    expect(handMinuteAt(-1)).toBe(DAY_START_MINUTE);
    expect(handMinuteAt(CHAPTER_COUNT - 1)).toBe(DAY_END_MINUTE);
    expect(handMinuteAt((CHAPTER_COUNT - 1) / 2)).toBe(16 * 60);
    expect(formatClock(DAY_START_MINUTE)).toBe('08:00');
    expect(formatClock(13 * 60 + 7.9)).toBe('13:07');
    expect(formatClock(DAY_END_MINUTE)).toBe('24:00');
  });

  it('lights what the hand has passed and trails light behind it, either way', () => {
    expect(arcLevel(600, 700)).toBe(1);
    expect(arcLevel(800, 700)).toBe(FUTURE_LEVEL);
    // Turning forward (scrolling down), the trail is at earlier minutes.
    expect(trailAt(700, 700, 1)).toBe(1);
    expect(trailAt(700 - TRAIL_MINUTES / 2, 700, 1)).toBeCloseTo(0.5);
    expect(trailAt(710, 700, 1)).toBe(0);
    expect(trailAt(700 - TRAIL_MINUTES - 1, 700, 1)).toBe(0);
    // Turning back (scrolling up), it flips to later minutes.
    expect(trailAt(745, 700, -1)).toBeCloseTo(0.5);
    expect(trailAt(690, 700, -1)).toBe(0);
    expect(sweepStrength(0)).toBe(0);
    expect(sweepStrength(-120)).toBeCloseTo(0.5);
    expect(sweepStrength(10_000)).toBe(1);
  });

  it('warps with scroll speed and lines the week back up at the end', () => {
    expect(warpTarget(0.1)).toBe(0);
    expect(warpTarget(-1.25)).toBeCloseTo(0.5);
    expect(warpTarget(50)).toBe(1);
    expect(ringDepth(0, 1)).toBeCloseTo(0);
    expect(ringDepth(2, 0)).toBeCloseTo(-2 * RING_SPACING);
    expect(ringDepth(2, 1)).toBeLessThan(ringDepth(2, 0));

    expect(ringTwist(0, 3, 1)).toEqual({ spin: 0, tilt: 0 });
    const odd = ringTwist(1, 2, 0);
    const even = ringTwist(2, 2, 0);
    expect(Math.sign(odd.spin)).toBe(-1);
    expect(Math.sign(even.spin)).toBe(1);
    expect(Math.abs(ringTwist(3, 2, 1).spin)).toBeGreaterThan(Math.abs(ringTwist(3, 2, 0).spin));
    const aligned = ringTwist(4, CHAPTER_COUNT - 1, 1);
    expect(aligned.spin).toBeCloseTo(0);
    expect(aligned.tilt).toBeCloseTo(0);
  });

  it('reads the minute and the ring band under a point on the dial', () => {
    expect(minuteAtPoint(0, 1)).toBeCloseTo(0);
    expect(minuteAtPoint(1, 0)).toBeCloseTo(360);
    expect(minuteAtPoint(0, -1)).toBeCloseTo(720);
    expect(minuteAtPoint(-1, 0)).toBeCloseTo(1080);
    expect(minuteAtPoint(-1, 1)).toBeCloseTo(1260);
    expect(onRingBand(RING_RADIUS, 0)).toBe(true);
    expect(onRingBand(0, RING_RADIUS + 0.5)).toBe(false);
    expect(onRingBand(1, 1)).toBe(false);
  });
});

describe('daylight', () => {
  it('starts the day path on the last story shot and eases dusk into day', () => {
    expect(DAY_CAMERA_KEYS[0]).toEqual(CAMERA_KEYS.at(-1));
    expect(dayCameraParameterAt(-1)).toBe(0);
    expect(dayCameraParameterAt(0.4)).toBe(0.4);
    expect(dayCameraParameterAt(3)).toBe(1);
    expect(daylightAt(0)).toBe(0);
    expect(daylightAt(0.5)).toBeCloseTo(0.5);
    expect(daylightAt(2)).toBe(1);
    expect(daylightAt(0.25)).toBeLessThan(0.25);
    expect(bloomFade(0)).toBe(1);
    expect(bloomFade(0.5)).toBeCloseTo(1 / 16);
    expect(bloomFade(9)).toBe(0);
  });
});

describe('time-midnight', () => {
  it('fires once at the end, after the grow-in, and re-arms only well above it', () => {
    const late = { ...MIDNIGHT_START };
    expect(nextMidnight(late, 2, 0.016, 5)).toBe(late);
    expect(nextMidnight(late, MIDNIGHT_FIRE_AT, 0.016, MIDNIGHT_MIN_SCENE_AGE / 2)).toBe(late);
    const playing = nextMidnight(late, MIDNIGHT_FIRE_AT, 0.016, 5);
    expect(playing).toEqual({ phase: 'playing', elapsed: 0 });
    // Time is real and clamped: a huge or negative delta cannot skip or rewind it.
    expect(nextMidnight(playing, 5, 10, 6).elapsed).toBeCloseTo(0.1);
    expect(nextMidnight(playing, 5, -1, 6).elapsed).toBe(0);
    const nearlyDone = { phase: 'playing' as const, elapsed: MIDNIGHT_DURATION - 0.05 };
    const done = nextMidnight(nearlyDone, 5, 0.1, 9);
    expect(done).toEqual({ phase: 'done', elapsed: MIDNIGHT_DURATION });
    expect(nextMidnight(done, 5, 0.1, 9)).toBe(done);
    expect(nextMidnight(done, MIDNIGHT_REARM_BELOW + 0.1, 0.1, 9)).toBe(done);
    expect(nextMidnight(done, MIDNIGHT_REARM_BELOW - 0.1, 0.1, 9)).toBe(MIDNIGHT_START);
    expect(nextMidnight(playing, 1, 0.1, 9)).toBe(MIDNIGHT_START);
  });

  it('collapses, strikes, sends a wave and bursts, then rests merged', () => {
    expect(midnightFrame(MIDNIGHT_START)).toEqual({
      burst: 0,
      collapse: 0,
      flash: 0,
      newDay: false,
      wave: 0,
    });
    const before = midnightFrame({ phase: 'playing', elapsed: MIDNIGHT_STRIKE / 4 });
    expect(before.collapse).toBeGreaterThan(0);
    expect(before.collapse).toBeLessThan(0.5);
    expect(before.flash).toBe(0);
    expect(before.newDay).toBe(false);
    const halfway = midnightFrame({ phase: 'playing', elapsed: MIDNIGHT_STRIKE * 0.75 });
    expect(halfway.collapse).toBeGreaterThan(0.5);
    const strike = midnightFrame({ phase: 'playing', elapsed: MIDNIGHT_STRIKE });
    expect(strike).toMatchObject({ collapse: 1, flash: 1, newDay: true, wave: 0 });
    const after = midnightFrame({ phase: 'playing', elapsed: MIDNIGHT_STRIKE + 0.75 });
    expect(after.wave).toBeCloseTo(0.5);
    expect(after.flash).toBeCloseTo(1 / 16, 1);
    const rest = midnightFrame({ phase: 'done', elapsed: MIDNIGHT_DURATION });
    expect(rest).toMatchObject({ collapse: 1, flash: 0, wave: 1, newDay: true });
  });

  it('shapes the shockwave and the chapter pulse', () => {
    expect(waveShape(0)).toEqual({ opacity: 0, scale: 1 });
    expect(waveShape(1)).toEqual({ opacity: 0, scale: 1 });
    expect(waveShape(0.5).scale).toBeGreaterThan(1);
    expect(waveShape(0.5).opacity).toBeGreaterThan(0);
    expect(pulseShape(-1)).toEqual({ opacity: 0, scale: 1, throb: 0 });
    expect(pulseShape(PULSE_SECONDS)).toEqual({ opacity: 0, scale: 1, throb: 0 });
    const early = pulseShape(PULSE_SECONDS * 0.2);
    expect(early.throb).toBeGreaterThan(0);
    expect(pulseShape(PULSE_SECONDS * 0.9).throb).toBeCloseTo(0);
  });
});

describe('Scramble', () => {
  it('decodes only Latin letters and digits, settling left to right', () => {
    const always = () => 0;
    expect(scrambleFrame('02 — ab', 1, always)).toBe('02 — ab');
    const start = scrambleFrame('02 — หนึ่งวัน', 0, always);
    expect(start.startsWith('AA')).toBe(true);
    expect(start.endsWith(' — หนึ่งวัน')).toBe(true);
    expect(scrambleFrame('ab', 0.99, always)).toBe('ab');
    expect(scrambleFrame('a', 0, () => 0.999_999_9)).toHaveLength(1);
  });

  function flushFrames(at: number) {
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(at);
    });
  }

  it('keeps the real text readable and decodes once it is seen', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const { container, unmount } = render(<Scramble text="KICKER 02" />);
    expect(screen.getByText('KICKER 02', { selector: '.tx-sr-only' })).toBeInTheDocument();
    const observer = observers.at(-1) as ObserverRecord;
    const node = container.firstElementChild as Element;
    intersect(observer, node, false);
    expect(frames.size).toBe(0);
    intersect(observer, node, true);
    flushFrames(300);
    expect(frames.size).toBe(1);
    flushFrames(2000);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('KICKER 02');
    unmount();
  });

  it('stays still under reduced motion', () => {
    setMedia(['reduce']);
    render(<Scramble text="STILL" />);
    expect(observers).toHaveLength(0);
  });
});

describe('CountUp', () => {
  function digits(container: HTMLElement) {
    return container.querySelector('[aria-hidden="true"]')?.textContent;
  }

  it('shows the final value when motion is reduced or it is already on screen', () => {
    setMedia(['reduce']);
    const { container, unmount } = render(<CountUp value={51} />);
    expect(digits(container)).toBe('51');
    unmount();
    setMedia([]);
    const visible = render(<CountUp value={51} />);
    expect(digits(visible.container)).toBe('51');
    expect(observers).toHaveLength(0);
  });

  it('counts up from zero when it scrolls into view', () => {
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    rect.mockReturnValue({ top: 5000 } as DOMRect);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const { container, unmount } = render(<CountUp value={51} />);
    expect(digits(container)).toBe('0');
    const observer = observers.at(-1) as ObserverRecord;
    intersect(observer, container.firstElementChild as Element, false);
    intersect(observer, container.firstElementChild as Element, true);
    act(() => {
      for (const callback of [...frames.values()]) callback(600);
    });
    expect(Number(digits(container))).toBeGreaterThan(0);
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(5000);
    });
    expect(digits(container)).toBe('51');
    unmount();
    rect.mockRestore();
  });
});

describe('HoverTip', () => {
  it('shows the hovered slice with its kind and the demo label', () => {
    const labels = { human: 'Human', ai: 'AI agents', unattributed: 'Unattributed' };
    const { container } = render(<HoverTip demo="Demo data" labels={labels} />);
    expect(container.firstChild).toBeNull();
    act(() => setTimeUi({ hover: { kind: 'ai', minute: 615, x: 10, y: 20 } }));
    expect(screen.getByText('10:15–10:20')).toBeInTheDocument();
    expect(screen.getByText('AI agents')).toBeInTheDocument();
    expect(screen.getByText('Demo data')).toBeInTheDocument();
    expect(container.querySelector('.tx-tip')).toHaveStyle({
      transform: 'translate(28px, 38px)',
    });
  });
});

describe('ClockReadout', () => {
  function flush() {
    act(() => {
      const pending = [...frames.entries()];
      frames.clear();
      for (const [, callback] of pending) callback(0);
    });
  }

  it('follows the scroll until the scene runs, then the eased hand', () => {
    const { unmount } = render(<ClockReadout label="Demo day" newDay="New day" />);
    expect(screen.getByText('08:00')).toBeInTheDocument();
    timeMotion.target = CHAPTER_COUNT - 1;
    flush();
    expect(screen.getByText('24:00')).toBeInTheDocument();

    setTimeUi({ sceneStatus: 'ready' });
    timeMotion.hand = 10 * 60 + 30;
    flush();
    expect(screen.getByText('10:30')).toBeInTheDocument();
    expect(screen.getByText('Demo day')).toBeInTheDocument();
    act(() => setTimeUi({ midnight: true }));
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText('New day')).toBeInTheDocument();
    unmount();
    expect(frames.size).toBe(0);
  });
});

describe('time-quality', () => {
  it('shows the still for reduced motion, data saver and missing WebGL', () => {
    expect(chooseTimeQuality({ ...baseSignals, reducedMotion: true })).toBeNull();
    expect(chooseTimeQuality({ ...baseSignals, saveData: true })).toBeNull();
    expect(chooseTimeQuality({ ...baseSignals, webgl: false })).toBeNull();
  });

  it('gives phones the compact tier and weak devices the low tier', () => {
    expect(chooseTimeQuality({ ...baseSignals, compact: true })).toBe(QUALITY_TIERS.compact);
    expect(chooseTimeQuality({ ...baseSignals, memory: 4 })).toBe(QUALITY_TIERS.low);
    expect(chooseTimeQuality({ ...baseSignals, cores: 2 })).toBe(QUALITY_TIERS.low);
    expect(chooseTimeQuality({ ...baseSignals, cores: undefined, memory: undefined })).toBe(
      QUALITY_TIERS.full
    );
  });

  it('reads the device signals from the browser', () => {
    setMedia(['max-width', 'reduce']);
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({} as RenderingContext);
    expect(readDeviceSignals()).toMatchObject({ compact: true, reducedMotion: true, webgl: true });

    getContext.mockImplementation(() => {
      throw new Error('blocked');
    });
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    });
    expect(readDeviceSignals()).toMatchObject({ saveData: true, webgl: false });
    Reflect.deleteProperty(navigator, 'connection');
  });
});

describe('time-store', () => {
  it('notifies subscribers only when a value actually changes', () => {
    function Probe() {
      const chapter = useTimeUi((state) => state.chapter);
      return <output>{chapter}</output>;
    }
    render(<Probe />);
    act(() => setTimeUi({ chapter: 3 }));
    expect(screen.getByRole('status')).toHaveTextContent('3');
    const before = getTimeUi();
    setTimeUi({ chapter: 3 });
    expect(getTimeUi()).toBe(before);
    expect(renderToStaticMarkup(<Probe />)).toContain('>0<');
  });
});

describe('time-copy', () => {
  function shape(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(shape);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shape(entry)]));
    }
    return typeof value;
  }

  it('keeps the Thai copy structurally identical to the English copy', () => {
    expect(shape(TIME_COPY.th)).toEqual(shape(TIME_COPY.en));
    expect(TIME_COPY.en.begin.links.every((link) => /^[/#]/.test(link.href))).toBe(true);
  });
});

describe('TimeExperience', () => {
  it('server-renders every chapter with one h1, in both languages', () => {
    for (const locale of ['en', 'th'] as const) {
      const { unmount } = render(<TimeExperience locale={locale} />);
      const copy = TIME_COPY[locale];
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      for (const heading of [
        copy.heartbeats.heading,
        copy.ring.heading,
        copy.humanAi.heading,
        copy.product.heading,
        copy.begin.heading,
      ]) {
        expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
      }
      expect(document.querySelectorAll('[data-chapter]')).toHaveLength(CHAPTER_COUNT);
      expect(document.querySelector('.tx-still')).not.toBeNull();
      expect(document.querySelector('[data-motion-owner="experience"]')).not.toBeNull();
      unmount();
    }
  });

  it('keeps the homepage content that search and the table of contents rely on', () => {
    render(<TimeExperience locale="en" />);
    const copy = TIME_COPY.en;
    const example = document.querySelector('#worked-example') as HTMLElement;
    expect(
      within(example).getByRole('heading', { name: copy.ring.example.heading })
    ).toBeInTheDocument();
    expect(example).toHaveTextContent(copy.ring.example.source);
    expect(document.querySelector('#features')).not.toBeNull();
    for (const feature of copy.product.features) {
      expect(screen.getByRole('heading', { name: feature.title })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: copy.humanAi.evidence.sourceTitle })).toHaveAttribute(
      'href',
      copy.humanAi.evidence.href
    );
    expect(screen.getAllByRole('link', { name: /Join early access/ })[0]).toHaveAttribute(
      'href',
      '/early-access'
    );
    expect(screen.getByRole('link', { name: copy.hero.secondary })).toHaveAttribute(
      'href',
      '/wakatime-alternative'
    );
  });

  it('localises paths in Thai and leaves in-page anchors alone', () => {
    render(<TimeExperience locale="th" />);
    const nav = screen.getByRole('navigation', { name: TIME_COPY.th.begin.navLabel });
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('#features');
    expect(
      hrefs.filter((href) => href?.startsWith('/')).every((href) => href?.startsWith('/th/'))
    ).toBe(true);
  });
});

describe('AttributionFocus', () => {
  it('focuses one kind and dims the other cards', () => {
    const kinds = TIME_COPY.en.humanAi.kinds;
    render(<AttributionFocus controlsLabel="Focus" kinds={kinds} />);
    const group = screen.getByRole('group', { name: 'Focus' });
    fireEvent.click(within(group).getByRole('button', { name: kinds.ai.label }));
    expect(getTimeUi().focus).toBe('ai');
    expect(within(group).getByRole('button', { name: kinds.ai.label })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const cards = document.querySelectorAll<HTMLElement>('.tx-kinds li');
    expect([...cards].map((card) => card.dataset.dim)).toEqual(['true', 'false', 'true']);
  });
});

describe('whenIdle', () => {
  it('waits for load, then for an idle callback', () => {
    const idle = vi.fn<(callback: () => void) => number>(() => 7);
    const cancelIdle = vi.fn();
    Object.assign(window, { requestIdleCallback: idle, cancelIdleCallback: cancelIdle });
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
    const callback = vi.fn();
    const cancel = whenIdle(callback);
    window.dispatchEvent(new Event('load'));
    expect(idle).toHaveBeenCalled();
    cancel();
    expect(cancelIdle).toHaveBeenCalledWith(7);

    whenIdle(callback)();
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
  });

  it('falls back to a timeout without requestIdleCallback', () => {
    Reflect.deleteProperty(window, 'requestIdleCallback');
    vi.useFakeTimers();
    const callback = vi.fn();
    whenIdle(callback);
    vi.advanceTimersByTime(600);
    expect(callback).toHaveBeenCalled();
    whenIdle(callback)();
    vi.useRealTimers();
  });
});

describe('TimeStage', () => {
  function mountRoot() {
    const root = document.createElement('div');
    root.id = 'tx-root-test';
    root.innerHTML = `<div id="tx-chapters"><section data-chapter="0"></section><section data-chapter="1"></section></div>`;
    document.body.append(root);
    return root;
  }

  it('falls back to the still when the device cannot run the scene', () => {
    setMedia(['reduce']);
    const root = mountRoot();
    render(
      <TimeStage copy={TIME_COPY.en} rootId="tx-root-test">
        <svg data-testid="still" />
      </TimeStage>,
      { container: root.appendChild(document.createElement('div')) }
    );
    expect(screen.getByTestId('still')).toBeInTheDocument();
    expect(screen.queryByTestId('time-canvas')).toBeNull();
    expect(root.dataset.scene).toBe('fallback');
    expect(screen.getByRole('status')).toHaveTextContent(TIME_COPY.en.loader.skipped);
  });

  it('loads the scene when idle, pauses it off screen and tracks the chapter', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
    Object.assign(window, {
      requestIdleCallback: (run: () => void) => (run(), 1),
      cancelIdleCallback: () => {},
    });
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
    const root = mountRoot();
    render(
      <TimeStage copy={TIME_COPY.en} rootId="tx-root-test">
        <svg />
      </TimeStage>,
      { container: root.appendChild(document.createElement('div')) }
    );
    expect(screen.getByTestId('time-canvas')).toHaveAttribute('data-mode', 'always');
    expect(screen.getByRole('status')).toHaveTextContent(TIME_COPY.en.loader.label);

    const visibility = observers.find((record) => record.targets[0]?.id === 'tx-chapters');
    intersect(visibility as ObserverRecord, root, false);
    expect(screen.getByTestId('time-canvas')).toHaveAttribute('data-mode', 'demand');
    act(() => {
      (visibility as ObserverRecord).callback([], {} as IntersectionObserver);
    });

    act(() => setTimeUi({ sceneStatus: 'ready', chapter: 1 }));
    expect(root.dataset.scene).toBe('ready');
    expect(screen.getByRole('status')).toHaveTextContent(TIME_COPY.en.loader.ready);
    expect(screen.getByRole('link', { name: /02/ })).toHaveAttribute('aria-current', 'step');
  });

  it('copes with a page that has no root or main element', () => {
    setMedia(['reduce']);
    render(
      <TimeStage copy={TIME_COPY.en} rootId="missing">
        <svg />
      </TimeStage>
    );
    expect(screen.queryByTestId('time-canvas')).toBeNull();
  });
});

describe('useTimeScroll', () => {
  function Hook({ rootId }: { rootId: string }) {
    useTimeScroll(rootId);
    return null;
  }

  it('turns chapter progress into the story position, speed and hand angle', () => {
    const root = document.createElement('div');
    root.id = 'scroll-root';
    root.innerHTML =
      '<section data-chapter="0"></section><section data-chapter="1"></section>' +
      '<section data-chapter="2" data-pin></section>';
    document.body.append(root);
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const { unmount } = render(<Hook rootId="scroll-root" />);

    expect(scroll.registered).toBeGreaterThan(0);
    expect(root.dataset.scroll).toBe('ready');
    const [first, second, third, pin] = scroll.triggers as [
      (typeof scroll.triggers)[number],
      (typeof scroll.triggers)[number],
      (typeof scroll.triggers)[number],
      (typeof scroll.triggers)[number],
    ];
    expect(first.config.start).toBe('top top');
    expect(second.config.end).toBe('bottom center');
    expect(third.config.end).toBe('bottom bottom');
    expect(pin.config.start).toBe('top top');

    // Ordinary scrolling: no snap, and a measured speed in viewports per second.
    timeMotion.teleport = false;
    now.mockReturnValue(1500);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: window.innerHeight });
    act(() => setTimeUi({ hover: { kind: 'human', minute: 600, x: 1, y: 1 } }));
    act(() => first.config.onUpdate({ progress: 0.3 }));
    expect(timeMotion.target).toBeCloseTo(0.3);
    expect(timeMotion.teleport).toBe(false);
    expect(timeMotion.velocity).toBeCloseTo(2);
    expect(getTimeUi().hover).toBeNull();
    // A second trigger in the same scroll event: the page did not move again, so the
    // measured speed is kept rather than reset to zero.
    act(() => second.config.onRefresh({ progress: 1 }));
    expect(timeMotion.velocity).toBeCloseTo(2);
    expect(timeMotion.teleport).toBe(false);
    expect(root.dataset.chapter).toBe('1');
    expect(getTimeUi().chapter).toBe(1);
    expect(root.style.getPropertyValue('--tx-hand')).toMatch(/deg$/);
    expect(getTimeUi().midnight).toBe(false);

    // A jump of more than a screen and a half (anchor, Home/End) snaps and carries no speed.
    now.mockReturnValue(1600);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: window.innerHeight * 4 });
    act(() => third.config.onUpdate({ progress: 1 }));
    expect(timeMotion.teleport).toBe(true);
    expect(timeMotion.velocity).toBe(0);
    // Without the 3D scene the hook decides midnight; this story stops short of the end.
    expect(timeMotion.target).toBeLessThan(MIDNIGHT_FIRE_AT);
    expect(getTimeUi().midnight).toBe(false);
    // With the scene running, the scene owns it and the hook leaves it alone.
    act(() => setTimeUi({ sceneStatus: 'ready', midnight: true }));
    act(() => third.config.onUpdate({ progress: 1 }));
    expect(getTimeUi().midnight).toBe(true);

    const pinned = root.querySelector('[data-pin]') as HTMLElement;
    act(() => pin.config.onUpdate({ progress: 0.25 }));
    expect(pinned.style.getPropertyValue('--tx-pin')).toBe('0.2500');
    act(() => pin.config.onRefresh({ progress: 1 }));
    expect(pinned.style.getPropertyValue('--tx-pin')).toBe('1.0000');

    const reveal = observers.at(-1) as ObserverRecord;
    const chapter = root.querySelector('section') as HTMLElement;
    intersect(reveal, chapter, false);
    expect(chapter.dataset.inview).toBeUndefined();
    intersect(reveal, chapter, true);
    expect(chapter.dataset.inview).toBe('true');

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 0 }));
    expect(timeMotion.pointerX).toBe(-1);
    expect(timeMotion.pointerY).toBe(1);

    unmount();
    expect(scroll.triggers.every((trigger) => trigger.killed)).toBe(true);
    expect(root.dataset.scroll).toBeUndefined();
  });

  it('does nothing without its root element', () => {
    render(<Hook rootId="nowhere" />);
    expect(scroll.triggers).toHaveLength(0);
  });
});

describe('useTimeScroll — after the story', () => {
  function Hook() {
    useTimeScroll('dawn-root');
    return null;
  }

  function mountPage() {
    const root = document.createElement('div');
    root.id = 'dawn-root';
    root.innerHTML = '<section data-chapter="0"></section><div id="tx-dawn"></div>';
    const day = document.createElement('div');
    day.id = 'tx-day';
    day.innerHTML = '<section id="first"></section><section id="second"></section>';
    document.body.append(root, day);
    return { root, day };
  }

  it('turns dusk to day, moves the day camera and tilts sections in', () => {
    const { root, day } = mountPage();
    const { unmount } = render(<Hook />);
    const byTrigger = (element: Element) =>
      scroll.triggers.find((record) => record.config.trigger === element) as {
        config: TriggerConfig;
      };

    const dawn = byTrigger(root.querySelector('#tx-dawn') as Element);
    act(() => dawn.config.onUpdate({ progress: 0.25 }));
    expect(timeMotion.dawnTarget).toBe(0.25);
    expect(root.style.getPropertyValue('--tx-day')).toBe(daylightAt(0.25).toFixed(3));
    expect(root.dataset.dawn).toBe('false');
    act(() => dawn.config.onRefresh({ progress: 0.9 }));
    expect(root.dataset.dawn).toBe('true');

    const dayTrigger = byTrigger(day);
    act(() => dayTrigger.config.onUpdate({ progress: 0.4 }));
    expect(timeMotion.dayTarget).toBe(0.4);
    act(() => dayTrigger.config.onRefresh({ progress: 0.5 }));
    expect(timeMotion.dayTarget).toBe(0.5);

    const section = day.querySelector('#first') as HTMLElement;
    const rise = byTrigger(section);
    act(() => rise.config.onUpdate({ progress: 0.3, trigger: section }));
    expect(section.dataset.rising).toBe('true');
    expect(section.style.getPropertyValue('--rise')).toBe('0.300');
    act(() => rise.config.onRefresh({ progress: 1, trigger: section }));
    expect(section.dataset.rising).toBeUndefined();
    expect(section.style.getPropertyValue('--rise')).toBe('');

    unmount();
    expect(scroll.triggers.every((trigger) => trigger.killed)).toBe(true);
  });

  it('leaves the sections still under reduced motion', () => {
    setMedia(['reduce']);
    const { day } = mountPage();
    render(<Hook />);
    expect(scroll.triggers.some((record) => record.config.trigger === day)).toBe(true);
    expect(scroll.triggers.some((record) => record.config.trigger === day.firstElementChild)).toBe(
      false
    );
  });
});

describe('SmoothScroll', () => {
  async function settle() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('stays off for reduced motion and touch screens', async () => {
    setMedia(['reduce']);
    render(<SmoothScroll />);
    setMedia(['coarse']);
    render(<SmoothScroll />);
    await settle();
    expect(smooth.instances).toHaveLength(0);
  });

  it('drives Lenis from the shared ticker and routes in-page links through it', async () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const target = document.createElement('section');
    target.id = 'faq';
    const link = document.createElement('a');
    link.href = '#faq';
    const elsewhere = document.createElement('a');
    elsewhere.href = '#missing';
    document.body.append(target, link, elsewhere);

    const { unmount } = render(<SmoothScroll />);
    await settle();
    const [lenis] = smooth.instances as [(typeof smooth.instances)[number]];
    expect(lenis.options).toMatchObject({ autoRaf: false });
    expect(typeof lenis.listeners.scroll).toBe('function');
    for (const tick of scroll.ticks) tick(2);
    expect(lenis.rafs).toEqual([2000]);

    fireEvent.click(elsewhere);
    fireEvent.click(document.body);
    expect(lenis.scrolls).toHaveLength(0);

    fireEvent.click(link);
    expect(lenis.scrolls).toEqual([{ target, options: { offset: -64, duration: 1.6 } }]);
    expect(target).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(target);
    expect(pushState).toHaveBeenCalledWith(null, '', '#faq');

    // An element that is already focusable keeps its own tabindex.
    target.setAttribute('tabindex', '0');
    fireEvent.click(link);
    expect(target).toHaveAttribute('tabindex', '0');

    unmount();
    expect(lenis.destroyed).toBe(true);
    expect(scroll.ticks.size).toBe(0);
    expect(scroll.lag.at(-1)).toEqual([500, 33]);
  });

  it('does not start if it unmounts before Lenis has loaded', async () => {
    const { unmount } = render(<SmoothScroll />);
    unmount();
    await settle();
    expect(smooth.instances).toHaveLength(0);
  });
});

describe('useTimeScroll — page height changes', () => {
  it('re-measures the triggers, debounced, when the page height changes', () => {
    const callbacks: ResizeObserverCallback[] = [];
    const disconnects: number[] = [];
    window.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {
        disconnects.push(1);
      }
    } as unknown as typeof ResizeObserver;
    vi.useFakeTimers();
    const root = document.createElement('div');
    root.id = 'height-root';
    root.innerHTML = '<section data-chapter="0"></section>';
    document.body.append(root);
    function Hook() {
      useTimeScroll('height-root');
      return null;
    }
    const { unmount } = render(<Hook />);
    const before = scroll.refreshes;
    const notify = callbacks.at(-1) as ResizeObserverCallback;
    notify([], {} as ResizeObserver);
    notify([], {} as ResizeObserver);
    vi.advanceTimersByTime(200);
    expect(scroll.refreshes - before).toBe(1);
    unmount();
    expect(disconnects.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});
