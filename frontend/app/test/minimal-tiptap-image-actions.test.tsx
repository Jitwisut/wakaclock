import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { ImageActions } from '@/components/ui/custom/minimal-tiptap/extensions/image/components/image-actions';

it('renders action buttons for non-link images', () => {
  render(<ImageActions isLink={false} shouldMerge={false} />);

  expect(screen.getByRole('button', { name: 'View image' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download image' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy image to clipboard' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Copy image link' })).not.toBeInTheDocument();
});

it('includes copy link when isLink is true', () => {
  render(<ImageActions isLink shouldMerge={false} />);

  expect(screen.getByRole('button', { name: 'Copy image link' })).toBeInTheDocument();
});

it('supports overriding labels', () => {
  render(
    <ImageActions
      isLink
      shouldMerge={false}
      labels={{
        view: 'View',
        download: 'Download',
        copy: 'Copy',
        copyLink: 'Copy link',
        openMenu: 'Menu',
      }}
    />
  );

  expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
});
