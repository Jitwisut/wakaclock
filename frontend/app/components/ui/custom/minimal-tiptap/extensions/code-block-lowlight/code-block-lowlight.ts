import type { CodeBlockLowlightOptions } from '@tiptap/extension-code-block-lowlight';
import { CodeBlockLowlight as TiptapCodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

/**
 * Extended TipTap code block extension with syntax highlighting via lowlight.
 *
 * Provides code block functionality with automatic syntax highlighting for common
 * programming languages, tab indentation support, and configurable exit behaviors.
 * Uses the lowlight library with common language definitions for highlighting.
 *
 * @example
 * ```tsx
 * import { CodeBlockLowlight } from './code-block-lowlight';
 *
 * const editor = useEditor({
 *   extensions: [CodeBlockLowlight],
 * });
 * ```
 */
export const CodeBlockLowlight = TiptapCodeBlockLowlight.extend({
  addOptions(): CodeBlockLowlightOptions {
    return {
      ...this.parent?.(),
      lowlight: createLowlight(common),
      defaultLanguage: null,
      languageClassPrefix: 'language-',
      exitOnTripleEnter: true,
      exitOnArrowDown: true,
      exitOnArrowUp: true,
      enableTabIndentation: true,
      tabSize: 2,
      HTMLAttributes: {
        class: 'block-node',
      },
    };
  },
});

export default CodeBlockLowlight;
