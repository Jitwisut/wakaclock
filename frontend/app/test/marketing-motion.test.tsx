import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { MarketingMotion } from '@/components/marketing/marketing-motion';

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const originalObserver = window.IntersectionObserver;

it('pins only a hero that fits the viewport and releases it when the viewport no longer fits', () => {
  vi.stubGlobal('CSS', { supports: () => true });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query.includes('min-width: 1024px'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
  let height = 400;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    return { height: this.classList.contains('axis-hero-stage') ? height : 82, top: 0 } as DOMRect;
  });
  const { unmount } = render(
    <div className="wakaclock-marketing">
      <header className="axis-nav" />
      <MarketingMotion />
      <section className="axis-hero" data-testid="hero">
        <div className="axis-hero-stage">Hero content and CTA</div>
      </section>
    </div>
  );
  const hero = screen.getByTestId('hero');
  expect(hero).toHaveAttribute('data-pinned', 'true');
  height = 2000;
  fireEvent.resize(window);
  expect(hero).toHaveAttribute('data-pinned', 'false');
  expect(screen.getByText('Hero content and CTA')).toBeVisible();
  unmount();
  expect(hero).not.toHaveAttribute('data-pinned');
});

afterEach(() => {
  route.pathname = '/';
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

it('never pins the hero on mobile even when it fits in the visible viewport', () => {
  vi.stubGlobal('CSS', { supports: () => true });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query.includes('max-width: 1023px'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    height: 400,
    top: 0,
  } as DOMRect);
  render(
    <div className="wakaclock-marketing">
      <header className="axis-nav" />
      <MarketingMotion />
      <section className="axis-hero" data-testid="hero">
        <div className="axis-hero-stage">Stable mobile hero</div>
      </section>
    </div>
  );

  expect(screen.getByTestId('hero')).toHaveAttribute('data-pinned', 'false');
  expect(screen.getByText('Stable mobile hero')).toBeVisible();
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
  expect(section.animate).toHaveBeenCalledWith(
    expect.any(Array),
    expect.objectContaining({ fill: 'backwards' })
  );
  expect(unobserve).toHaveBeenCalledWith(section);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
});

it.each([false, true])(
  'reveals headings and artwork with responsive motion and stops on preference changes (compact=%s)',
  (compact) => {
    let enter!: (entries: { isIntersecting: boolean; target: Element }[]) => void;
    const observe = vi.fn();
    const disconnect = vi.fn();
    window.IntersectionObserver = class {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      constructor(callback: typeof enter) {
        enter = callback;
      }
    } as unknown as typeof IntersectionObserver;
    let change!: () => void;
    const preference = {
      matches: false,
      addEventListener: (_event: string, listener: () => void) => {
        change = listener;
      },
      removeEventListener: vi.fn(),
    };
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        (query.includes('reduced')
          ? preference
          : {
              matches: compact,
              addEventListener: vi.fn(),
              removeEventListener: vi.fn(),
            }) as unknown as MediaQueryList
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 2000,
    } as DOMRect);
    const cancel = vi.fn();
    const animations: { cancel: typeof cancel; onfinish?: () => void }[] = [];
    const animate = vi.fn(() => {
      const animation = { cancel };
      animations.push(animation);
      return animation;
    });
    vi.stubGlobal('CSS', { supports: () => false });
    const view = render(
      <div className="wakaclock-marketing" data-testid="root">
        <MarketingMotion />
        <main>
          <div className="axis-section-heading">
            <h2>Title</h2>
            <p>Intro</p>
            <figure className="mkt-reveal">Art</figure>
          </div>
          <section className="mkt-reveal">
            <h3>Nested</h3>
          </section>
          <div data-motion-owner="experience">
            <h2>Self animated</h2>
          </div>
          <div className="mkt-reveal axis-setup-step">Setup</div>
        </main>
      </div>
    );
    const heading = screen.getByText('Title');
    const picture = screen.getByText('Art');
    heading.animate = animate as unknown as typeof heading.animate;
    picture.animate = animate as unknown as typeof picture.animate;
    expect(observe).toHaveBeenCalledWith(heading);
    expect(observe).not.toHaveBeenCalledWith(screen.getByText('Self animated'));
    expect(observe).not.toHaveBeenCalledWith(screen.getByText('Setup'));
    enter([{ isIntersecting: false, target: heading }]);
    expect(animate).not.toHaveBeenCalled();
    enter([
      { isIntersecting: true, target: heading },
      { isIntersecting: true, target: picture },
      { isIntersecting: true, target: screen.getByText('Intro') },
    ]);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[0]).toEqual([
      expect.arrayContaining([
        expect.objectContaining({ transform: compact ? 'translateY(10px)' : 'translateY(24px)' }),
      ]),
      expect.objectContaining({ duration: compact ? 420 : 1100, delay: 0 }),
    ]);
    expect(animate.mock.calls[1]).toEqual([
      expect.any(Array),
      expect.objectContaining({ delay: compact ? 90 : 160 }),
    ]);
    animations[0].onfinish?.();
    preference.matches = true;
    act(() => change());
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('root')).not.toHaveAttribute('data-motion-ready');
    view.unmount();
  }
);
it('fades route content only on navigation and removes a finished transition from cleanup', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  const view = render(
    <div className="wakaclock-marketing">
      <MarketingMotion />
      <main>Page content</main>
    </div>
  );
  const main = screen.getByRole('main');
  const transition = { cancel: vi.fn(), onfinish: undefined as (() => void) | undefined };
  main.animate = vi.fn().mockReturnValue(transition);
  route.pathname = '/features';
  view.rerender(
    <div className="wakaclock-marketing">
      <MarketingMotion />
      <main>Page content</main>
    </div>
  );
  expect(main.animate).toHaveBeenCalledWith([{ opacity: 0.65 }, { opacity: 1 }], {
    duration: 240,
    easing: 'ease-out',
  });
  transition.onfinish?.();
  view.unmount();
  expect(transition.cancel).not.toHaveBeenCalled();
});
it('keeps readable content when observers or the marketing container are unavailable', () => {
  window.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;
  const view = render(
    <div className="wakaclock-marketing" data-testid="root">
      <MarketingMotion />
      <main>Readable</main>
    </div>
  );
  expect(screen.getByText('Readable')).toBeVisible();
  expect(screen.getByTestId('root')).not.toHaveAttribute('data-motion-ready');
  view.rerender(
    <>
      <MarketingMotion />
      <main>Standalone content</main>
    </>
  );
  expect(screen.getByText('Standalone content')).toBeVisible();
});
