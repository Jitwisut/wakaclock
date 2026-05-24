import { Extension } from '@tiptap/core';

/**
 * TipTap extension that provides a keyboard shortcut to remove all text formatting.
 *
 * Adds the Mod-\ (Cmd+\ on Mac, Ctrl+\ on Windows/Linux) keyboard shortcut
 * to clear all marks (bold, italic, underline, etc.) from the current selection.
 *
 * @example
 * ```tsx
 * import { UnsetAllMarks } from './unset-all-marks';
 *
 * const editor = useEditor({
 *   extensions: [UnsetAllMarks],
 * });
 * // User can press Cmd/Ctrl+\ to clear all formatting
 * ```
 */
export const UnsetAllMarks = Extension.create({
  name: 'unsetAllMarks',

  addKeyboardShortcuts() {
    return {
      'Mod-\\': () => this.editor.commands.unsetAllMarks(),
    };
  },
});

export default UnsetAllMarks;
