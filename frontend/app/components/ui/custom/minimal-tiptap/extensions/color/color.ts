import { Color as TiptapColor } from '@tiptap/extension-color';
import type { ColorOptions } from '@tiptap/extension-color';
import { Plugin } from '@tiptap/pm/state';

/**
 * Configuration options for the Color extension.
 * Re-exported from @tiptap/extension-color for convenience.
 */
export type { ColorOptions };

/**
 * Extended TipTap color extension with automatic color reset on Enter key.
 *
 * Provides text coloring functionality with an additional behavior that
 * automatically unsets the color when the user presses Enter, preventing
 * color styles from bleeding into new lines.
 *
 * @example
 * ```tsx
 * import { Color } from './color';
 *
 * const editor = useEditor({
 *   extensions: [Color],
 * });
 * ```
 */
export const Color = TiptapColor.extend({
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        props: {
          handleKeyDown: (_, event) => {
            if (event.key === 'Enter') {
              this.editor.commands.unsetColor();
            }
            return false;
          },
        },
      }),
    ];
  },
});

export default Color;
