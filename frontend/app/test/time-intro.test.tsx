import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TIME_COPY } from '@/components/marketing/time/time-copy';
import {
  INTRO_FAILSAFE_MS,
  INTRO_HOLD_MS,
  INTRO_MAX_MS,
  INTRO_MIN_MS,
  INTRO_REVEAL_MS,
  INTRO_WARM_MS,
  introGoal,
  introStep,
  stepIntro,
  TimeIntro,
} from '@/components/marketing/time/time-intro';
import { resetTimeUi, setTimeUi } from '@/components/marketing/time/time-store';

const copy = TIME_COPY.en.loader;
const idle = { forced: false, pageLoaded: false, status: 'idle', warm: false } as const;

describe('intro progress', () => {
  it('maps each real loading stage to a milestone', () => {
    expect(introGoal(idle)).toBe(0.12);
    expect(introGoal({ ...idle, pageLoaded: true })).toBe(0.3);
    expect(introGoal({ ...idle, status: 'loading' })).toBe(0.62);
    expect(introGoal({ ...idle, status: 'ready' })).toBe(0.9);
    expect(introGoal({ ...idle, status: 'ready', warm: true })).toBe(1);
    expect(introGoal({ ...idle, status: 'fallback' })).toBe(1);
    expect(introGoal({ ...idle, forced: true })).toBe(1);
  });

  it('eases towards the milestone, creeps on while waiting and respects the minimum', () => {
    // Held to the elapsed share of the minimum duration.
    expect(stepIntro(0, 1, 0, INTRO_MIN_MS / 2, 10_000)).toBeCloseTo(0.5);
    // Without waiting, it stops at the milestone; after waiting it creeps past it.
    expect(stepIntro(0, 0.3, 0, 10_000, 10_000)).toBeCloseTo(0.3);
    const crept = stepIntro(0.3, 0.3, 10_000, 10_000, 10_000);
    expect(crept).toBeGreaterThan(0.5);
    expect(crept).toBeLessThan(0.62);
    expect(stepIntro(0, 0.12, 60_000, 10_000, 10_000)).toBeLessThan(0.3);
    expect(stepIntro(0.62, 0.62, 60_000, 10_000, 10_000)).toBeLessThan(0.9);
    expect(stepIntro(0.9, 0.9, 60_000, 10_000, 10_000)).toBeLessThan(1);
    // A single short frame moves part of the way; it never goes backwards.
    const partial = stepIntro(0, 1, 0, 10_000, 16);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
    expect(stepIntro(0.8, 0.3, 0, 10_000, 16)).toBe(0.8);
    // Close enough snaps to the cap, so the count can actually reach 100.
    expect(stepIntro(0.998, 1, 0, 10_000, 16)).toBe(1);
  });

  it('names the step the count is on', () => {
    expect(introStep(0.1)).toBe(0);
    expect(introStep(0.7)).toBe(1);
    expect(introStep(0.95)).toBe(2);
  });
});

describe('TimeIntro', () => {
  let root: HTMLElement;

  function mount() {
    return render(<TimeIntro copy={copy} rootId="tx-intro-root" />, {
      container: root.appendChild(document.createElement('div')),
    });
  }

  // Small steps, each in its own act, so React renders between frames as a browser does.
  function advance(ms: number) {
    for (let left = ms; left > 0; left -= 50) {
      act(() => {
        vi.advanceTimersByTime(Math.min(50, left));
      });
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
      ],
    });
    resetTimeUi();
    root = document.createElement('div');
    root.id = 'tx-intro-root';
    document.body.append(root);
  });

  afterEach(() => {
    vi.useRealTimers();
    root.remove();
    Reflect.deleteProperty(document, 'readyState');
  });

  it('counts with the real scene stages, then parts the letterbox and leaves', () => {
    const { container } = mount();
    const overlay = () => container.querySelector('.tx-intro');
    expect(overlay()).toHaveAttribute('data-live', 'true');
    expect(overlay()).toHaveAttribute('aria-hidden', 'true');
    expect(root.dataset.intro).toBe('loading');

    advance(600);
    const early = Number(container.querySelector('.tx-intro-count')?.textContent);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(62);
    expect(container.querySelector('.tx-intro-label span')).toHaveTextContent(copy.steps[0]);

    act(() => setTimeUi({ sceneStatus: 'loading' }));
    act(() => setTimeUi({ sceneStatus: 'ready' }));
    advance(INTRO_WARM_MS / 2);
    expect(container.querySelector('.tx-intro-count')?.textContent).not.toBe('100');
    advance(INTRO_WARM_MS + INTRO_MIN_MS);
    expect(container.querySelector('.tx-intro-count')).toHaveTextContent('100');
    expect(container.querySelector('.tx-intro-label span')).toHaveTextContent(copy.steps[2]);
    expect(container.querySelector<HTMLElement>('.tx-intro-track span')?.style.transform).toBe(
      'scaleX(1)'
    );

    advance(INTRO_HOLD_MS);
    expect(overlay()).toHaveAttribute('data-phase', 'reveal');
    expect(root.dataset.intro).toBe('reveal');
    advance(INTRO_REVEAL_MS);
    expect(overlay()).toBeNull();
    expect(root.dataset.intro).toBe('done');
  });

  it('waits for the page load event and opens anyway once the scene is too slow', () => {
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
    const { container } = mount();
    advance(300);
    act(() => {
      window.dispatchEvent(new Event('load'));
    });
    advance(INTRO_MAX_MS + 1000);
    advance(INTRO_HOLD_MS);
    expect(container.querySelector('.tx-intro')).toHaveAttribute('data-phase', 'reveal');
  });

  it('skips the opening for reduced motion and for a late hydration', () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...matchMedia(query),
      matches: true,
    })) as typeof window.matchMedia;
    const reduced = mount();
    expect(reduced.container.querySelector('.tx-intro')).toBeNull();
    expect(root.dataset.intro).toBe('done');
    reduced.unmount();
    window.matchMedia = matchMedia;

    vi.advanceTimersByTime(INTRO_FAILSAFE_MS + 1);
    expect(mount().container.querySelector('.tx-intro')).toBeNull();
  });

  it('cleans up when it leaves mid-way, and copes without its root', () => {
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
    act(() => setTimeUi({ sceneStatus: 'ready' }));
    const loading = mount();
    loading.unmount();

    act(() => setTimeUi({ sceneStatus: 'fallback' }));
    root.id = 'elsewhere';
    delete root.dataset.intro;
    const revealing = mount();
    advance(INTRO_MIN_MS + 1000);
    advance(INTRO_HOLD_MS);
    expect(revealing.container.querySelector('.tx-intro')).toHaveAttribute('data-phase', 'reveal');
    expect(root.dataset.intro).toBeUndefined();
    revealing.unmount();
  });
});
