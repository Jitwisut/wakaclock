import React from 'react';

import { type Editor, EditorContent } from '@tiptap/react';

import { useMinimalTiptapEditor } from '@/components/ui/custom/minimal-tiptap/hooks/use-minimal-tiptap';
import { Toaster } from '@/components/ui/sonner';

import '@/components/ui/custom/minimal-tiptap/styles/index.css';

export function MinimalTiptapStoryHarness({
  children,
  content = '<p>Type here…</p>',
  onReady,
  showEditor = true,
  toolbar,
}: {
  children?: (editor: Editor) => React.ReactNode;
  content?: string;
  onReady?: (editor: Editor) => void;
  showEditor?: boolean;
  toolbar?: (editor: Editor) => React.ReactNode;
}) {
  const editor = useMinimalTiptapEditor({
    content,
    output: 'html',
    throttleDelay: 0,
    placeholder: 'Type here…',
  });

  React.useEffect(() => {
    if (!editor) return;
    onReady?.(editor);
  }, [editor, onReady]);

  if (!editor) return null;

  return (
    <div className="w-full max-w-4xl space-y-4">
      <Toaster position="bottom-right" richColors />
      {toolbar ? (
        <div className="bg-muted flex flex-wrap items-center gap-1 rounded-md border p-2">
          {toolbar(editor)}
        </div>
      ) : null}
      {children ? children(editor) : null}
      {showEditor ? (
        <EditorContent className="minimal-tiptap-editor rounded-md border p-4" editor={editor} />
      ) : null}
    </div>
  );
}
