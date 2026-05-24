import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { ImageOverlay } from '@/components/ui/custom/minimal-tiptap/extensions/image/components/image-overlay';

it('renders an accessible uploading status', () => {
  render(<ImageOverlay />);

  expect(screen.getByRole('status', { name: 'Uploading image' })).toBeInTheDocument();
});

it('supports overriding the uploading label', () => {
  render(<ImageOverlay labels={{ uploading: '画像をアップロード中' }} />);

  expect(screen.getByRole('status', { name: '画像をアップロード中' })).toBeInTheDocument();
});
