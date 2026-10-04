import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { FeatureGallery } from '@/components/marketing/feature-gallery';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('disables both controls when all cards fit even without browser observers', () => {
  const resizeObserver = window.ResizeObserver;
  const intersectionObserver = window.IntersectionObserver;
  Object.assign(window, { ResizeObserver: undefined, IntersectionObserver: undefined });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(320);
  try {
    const view = render(
      <FeatureGallery locale="en">
        <article>Only feature</article>
      </FeatureGallery>
    );
    expect(screen.getByRole('button', { name: 'Previous features' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next features' })).toBeDisabled();
    expect(
      screen.getByRole('region').parentElement?.style.getPropertyValue('--gallery-progress')
    ).toBe('1');
    view.unmount();
  } finally {
    Object.assign(window, {
      ResizeObserver: resizeObserver,
      IntersectionObserver: intersectionObserver,
    });
  }
});

it('moves one card at a time, respects reduced motion, and disables controls at the edges', () => {
  let paint: FrameRequestCallback = () => {};
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    paint = callback;
    return 1;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1008);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 320,
  } as DOMRect);
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  render(
    <FeatureGallery locale="en">
      <article>First feature</article>
      <article>Second feature</article>
    </FeatureGallery>
  );
  const previous = screen.getByRole('button', { name: 'Previous features' });
  const next = screen.getByRole('button', { name: 'Next features' });
  const rail = document.getElementById(next.getAttribute('aria-controls') ?? '')!;
  rail.scrollBy = vi.fn();
  expect(previous).toBeDisabled();
  expect(next).toBeEnabled();
  fireEvent.click(next);
  expect(rail.scrollBy).toHaveBeenCalledWith({ left: 344, behavior: 'auto' });
  rail.scrollLeft = 688;
  fireEvent.scroll(rail);
  act(() => paint(16));
  expect(next).toBeDisabled();
  expect(previous).toBeEnabled();
  fireEvent.click(previous);
  expect(rail.scrollBy).toHaveBeenLastCalledWith({ left: -344, behavior: 'auto' });
});

it('reveals cards within the rail, coalesces scroll updates and releases observers', () => {
  const original = window.IntersectionObserver;
  let enter!: (entries: { target: Element; isIntersecting: boolean }[]) => void;
  const observe = vi.fn();
  const disconnect = vi.fn();
  window.IntersectionObserver = class {
    observe = observe;
    disconnect = disconnect;
    constructor(callback: typeof enter) {
      enter = callback;
    }
  } as unknown as typeof IntersectionObserver;
  let paint!: FrameRequestCallback;
  const schedule = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    paint = callback;
    return 42;
  });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame');
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(800);
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
  try {
    const view = render(
      <FeatureGallery locale="th">
        <article>Card</article>
      </FeatureGallery>
    );
    const rail = screen.getByRole('region', { name: 'เลื่อนดูฟีเจอร์ AtoAxis' });
    const card = screen.getByText('Card');
    expect(observe).toHaveBeenCalledWith(card);
    enter([{ target: card, isIntersecting: true }]);
    expect(card).toHaveAttribute('data-in-view', 'true');
    enter([{ target: card, isIntersecting: false }]);
    expect(card).toHaveAttribute('data-in-view', 'false');
    card.getBoundingClientRect = () => ({ width: 200 }) as DOMRect;
    rail.scrollBy = vi.fn();
    fireEvent.click(screen.getByRole('button', { name: 'ฟีเจอร์ถัดไป' }));
    expect(rail.scrollBy).toHaveBeenCalledWith({ left: 224, behavior: 'smooth' });
    rail.scrollLeft = 300;
    fireEvent.scroll(rail);
    fireEvent.scroll(rail);
    expect(schedule).toHaveBeenCalledOnce();
    act(() => paint(16));
    expect(rail.parentElement?.style.getPropertyValue('--gallery-progress')).toBe('0.5');
    expect(screen.getByRole('button', { name: 'ฟีเจอร์ก่อนหน้า' })).toBeEnabled();
    fireEvent.scroll(rail);
    view.unmount();
    expect(cancel).toHaveBeenLastCalledWith(42);
    expect(disconnect).toHaveBeenCalledOnce();
  } finally {
    window.IntersectionObserver = original;
  }
});
