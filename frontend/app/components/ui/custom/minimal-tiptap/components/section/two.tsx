import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { FormatAction } from '../../types';
import type { toggleVariants } from '@/components/ui/toggle';
import type { VariantProps } from 'class-variance-authority';
import {
  CodeIcon,
  DotsHorizontalIcon,
  FontBoldIcon,
  FontItalicIcon,
  StrikethroughIcon,
  TextNoneIcon,
  UnderlineIcon,
} from '@radix-ui/react-icons';
import { ToolbarSection } from '../toolbar-section';

/**
 * Available text style action types for formatting.
 */
type TextStyleAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'code'
  | 'clearFormatting';

/**
 * Internal text style configuration extending FormatAction.
 */
interface TextStyle extends FormatAction {
  value: TextStyleAction;
}

/**
 * Localization labels for the SectionTwo component.
 * Provides customizable strings for text formatting options.
 */
export type SectionTwoLabels = {
  bold: string;
  italic: string;
  underline: string;
  strikethrough: string;
  code: string;
  clearFormatting: string;
  moreFormatting: string;
};

const DEFAULT_ACTIVE_ACTIONS: TextStyleAction[] = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
  'clearFormatting',
];

const DEFAULT_LABELS: SectionTwoLabels = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  code: 'Code',
  clearFormatting: 'Clear formatting',
  moreFormatting: 'More formatting',
};

const createFormatActions = (labels: SectionTwoLabels): TextStyle[] => [
  {
    value: 'bold',
    label: labels.bold,
    icon: <FontBoldIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
    canExecute: (editor) =>
      editor.can().chain().focus().toggleBold().run() && !editor.isActive('codeBlock'),
    shortcuts: ['mod', 'B'],
  },
  {
    value: 'italic',
    label: labels.italic,
    icon: <FontItalicIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
    canExecute: (editor) =>
      editor.can().chain().focus().toggleItalic().run() && !editor.isActive('codeBlock'),
    shortcuts: ['mod', 'I'],
  },
  {
    value: 'underline',
    label: labels.underline,
    icon: <UnderlineIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive('underline'),
    canExecute: (editor) =>
      editor.can().chain().focus().toggleUnderline().run() && !editor.isActive('codeBlock'),
    shortcuts: ['mod', 'U'],
  },
  {
    value: 'strikethrough',
    label: labels.strikethrough,
    icon: <StrikethroughIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike'),
    canExecute: (editor) =>
      editor.can().chain().focus().toggleStrike().run() && !editor.isActive('codeBlock'),
    shortcuts: ['mod', 'shift', 'S'],
  },
  {
    value: 'code',
    label: labels.code,
    icon: <CodeIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleCode().run(),
    isActive: (editor) => editor.isActive('code'),
    canExecute: (editor) =>
      editor.can().chain().focus().toggleCode().run() && !editor.isActive('codeBlock'),
    shortcuts: ['mod', 'E'],
  },
  {
    value: 'clearFormatting',
    label: labels.clearFormatting,
    icon: <TextNoneIcon className="size-5" />,
    action: (editor) => editor.chain().focus().unsetAllMarks().run(),
    isActive: () => false,
    canExecute: (editor) =>
      editor.can().chain().focus().unsetAllMarks().run() && !editor.isActive('codeBlock'),
    shortcuts: ['mod', '\\'],
  },
];

/**
 * Props for the SectionTwo component.
 * Controls text formatting options in the toolbar.
 */
export interface SectionTwoProps extends VariantProps<typeof toggleVariants> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Active formatting actions to display */
  activeActions?: TextStyleAction[];
  /** Number of actions to show in main toolbar (rest in dropdown) */
  mainActionCount?: number;
  /** Custom labels for localization */
  labels?: Partial<SectionTwoLabels>;
}

/**
 * SectionTwo - Text formatting toolbar section for the minimal TipTap editor.
 * Provides bold, italic, underline, strikethrough, code, and clear formatting options.
 */
export const SectionTwo = React.forwardRef<HTMLDivElement, SectionTwoProps>(
  (
    { editor, activeActions = DEFAULT_ACTIVE_ACTIONS, mainActionCount = 2, labels, size, variant },
    ref
  ) => {
    const mergedLabels = React.useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
    const formatActions = React.useMemo(() => createFormatActions(mergedLabels), [mergedLabels]);

    return (
      <div ref={ref} data-slot="section-two" data-testid="section-two">
        <ToolbarSection
          editor={editor}
          actions={formatActions}
          activeActions={activeActions}
          mainActionCount={mainActionCount}
          dropdownIcon={<DotsHorizontalIcon className="size-5" />}
          dropdownTooltip={mergedLabels.moreFormatting}
          dropdownClassName="w-8"
          size={size}
          variant={variant}
        />
      </div>
    );
  }
);

SectionTwo.displayName = 'SectionTwo';

export default SectionTwo;
