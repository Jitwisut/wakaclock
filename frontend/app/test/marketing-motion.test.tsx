import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { MarketingMotion } from '@/components/marketing/marketing-motion';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const originalObserver = window.IntersectionObserver;

afterEach(() => {
  window.IntersectionObserver = originalObserver;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps content readable and disables enhancement when reduced motion is requested', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  render(
    <div className="wakaclock-marketing" data-testid="marketing">
      <MarketingMotion />
      <section className="mkt-reveal">Readable content</section>
    </div>
  );
  expect(screen.getByText('Readable content')).toBeVisible();
  expect(screen.getByTestId('marketing')).not.toHaveAttribute('data-motion-ready');
});

it('observes below-fold content and releases observers and active animations on unmount', () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  const unobserve = vi.fn();
  let enter: (entries: { isIntersecting: boolean; target: Element }[]) => void = () => {};
  window.IntersectionObserver = class {
    observe = observe;
    disconnect = disconnect;
    unobserve = unobserve;
    constructor(callback: typeof enter) {
      enter = callback;
    }
  } as unknown as typeof IntersectionObserver;
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 2000,
  } as DOMRect);
  const cancel = vi.fn();
  const { unmount } = render(
    <div className="wakaclock-marketing">
      <MarketingMotion />
      <section className="mkt-reveal">Below the fold</section>
    </div>
  );
  const section = screen.getByText('Below the fold');
  section.animate = vi.fn().mockReturnValue({ cancel });
  expect(observe).toHaveBeenCalledWith(section);
  enter([{ isIntersecting: true, target: section }]);
  expect(section.animate).toHaveBeenCalledOnce();
  expect(unobserve).toHaveBeenCalledWith(section);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
});
