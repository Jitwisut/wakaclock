import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { MarketingPointerEffects } from '@/components/marketing/marketing-pointer-effects';

type Listener = () => void;

/** matchMedia stub: queries containing `reduce` answer `reduced`, the rest `fine`. */
function mediaStub({ fine = true, reduced = false } = {}) {
  const listeners: Listener[] = [];
  const state = { fine, reduced };
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return query.includes('reduce') ? state.reduced : state.fine;
        },
        addEventListener: (_: string, listener: Listener) => listeners.push(listener),
        removeEventListener: (_: string, listener: Listener) => {
          listeners.splice(listeners.indexOf(listener), 1);
        },
      }) as unknown as MediaQueryList
  );
  return {
    listeners,
    set(next: Partial<typeof state>) {
      Object.assign(state, next);
      for (const listener of [...listeners]) listener();
    },
  };
}

let frames: FrameRequestCallback[] = [];
const flush = () =>
  act(() => {
    const pending = frames;
    frames = [];
    for (const callback of pending) callback(0);
  });

function box(element: Element, rect: Partial<DOMRect>) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 40,
    ...rect,
  } as DOMRect);
}

function move(target: Element, x: number, y: number, pointerType = 'mouse') {
  fireEvent.pointerMove(target, { clientX: x, clientY: y, pointerType });
}

function renderPage() {
  return render(
    <div className="wakaclock-marketing">
      <MarketingPointerEffects />
      <a data-slot="button" href="/join">
        Join
      </a>
      <a className="axis-cta-link" href="/pricing">
        Pricing
      </a>
      <div className="axis-pricing-offer" data-testid="offer">
        Offer
      </div>
      <figure className="mkt-page-art">
        <img alt="Art" src="/art.png" />
      </figure>
      <div data-motion-owner="experience">
        <div data-testid="owned" data-tilt>
          Owned
        </div>
      </div>
      <p>Plain text</p>
    </div>
  );
}

beforeEach(() => {
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('pulls a hovered button toward the pointer, clamped, and releases it on leave', () => {
  mediaStub();
  renderPage();
  const join = screen.getByText('Join');
  box(join, { left: 100, top: 100, width: 100, height: 40 });

  move(join, 190, 130);
  move(join, 192, 131); // coalesced into the same frame
  expect(frames).toHaveLength(1);
  flush();
  // (192 - 150) * 0.28 = 11.76 → clamped to 8; (131 - 120) * 0.28 = 3.08.
  expect(join.style.translate).toBe('8.0px 3.1px');

  // Moving onto another magnet releases the first one.
  const cta = screen.getByText('Pricing');
  box(cta, { left: 0, top: 0, width: 200, height: 40 });
  move(cta, 90, 20);
  flush();
  expect(join.style.translate).toBe('');
  expect(cta.style.translate).toBe('-2.8px 0.0px');

  // Leaving the page releases everything.
  fireEvent.pointerLeave(join.closest('.wakaclock-marketing') as Element);
  expect(cta.style.translate).toBe('');
});

it('lights the pricing card under the pointer without tilting it', () => {
  mediaStub();
  renderPage();
  const offer = screen.getByTestId('offer');
  box(offer, { left: 0, top: 0, width: 200, height: 100 });

  move(offer, 150, 25);
  flush();
  expect(offer.dataset.pointerActive).toBe('true');
  expect(offer.style.getPropertyValue('--mx')).toBe('75.0%');
  expect(offer.style.getPropertyValue('--my')).toBe('25.0%');
  // It holds the CTA and the billing toggle, so it never tilts.
  expect(offer.style.getPropertyValue('--tilt-x')).toBe('');

  move(screen.getByText('Plain text'), 5, 5);
  flush();
  expect(offer.dataset.pointerActive).toBeUndefined();
  expect(offer.style.getPropertyValue('--mx')).toBe('');
});

it('tilts an image from one measurement per hover, and re-measures after a scroll', () => {
  mediaStub();
  renderPage();
  const art = screen.getByAltText('Art');
  const measure = vi.spyOn(art, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 200,
    height: 100,
  } as DOMRect);

  move(art, 150, 25);
  flush();
  // px = 0.75, py = 0.25 at 2.5° either way.
  expect(art.style.getPropertyValue('--tilt-x')).toBe('1.25deg');
  expect(art.style.getPropertyValue('--tilt-y')).toBe('1.25deg');
  move(art, 50, 75);
  flush();
  expect(art.style.getPropertyValue('--tilt-x')).toBe('-1.25deg');
  expect(measure).toHaveBeenCalledOnce();

  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
  move(art, 50, 75);
  flush();
  expect(measure).toHaveBeenCalledTimes(2);
});

it('leaves the homepage experience, touch input and non-element targets alone', () => {
  mediaStub();
  renderPage();
  const owned = screen.getByTestId('owned');
  box(owned, {});
  move(owned, 10, 10);
  flush();
  expect(owned.dataset.pointerActive).toBeUndefined();

  const join = screen.getByText('Join');
  move(join, 10, 10, 'touch');
  expect(frames).toHaveLength(0);

  // A pointer event whose target is the document itself has nothing to pull.
  const root = join.closest('.wakaclock-marketing') as HTMLElement;
  const event = new PointerEvent('pointermove', { bubbles: true, clientX: 1, clientY: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'target', { value: document });
  root.dispatchEvent(event);
  flush();
  expect(join.style.translate).toBe('');
});

it('never displaces a keyboard-focused control, and lets go when one gains focus', () => {
  mediaStub();
  renderPage();
  const join = screen.getByText('Join');
  box(join, { left: 0, top: 0, width: 100, height: 40 });

  move(join, 90, 20);
  flush();
  expect(join.style.translate).not.toBe('');
  fireEvent.focusIn(join);
  expect(join.style.translate).toBe('');
  // Focus elsewhere does not touch the current magnet.
  move(join, 90, 20);
  flush();
  fireEvent.focusIn(screen.getByText('Pricing'));
  expect(join.style.translate).not.toBe('');

  const focusVisible = vi.spyOn(join, 'matches').mockReturnValue(true);
  move(join, 10, 20);
  flush();
  expect(join.style.translate).toBe('');
  focusVisible.mockRestore();

  // Switching windows releases everything as well.
  move(join, 90, 20);
  flush();
  act(() => {
    window.dispatchEvent(new Event('blur'));
  });
  expect(join.style.translate).toBe('');
});

it('stays off for coarse pointers and reduced motion, and follows preference changes', () => {
  const media = mediaStub({ fine: false });
  const { unmount } = renderPage();
  const join = screen.getByText('Join');
  box(join, {});
  move(join, 90, 20);
  expect(frames).toHaveLength(0);

  media.set({ fine: true });
  move(join, 90, 20);
  expect(frames).toHaveLength(1);
  flush();
  expect(join.style.translate).not.toBe('');

  media.set({ reduced: true });
  expect(join.style.translate).toBe('');
  move(join, 90, 20);
  expect(frames).toHaveLength(0);

  unmount();
  expect(media.listeners).toHaveLength(0);
});

it('does nothing outside the marketing container', () => {
  mediaStub();
  render(
    <div>
      <MarketingPointerEffects />
      <a data-slot="button" href="/join">
        Loose
      </a>
    </div>
  );
  move(screen.getByText('Loose'), 5, 5);
  expect(frames).toHaveLength(0);
});
