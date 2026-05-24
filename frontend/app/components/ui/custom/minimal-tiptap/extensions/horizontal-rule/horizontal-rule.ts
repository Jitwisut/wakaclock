import { HorizontalRule as TiptapHorizontalRule } from '@tiptap/extension-horizontal-rule';

/**
 * Extended TipTap horizontal rule extension with keyboard shortcut support.
 *
 * Provides a horizontal rule (<hr>) element with an additional keyboard shortcut
 * (Mod-Alt--) to quickly insert a divider line in the document.
 *
 * @example
 * ```tsx
 * import { HorizontalRule } from './horizontal-rule';
 *
 * const editor = useEditor({
 *   extensions: [HorizontalRule],
 * });
 * // User can press Cmd/Ctrl+Alt+- to insert a horizontal rule
 * ```
 */
export const HorizontalRule = TiptapHorizontalRule.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-Alt--': () =>
        this.editor.commands.insertContent({
          type: this.name,
        }),
    };
  },
});

export default HorizontalRule;
