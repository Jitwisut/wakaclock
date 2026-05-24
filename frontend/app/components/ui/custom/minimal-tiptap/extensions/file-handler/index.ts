import { type Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { FileError, FileValidationOptions } from '../../utils';
import { filterFiles } from '../../utils';

/**
 * Internal plugin options for file handling functionality.
 *
 * @internal
 */
type FileHandlePluginOptions = {
  key?: PluginKey;
  editor: Editor;
  onPaste?: (editor: Editor, files: File[], pasteContent?: string) => void;
  onDrop?: (editor: Editor, files: File[], pos: number) => void;
  onValidationError?: (errors: FileError[]) => void;
} & FileValidationOptions;

/**
 * Creates a ProseMirror plugin for handling file drag-and-drop and paste operations.
 *
 * Validates files against MIME type and size constraints before invoking callbacks.
 *
 * @param options - Configuration options for the file handler plugin
 * @returns A ProseMirror Plugin instance
 * @internal
 */
const FileHandlePlugin = (options: FileHandlePluginOptions) => {
  const { key, editor, onPaste, onDrop, onValidationError, allowedMimeTypes, maxFileSize } =
    options;

  return new Plugin({
    key: key || new PluginKey('fileHandler'),

    props: {
      handleDrop(view, event) {
        event.preventDefault();
        event.stopPropagation();

        const { dataTransfer } = event;

        if (!dataTransfer?.files.length) {
          return;
        }

        const pos = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        const [validFiles, errors] = filterFiles(Array.from(dataTransfer.files), {
          allowedMimeTypes,
          maxFileSize,
          allowBase64: options.allowBase64,
        });

        if (errors.length > 0 && onValidationError) {
          onValidationError(errors);
        }

        if (validFiles.length > 0 && onDrop) {
          onDrop(editor, validFiles, pos?.pos ?? 0);
        }
      },

      handlePaste(_, event) {
        event.preventDefault();
        event.stopPropagation();

        const { clipboardData } = event;

        if (!clipboardData?.files.length) {
          return;
        }

        const [validFiles, errors] = filterFiles(Array.from(clipboardData.files), {
          allowedMimeTypes,
          maxFileSize,
          allowBase64: options.allowBase64,
        });
        const html = clipboardData.getData('text/html');

        if (errors.length > 0 && onValidationError) {
          onValidationError(errors);
        }

        if (validFiles.length > 0 && onPaste) {
          onPaste(editor, validFiles, html);
        }
      },
    },
  });
};

/**
 * Configuration options for the FileHandler extension.
 * Excludes internal options like key and editor that are managed automatically.
 */
export type FileHandlerOptions = Omit<FileHandlePluginOptions, 'key' | 'editor'>;

/**
 * TipTap extension for handling file uploads via drag-and-drop and paste.
 *
 * Provides file validation, MIME type filtering, and size constraints for
 * files dropped onto or pasted into the editor. Supports custom callbacks
 * for handling valid files and validation errors.
 *
 * @example
 * ```tsx
 * import { FileHandler } from './file-handler';
 *
 * const editor = useEditor({
 *   extensions: [
 *     FileHandler.configure({
 *       allowedMimeTypes: ['image/*'],
 *       maxFileSize: 5 * 1024 * 1024, // 5MB
 *       onPaste: (editor, files) => handleUpload(files),
 *       onDrop: (editor, files, pos) => handleUpload(files),
 *     }),
 *   ],
 * });
 * ```
 */
export const FileHandler = Extension.create<FileHandlerOptions>({
  name: 'fileHandler',

  addOptions() {
    return {
      allowBase64: false,
      allowedMimeTypes: [],
      maxFileSize: 0,
    };
  },

  addProseMirrorPlugins() {
    return [
      FileHandlePlugin({
        key: new PluginKey(this.name),
        editor: this.editor,
        ...this.options,
      }),
    ];
  },
});

export default FileHandler;
