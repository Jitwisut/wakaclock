import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { CountAnimation } from '@/components/ui/custom/count-animation';

it('renders the final value when duration is 0', () => {
  render(<CountAnimation duration={0} value={1280} />);

  expect(screen.getByText('1280')).toBeInTheDocument();
});

it('updates the rendered value when duration is 0', () => {
  const { rerender } = render(<CountAnimation duration={0} value={10} />);

  expect(screen.getByText('10')).toBeInTheDocument();

  rerender(<CountAnimation duration={0} value={42} />);

  expect(screen.getByText('42')).toBeInTheDocument();
});

it('renders the `from` value initially when animating', () => {
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = vi.fn(() => 0);

  try {
    render(<CountAnimation duration={2} from={5} value={10} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  } finally {
    window.requestAnimationFrame = raf;
  }
});
