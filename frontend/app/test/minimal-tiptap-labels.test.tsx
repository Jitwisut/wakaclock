import { render, screen } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { expect, it, vi } from 'vitest';

import { SectionFour } from '@/components/ui/custom/minimal-tiptap/components/section/four';
import { SectionTwo } from '@/components/ui/custom/minimal-tiptap/components/section/two';
import { LinkEditBlock } from '@/components/ui/custom/minimal-tiptap/components/link/link-edit-block';
import { LinkPopoverBlock } from '@/components/ui/custom/minimal-tiptap/components/link/link-popover-block';

const createEditorStub = (): Editor => {
  const chainApi = {
    focus: () => chainApi,
    toggleBold: () => chainApi,
    toggleItalic: () => chainApi,
    toggleUnderline: () => chainApi,
    toggleStrike: () => chainApi,
    toggleCode: () => chainApi,
    unsetAllMarks: () => chainApi,
    toggleOrderedList: () => chainApi,
    toggleBulletList: () => chainApi,
    run: () => true,
  };

  return {
    chain: () => chainApi,
    can: () => ({
      chain: () => chainApi,
    }),
    isActive: () => false,
  } as unknown as Editor;
};

it('supports overriding toolbar labels', () => {
  const editor = createEditorStub();

  render(
    <div>
      <SectionTwo
        editor={editor}
        mainActionCount={1}
        labels={{ bold: '太字', moreFormatting: 'その他' }}
      />
      <SectionFour
        editor={editor}
        mainActionCount={2}
        labels={{ orderedList: '番号付きリスト', lists: 'リスト' }}
      />
    </div>
  );

  expect(screen.getByLabelText('太字')).toBeInTheDocument();
  expect(screen.getByLabelText('番号付きリスト')).toBeInTheDocument();
});

it('supports overriding link editor labels', () => {
  const onSave = vi.fn();

  render(
    <LinkEditBlock
      onSave={onSave}
      labels={{
        urlLabel: 'リンク',
        urlPlaceholder: 'https://example.com',
        save: '保存',
      }}
    />
  );

  expect(screen.getByLabelText('リンク')).toHaveAttribute('placeholder', 'https://example.com');
  expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
});

it('adds accessible labels for link popover actions', () => {
  render(
    <LinkPopoverBlock
      url="https://example.com"
      onClear={vi.fn()}
      onEdit={vi.fn()}
      labels={{
        editLink: 'リンク編集',
        openLink: '新しいタブで開く',
        clearLink: 'リンク解除',
        copy: 'コピー',
        copied: 'コピーしました',
      }}
    />
  );

  expect(screen.getByRole('button', { name: 'リンク編集' })).toBeInTheDocument();
  expect(screen.getByLabelText('新しいタブで開く')).toBeInTheDocument();
  expect(screen.getByLabelText('リンク解除')).toBeInTheDocument();
  expect(screen.getByLabelText('コピー')).toBeInTheDocument();
});
