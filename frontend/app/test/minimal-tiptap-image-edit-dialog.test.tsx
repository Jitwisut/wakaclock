import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/react';
import { expect, it, vi } from 'vitest';

import { ImageEditDialog } from '@/components/ui/custom/minimal-tiptap/components/image/image-edit-dialog';

it('opens the dialog and renders the image edit block', async () => {
  const user = userEvent.setup();
  const editor = {
    isEditable: true,
    isActive: () => false,
    commands: {
      setImages: vi.fn(),
    },
  } as unknown as Editor;

  render(<ImageEditDialog editor={editor} />);

  await user.click(screen.getByRole('button', { name: 'Image' }));

  expect(screen.getByText('Select image')).toBeInTheDocument();
  expect(screen.getByLabelText('Attach an image link')).toBeInTheDocument();
});

it('supports overriding labels (including nested ImageEditBlock labels)', async () => {
  const user = userEvent.setup();
  const editor = {
    isEditable: true,
    isActive: () => false,
    commands: {
      setImages: vi.fn(),
    },
  } as unknown as Editor;

  render(
    <ImageEditDialog
      editor={editor}
      labels={{
        trigger: '画像',
        dialogTitle: '画像を選択',
        dialogDescription: '説明',
        editBlock: {
          attachLink: 'リンク',
          placeholder: 'https://example.com',
          submit: '送信',
          upload: 'アップロード',
          fileInputAriaLabel: 'ファイル入力',
        },
      }}
    />
  );

  await user.click(screen.getByRole('button', { name: '画像' }));

  expect(screen.getByText('画像を選択')).toBeInTheDocument();
  expect(screen.getByLabelText('リンク')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument();
});

it('disables the trigger button when the editor is not editable', () => {
  const editor = {
    isEditable: false,
    isActive: () => false,
  } as unknown as Editor;

  render(<ImageEditDialog editor={editor} />);

  expect(screen.getByRole('button', { name: 'Image' })).toBeDisabled();
});

it('disables the trigger button when the selection is in a code block', () => {
  const editor = {
    isEditable: true,
    isActive: (name: string) => name === 'codeBlock',
  } as unknown as Editor;

  render(<ImageEditDialog editor={editor} />);

  expect(screen.getByRole('button', { name: 'Image' })).toBeDisabled();
});
