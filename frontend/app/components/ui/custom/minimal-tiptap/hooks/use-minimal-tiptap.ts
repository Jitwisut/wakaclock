import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { Content, UseEditorOptions } from '@tiptap/react';
import type { MinimalTiptapOutput } from '../types';
import { StarterKit } from '@tiptap/starter-kit';
import { useEditor } from '@tiptap/react';
import { Typography } from '@tiptap/extension-typography';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import {
  Link,
  Image,
  HorizontalRule,
  CodeBlockLowlight,
  Selection,
  Color,
  UnsetAllMarks,
  ResetMarksOnEnter,
  FileHandler,
} from '../extensions';
import { cn } from '@/lib/utils';
import { fileToBase64, getOutput, randomId } from '../utils';
import { useThrottle } from '../hooks/use-throttle';
import { toast } from 'sonner';

/**
 * Configuration options for the useMinimalTiptapEditor hook.
 * Extends TipTap's UseEditorOptions with additional minimal-tiptap specific settings.
 */
export interface UseMinimalTiptapEditorProps extends UseEditorOptions {
  /** Initial content value for the editor */
  value?: Content;
  /** Output format for content extraction (html, json, or text) */
  output?: MinimalTiptapOutput;
  /** Placeholder text shown when editor is empty */
  placeholder?: string;
  /** Additional CSS classes for the editor element */
  editorClassName?: string;
  /** Delay in milliseconds for throttling update callbacks */
  throttleDelay?: number;
  /** Callback fired when editor content changes (throttled) */
  onUpdate?: (content: Content) => void;
  /** Callback fired when editor loses focus */
  onBlur?: (content: Content) => void;
}

const createExtensions = (placeholder: string) => [
  StarterKit.configure({
    horizontalRule: false,
    codeBlock: false,
    paragraph: { HTMLAttributes: { class: 'text-node' } },
    heading: { HTMLAttributes: { class: 'heading-node' } },
    blockquote: { HTMLAttributes: { class: 'block-node' } },
    bulletList: { HTMLAttributes: { class: 'list-node' } },
    orderedList: { HTMLAttributes: { class: 'list-node' } },
    code: { HTMLAttributes: { class: 'inline', spellcheck: 'false' } },
    dropcursor: { width: 2, class: 'ProseMirror-dropcursor border' },
  }),
  Link,
  Underline,
  Image.configure({
    allowedMimeTypes: ['image/*'],
    maxFileSize: 5 * 1024 * 1024,
    allowBase64: true,
    uploadFn: async (file) => {
      // NOTE: This is a fake upload function. Replace this with your own upload logic.
      // This function should return the uploaded image URL.

      // wait 3s to simulate upload
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const src = await fileToBase64(file);

      // either return { id: string | number, src: string } or just src
      // return src;
      return { id: randomId(), src };
    },
    onToggle(editor, files, pos) {
      editor.commands.insertContentAt(
        pos,
        files.map((image) => {
          const blobUrl = URL.createObjectURL(image);
          const id = randomId();

          return {
            type: 'image',
            attrs: {
              id,
              src: blobUrl,
              alt: image.name,
              title: image.name,
              fileName: image.name,
            },
          };
        })
      );
    },
    onImageRemoved() {
      // Image removed callback
    },
    onValidationError(errors) {
      errors.forEach((error) => {
        toast.error('Image validation error', {
          position: 'bottom-right',
          description: error.reason,
        });
      });
    },
    onActionSuccess({ action }) {
      const mapping = {
        copyImage: 'Copy Image',
        copyLink: 'Copy Link',
        download: 'Download',
      };
      toast.success(mapping[action], {
        position: 'bottom-right',
        description: 'Image action success',
      });
    },
    onActionError(error, { action }) {
      const mapping = {
        copyImage: 'Copy Image',
        copyLink: 'Copy Link',
        download: 'Download',
      };
      toast.error(`Failed to ${mapping[action]}`, {
        position: 'bottom-right',
        description: error.message,
      });
    },
  }),
  FileHandler.configure({
    allowBase64: true,
    allowedMimeTypes: ['image/*'],
    maxFileSize: 5 * 1024 * 1024,
    onDrop: (editor, files, pos) => {
      files.forEach(async (file) => {
        const src = await fileToBase64(file);
        editor.commands.insertContentAt(pos, {
          type: 'image',
          attrs: { src },
        });
      });
    },
    onPaste: (editor, files) => {
      files.forEach(async (file) => {
        const src = await fileToBase64(file);
        editor.commands.insertContent({
          type: 'image',
          attrs: { src },
        });
      });
    },
    onValidationError: (errors) => {
      errors.forEach((error) => {
        toast.error('Image validation error', {
          position: 'bottom-right',
          description: error.reason,
        });
      });
    },
  }),
  Color,
  TextStyle,
  Selection,
  Typography,
  UnsetAllMarks,
  HorizontalRule,
  ResetMarksOnEnter,
  CodeBlockLowlight,
  Placeholder.configure({ placeholder: () => placeholder }),
];

/**
 * Creates a configured TipTap editor instance with minimal-tiptap extensions.
 *
 * Provides a full-featured rich text editor with support for:
 * - Text formatting (bold, italic, underline, strikethrough)
 * - Headings, blockquotes, and lists
 * - Links and images with upload support
 * - Code blocks with syntax highlighting
 * - Horizontal rules and typography enhancements
 *
 * The editor automatically handles content updates with optional throttling
 * and supports multiple output formats (HTML, JSON, or plain text).
 *
 * @param props - Configuration options for the editor
 * @returns A configured TipTap Editor instance, or null if not yet initialized
 *
 * @example
 * ```tsx
 * const editor = useMinimalTiptapEditor({
 *   value: '<p>Initial content</p>',
 *   output: 'html',
 *   placeholder: 'Start typing...',
 *   throttleDelay: 300,
 *   onUpdate: (content) => saveContent(content),
 * });
 *
 * return <EditorContent editor={editor} />;
 * ```
 */
export const useMinimalTiptapEditor = ({
  value,
  output = 'html',
  placeholder = '',
  editorClassName,
  throttleDelay = 0,
  onUpdate,
  onBlur,
  ...props
}: UseMinimalTiptapEditorProps) => {
  const throttledSetValue = useThrottle((value: Content) => onUpdate?.(value), throttleDelay);

  const handleUpdate = React.useCallback(
    (editor: Editor) => throttledSetValue(getOutput(editor, output)),
    [output, throttledSetValue]
  );

  const handleCreate = React.useCallback(
    (editor: Editor) => {
      if (value && editor.isEmpty) {
        editor.commands.setContent(value);
      }
    },
    [value]
  );

  const handleBlur = React.useCallback(
    (editor: Editor) => onBlur?.(getOutput(editor, output)),
    [output, onBlur]
  );

  const editor = useEditor({
    extensions: createExtensions(placeholder),
    editorProps: {
      attributes: {
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        class: cn('focus:outline-hidden', editorClassName),
      },
    },
    onUpdate: ({ editor }) => handleUpdate(editor),
    onCreate: ({ editor }) => handleCreate(editor),
    onBlur: ({ editor }) => handleBlur(editor),
    ...props,
  });

  return editor;
};

export default useMinimalTiptapEditor;
