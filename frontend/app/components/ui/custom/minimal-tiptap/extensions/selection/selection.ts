import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * TipTap extension that maintains visible selection highlighting when editor loses focus.
 *
 * Applies a 'selection' CSS class decoration to selected text when the editor
 * is not focused, allowing the selection to remain visually highlighted. This is
 * useful for toolbar interactions and other UI elements that require clicking
 * outside the editor while maintaining selection context.
 *
 * @example
 * ```tsx
 * import { Selection } from './selection';
 *
 * const editor = useEditor({
 *   extensions: [Selection],
 * });
 * // Selected text remains highlighted when clicking toolbar buttons
 * ```
 */
export const Selection = Extension.create({
  name: 'selection',

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: new PluginKey('selection'),
        props: {
          decorations(state) {
            if (state.selection.empty) {
              return null;
            }

            if (editor.isFocused === true) {
              return null;
            }

            if (!editor.isEditable) {
              return null;
            }

            return DecorationSet.create(state.doc, [
              Decoration.inline(state.selection.from, state.selection.to, {
                class: 'selection',
              }),
            ]);
          },
        },
      }),
    ];
  },
});

export default Selection;
