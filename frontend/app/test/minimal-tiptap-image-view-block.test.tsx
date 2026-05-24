import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Editor } from '@tiptap/react';
import { expect, it, vi } from 'vitest';

import { ImageViewBlock } from '@/components/ui/custom/minimal-tiptap/extensions/image/components/image-view-block';

const createEditor = (): Editor =>
  ({
    isEditable: true,
    options: {
      extensions: [],
    },
    commands: {
      downloadImage: vi.fn(),
      copyImage: vi.fn(),
      copyLink: vi.fn(),
      command: vi.fn(),
    },
  }) as unknown as Editor;

const createNode = () =>
  ({
    attrs: {
      id: 'sb-image',
      src: '/images/extra/image1.jpg',
      width: 520,
      height: 320,
      fileName: 'image1.jpg',
      alt: 'Demo image',
      title: 'Demo image',
    },
  }) as unknown;

it('renders error UI with default labels after image error', async () => {
  const props = {
    editor: createEditor(),
    node: createNode(),
    selected: true,
    updateAttributes: vi.fn(),
  } as unknown as ComponentProps<typeof ImageViewBlock>;

  render(<ImageViewBlock {...props} />);

  fireEvent.error(screen.getByRole('img', { name: 'Demo image' }));

  expect(screen.getByText('Failed to load image')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove image' })).toBeInTheDocument();
});

it('supports overriding error and remove labels', () => {
  const props = {
    editor: createEditor(),
    node: createNode(),
    selected: true,
    updateAttributes: vi.fn(),
    labels: {
      failedToLoad: '画像を読み込めませんでした',
      removeImage: '画像を削除',
    },
  } as unknown as ComponentProps<typeof ImageViewBlock>;

  render(<ImageViewBlock {...props} />);

  fireEvent.error(screen.getByRole('img', { name: 'Demo image' }));

  expect(screen.getByText('画像を読み込めませんでした')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '画像を削除' })).toBeInTheDocument();
});

it('passes action label overrides through to ImageActions', async () => {
  const props = {
    editor: createEditor(),
    node: createNode(),
    selected: true,
    updateAttributes: vi.fn(),
    labels: {
      actions: {
        view: 'View',
        download: 'Download',
        copy: 'Copy',
      },
    },
  } as unknown as ComponentProps<typeof ImageViewBlock>;

  render(<ImageViewBlock {...props} />);

  const img = screen.getByRole('img', { name: 'Demo image' }) as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 520 });
  Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 320 });
  img.width = 520;
  img.height = 320;
  await act(async () => {
    fireEvent.load(img);
  });

  expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
});
