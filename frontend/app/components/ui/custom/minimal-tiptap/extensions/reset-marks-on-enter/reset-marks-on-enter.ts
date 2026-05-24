import { Extension } from '@tiptap/core';

/**
 * TipTap extension that resets text formatting marks when pressing Enter.
 *
 * Automatically removes bold, italic, strike, underline, and code formatting
 * when the user creates a new line, preventing formatting from bleeding into
 * subsequent paragraphs.
 *
 * @example
 * ```tsx
 * import { ResetMarksOnEnter } from './reset-marks-on-enter';
 *
 * const editor = useEditor({
 *   extensions: [ResetMarksOnEnter],
 * });
 * // Typing bold text and pressing Enter starts a clean new line
 * ```
 */
export const ResetMarksOnEnter = Extension.create({
  name: 'resetMarksOnEnter',

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (
          editor.isActive('bold') ||
          editor.isActive('italic') ||
          editor.isActive('strike') ||
          editor.isActive('underline') ||
          editor.isActive('code')
        ) {
          editor.commands.splitBlock({ keepMarks: false });

          return true;
        }

        return false;
      },
    };
  },
});

export default ResetMarksOnEnter;
