import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { MarketingScrollIndex } from '@/components/marketing/marketing-scroll-index';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
afterEach(() => vi.restoreAllMocks());

it('excludes sections with missing or blank headings from the reading index', () => {
  render(
    <div className="wakaclock-marketing">
      <main>
        <section id="unlabeled">Decorative content</section>
        <section id="blank">
          <h2> </h2>
        </section>
        <section id="first">
          <h2>First chapter</h2>
        </section>
        <section id="second">
          <h2>Second chapter</h2>
        </section>
      </main>
      <MarketingScrollIndex locale="en" />
    </div>
  );
  fireEvent.click(screen.getByText('Index'));
  expect(screen.getAllByRole('link')).toHaveLength(2);
  expect(screen.queryByRole('link', { name: 'Decorative content' })).toBeNull();
  expect(screen.getByRole('link', { name: /Second chapter/ })).toHaveAttribute('href', '#second');
});

it('uses real headings, follows scroll position, and closes after a jump', () => {
  let secondTop = 900;
  let paint: FrameRequestCallback = () => {};
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    paint = callback;
    return 1;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    return { top: this.id === 'second' ? secondTop : 100 } as DOMRect;
  });
  render(
    <div className="wakaclock-marketing">
      <main>
        <section id="first">
          <h2>First chapter</h2>
        </section>
        <section id="second">
          <h2>Second chapter</h2>
        </section>
      </main>
      <MarketingScrollIndex locale="en" />
    </div>
  );
  fireEvent.click(screen.getByText('Index'));
  expect(screen.getByRole('link', { name: /First chapter/ })).toHaveAttribute(
    'aria-current',
    'location'
  );
  secondTop = 120;
  fireEvent.scroll(window);
  act(() => paint(16));
  const second = screen.getByRole('link', { name: /Second chapter/ });
  expect(second).toHaveAttribute('aria-current', 'location');
  expect(second).toHaveAttribute('href', '#second');
  fireEvent.click(second);
  expect(second.closest('details')).not.toHaveAttribute('open');
});

it('does not show a floating index when the page has fewer than two chapters', () => {
  render(
    <div className="wakaclock-marketing">
      <main>
        <section id="only">
          <h2>Only chapter</h2>
        </section>
      </main>
      <MarketingScrollIndex locale="th" />
    </div>
  );
  expect(screen.getByText('สารบัญ')).not.toBeVisible();
});

it('closes a focused index with Escape and clamps reading progress while coalescing scroll updates', () => {
  let paint!: FrameRequestCallback;
  const schedule = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    paint = callback;
    return 1;
  });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame');
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);
  vi.stubGlobal('innerHeight', 1000);
  vi.stubGlobal('scrollY', 3000);
  const view = render(
    <div className="wakaclock-marketing">
      <main>
        <section id="one">
          <h2>One</h2>
        </section>
        <section id="two">
          <h2>Two</h2>
        </section>
        <section id="skip">No heading</section>
      </main>
      <MarketingScrollIndex locale="en" />
    </div>
  );
  const panel = view.container.querySelector('details')!;
  const marker = view.container.querySelector('.axis-scroll-index') as HTMLElement;
  expect(marker.style.getPropertyValue('--reading-progress')).toBe('1');
  fireEvent.click(screen.getByText('Index'));
  screen.getByRole('link', { name: /One/ }).focus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(panel.open).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(panel.open).toBe(false);
  expect(panel.querySelector('summary')).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.scroll(window);
  fireEvent.resize(window);
  expect(schedule).toHaveBeenCalledTimes(1);
  act(() => paint(16));
  view.unmount();
  expect(cancel).toHaveBeenCalled();
  vi.unstubAllGlobals();
});
it('remains hidden outside a marketing container', () => {
  render(<MarketingScrollIndex locale="en" />);
  expect(screen.getByText('Index')).not.toBeVisible();
});
