import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { MarketingScrollIndex } from '@/components/marketing/marketing-scroll-index';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
afterEach(() => vi.restoreAllMocks());

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
