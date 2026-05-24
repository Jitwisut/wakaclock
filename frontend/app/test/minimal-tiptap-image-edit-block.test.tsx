import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/react';
import { expect, it, vi } from 'vitest';

import { ImageEditBlock } from '@/components/ui/custom/minimal-tiptap/components/image/image-edit-block';

it('inserts an image from a URL and calls close', async () => {
  const user = userEvent.setup();
  const setImages = vi.fn();
  const close = vi.fn();

  const editor = {
    commands: {
      setImages,
    },
  } as unknown as Editor;

  render(<ImageEditBlock editor={editor} close={close} />);

  await user.type(screen.getByLabelText('Attach an image link'), 'https://example.com');
  await user.click(screen.getByRole('button', { name: 'Submit' }));

  expect(setImages).toHaveBeenCalledTimes(1);
  expect(setImages).toHaveBeenCalledWith([{ src: 'https://example.com' }]);
  expect(close).toHaveBeenCalledTimes(1);
});

it('inserts uploaded files and calls close', async () => {
  const user = userEvent.setup();
  const setImages = vi.fn();
  const close = vi.fn();

  const editor = {
    commands: {
      setImages,
    },
  } as unknown as Editor;

  render(<ImageEditBlock editor={editor} close={close} />);

  const file = new File(['test'], 'image.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText('Upload image files'), file);

  expect(setImages).toHaveBeenCalledTimes(1);
  expect(setImages).toHaveBeenCalledWith([{ src: file }]);
  expect(close).toHaveBeenCalledTimes(1);
});

it('supports overriding labels', () => {
  const setImages = vi.fn();
  const close = vi.fn();

  const editor = {
    commands: {
      setImages,
    },
  } as unknown as Editor;

  render(
    <ImageEditBlock
      editor={editor}
      close={close}
      labels={{
        attachLink: 'Link',
        placeholder: 'https://example.com',
        submit: 'Go',
        upload: 'Upload',
        fileInputAriaLabel: 'Upload input',
      }}
    />
  );

  expect(screen.getByText('Link')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
});
