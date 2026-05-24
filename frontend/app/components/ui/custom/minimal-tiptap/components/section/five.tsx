import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { FormatAction } from '../../types';
import type { toggleVariants } from '@/components/ui/toggle';
import type { VariantProps } from 'class-variance-authority';
import {
  CaretDownIcon,
  CodeIcon,
  DividerHorizontalIcon,
  PlusIcon,
  QuoteIcon,
} from '@radix-ui/react-icons';
import { LinkEditPopover } from '../link/link-edit-popover';
import { ImageEditDialog } from '../image/image-edit-dialog';
import { ToolbarSection } from '../toolbar-section';

/**
 * Available insert element action types.
 */
type InsertElementAction = 'codeBlock' | 'blockquote' | 'horizontalRule';

/**
 * Internal insert element configuration extending FormatAction.
 */
interface InsertElement extends FormatAction {
  value: InsertElementAction;
}

/**
 * Localization labels for the SectionFive component.
 * Provides customizable strings for insert element options.
 */
export type SectionFiveLabels = {
  codeBlock: string;
  blockquote: string;
  divider: string;
  insertElements: string;
  linkEditPopover?: React.ComponentProps<typeof LinkEditPopover>['labels'];
  imageEditDialog?: React.ComponentProps<typeof ImageEditDialog>['labels'];
};

const DEFAULT_ACTIVE_ACTIONS: InsertElementAction[] = ['codeBlock', 'blockquote', 'horizontalRule'];

const DEFAULT_LABELS: SectionFiveLabels = {
  codeBlock: 'Code block',
  blockquote: 'Blockquote',
  divider: 'Divider',
  insertElements: 'Insert elements',
};

const createFormatActions = (labels: SectionFiveLabels): InsertElement[] => [
  {
    value: 'codeBlock',
    label: labels.codeBlock,
    icon: <CodeIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    isActive: (editor) => editor.isActive('codeBlock'),
    canExecute: (editor) => editor.can().chain().focus().toggleCodeBlock().run(),
    shortcuts: ['mod', 'alt', 'C'],
  },
  {
    value: 'blockquote',
    label: labels.blockquote,
    icon: <QuoteIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive('blockquote'),
    canExecute: (editor) => editor.can().chain().focus().toggleBlockquote().run(),
    shortcuts: ['mod', 'shift', 'B'],
  },
  {
    value: 'horizontalRule',
    label: labels.divider,
    icon: <DividerHorizontalIcon className="size-5" />,
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
    isActive: () => false,
    canExecute: (editor) => editor.can().chain().focus().setHorizontalRule().run(),
    shortcuts: ['mod', 'alt', '-'],
  },
];

/**
 * Props for the SectionFive component.
 * Controls insert element options in the toolbar.
 */
export interface SectionFiveProps extends VariantProps<typeof toggleVariants> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Active insert actions to display */
  activeActions?: InsertElementAction[];
  /** Number of actions to show in main toolbar (rest in dropdown) */
  mainActionCount?: number;
  /** Custom labels for localization */
  labels?: Partial<SectionFiveLabels>;
}

/**
 * SectionFive - Insert elements toolbar section for the minimal TipTap editor.
 * Provides link, image, code block, blockquote, and divider insertion options.
 */
export const SectionFive = React.forwardRef<HTMLDivElement, SectionFiveProps>(
  (
    { editor, activeActions = DEFAULT_ACTIVE_ACTIONS, mainActionCount = 0, labels, size, variant },
    ref
  ) => {
    const mergedLabels = React.useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
    const formatActions = React.useMemo(() => createFormatActions(mergedLabels), [mergedLabels]);

    return (
      <div ref={ref} data-slot="section-five" data-testid="section-five">
        <LinkEditPopover
          editor={editor}
          size={size}
          variant={variant}
          labels={mergedLabels.linkEditPopover}
        />
        <ImageEditDialog
          editor={editor}
          size={size}
          variant={variant}
          labels={mergedLabels.imageEditDialog}
        />
        <ToolbarSection
          editor={editor}
          actions={formatActions}
          activeActions={activeActions}
          mainActionCount={mainActionCount}
          dropdownIcon={
            <>
              <PlusIcon className="size-5" />
              <CaretDownIcon className="size-5" />
            </>
          }
          dropdownTooltip={mergedLabels.insertElements}
          size={size}
          variant={variant}
        />
      </div>
    );
  }
);

SectionFive.displayName = 'SectionFive';

export default SectionFive;
