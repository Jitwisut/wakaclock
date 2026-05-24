import { render } from '@testing-library/react';
import { expect, it } from 'vitest';

import { Icon } from '@/components/icon';

it('returns null for an unknown icon name', () => {
  const { container } = render(<Icon name="ThisDoesNotExist" />);

  expect(container).toBeEmptyDOMElement();
});

it('treats icons as decorative by default', () => {
  const { container } = render(<Icon name="Activity" />);
  const svg = container.querySelector('svg');

  expect(svg).toHaveAttribute('aria-hidden', 'true');
});

it('does not set aria-hidden when an accessible label is provided', () => {
  const { container } = render(<Icon aria-label="Activity" name="Activity" />);
  const svg = container.querySelector('svg');

  expect(svg).not.toHaveAttribute('aria-hidden');
});

it('respects an explicit aria-hidden prop', () => {
  const { container } = render(<Icon aria-hidden="true" name="Activity" />);
  const svg = container.querySelector('svg');

  expect(svg).toHaveAttribute('aria-hidden', 'true');
});

it('does not force aria-hidden when aria-hidden is explicitly false', () => {
  const { container } = render(<Icon aria-hidden={false} name="Activity" />);
  const svg = container.querySelector('svg');

  expect(svg).not.toHaveAttribute('aria-hidden');
});
