import { mergeAttributes } from '@tiptap/core';
import type { LinkOptions } from '@tiptap/extension-link';
import TiptapLink from '@tiptap/extension-link';
import type { EditorView } from '@tiptap/pm/view';
import { getMarkRange } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';

/**
 * Configuration options for the Link extension.
 * Re-exported from @tiptap/extension-link for convenience.
 */
export type { LinkOptions };

/**
 * Extended TipTap link extension with enhanced click and keyboard behaviors.
 *
 * Provides hyperlink functionality with customizations:
 * - Non-inclusive behavior (typing next to link doesn't extend it)
 * - Secure HTML parsing (excludes javascript: URLs and button-type links)
 * - Click-to-select entire link text
 * - Escape key to exit link selection
 * - Auto-linking and paste-to-link support
 *
 * @example
 * ```tsx
 * import { Link } from './link';
 *
 * const editor = useEditor({
 *   extensions: [
 *     Link.configure({
 *       openOnClick: false,
 *       autolink: true,
 *     }),
 *   ],
 * });
 * ```
 */
export const Link = TiptapLink.extend({
  /*
   * Determines whether typing next to a link automatically becomes part of the link.
   * In this case, we don't want any characters to be included as part of the link.
   */
  inclusive: false,

  /*
   * Match all <a> elements that have an href attribute, except for:
   * - <a> elements with a data-type attribute set to button
   * - <a> elements with an href attribute that contains 'javascript:'
   */
  parseHTML() {
    return [{ tag: 'a[href]:not([data-type="button"]):not([href *= "javascript:" i])' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addOptions(): LinkOptions {
    return {
      ...this.parent?.(),
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      protocols: [],
      defaultProtocol: 'https',
      enableClickSelection: false,
      validate: () => true,
      isAllowedUri: () => true,
      shouldAutoLink: () => true,
      HTMLAttributes: {
        class: 'link',
      },
    };
  },

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      ...(this.parent?.() || []),
      new Plugin({
        props: {
          handleKeyDown: (_: EditorView, event: KeyboardEvent) => {
            const { selection } = editor.state;

            /*
             * Handles the 'Escape' key press when there's a selection within the link.
             * This will move the cursor to the end of the link.
             */
            if (event.key === 'Escape' && selection.empty !== true) {
              editor.commands.focus(selection.to, { scrollIntoView: false });
            }

            return false;
          },
          handleClick(view, pos) {
            /*
             * Marks the entire link when the user clicks on it.
             */

            const { schema, doc, tr } = view.state;
            const range = getMarkRange(doc.resolve(pos), schema.marks.link);

            if (!range) {
              return;
            }

            const { from, to } = range;
            const start = Math.min(from, to);
            const end = Math.max(from, to);

            if (pos < start || pos > end) {
              return;
            }

            const $start = doc.resolve(start);
            const $end = doc.resolve(end);
            const transaction = tr.setSelection(new TextSelection($start, $end));

            view.dispatch(transaction);
          },
        },
      }),
    ];
  },
});

export default Link;
