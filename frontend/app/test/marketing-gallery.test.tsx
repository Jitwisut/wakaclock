import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { FeatureGallery } from '@/components/marketing/feature-gallery';

afterEach(() => vi.restoreAllMocks());

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
