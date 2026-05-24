import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { FormatAction } from '../../types';
import type { toggleVariants } from '@/components/ui/toggle';
import type { VariantProps } from 'class-variance-authority';
import { CaretDownIcon, ListBulletIcon } from '@radix-ui/react-icons';
import { ToolbarSection } from '../toolbar-section';

/**
 * Available list action types for list formatting.
 */
type ListItemAction = 'orderedList' | 'bulletList';

/**
 * Internal list item configuration extending FormatAction.
 */
interface ListItem extends FormatAction {
  value: ListItemAction;
}

/**
 * Localization labels for the SectionFour component.
 * Provides customizable strings for list options.
 */
export type SectionFourLabels = {
  orderedList: string;
  bulletList: string;
  lists: string;
};

const DEFAULT_ACTIVE_ACTIONS: ListItemAction[] = ['orderedList', 'bulletList'];

const DEFAULT_LABELS: SectionFourLabels = {
  orderedList: 'Numbered list',
  bulletList: 'Bullet list',
  lists: 'Lists',
};

const createFormatActions = (labels: SectionFourLabels): ListItem[] => [
  {
    value: 'orderedList',
    label: labels.orderedList,
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="20px"
        viewBox="0 -960 960 960"
        width="20px"
        fill="currentColor"
      >
        <path d="M144-144v-48h96v-24h-48v-48h48v-24h-96v-48h120q10.2 0 17.1 6.9 6.9 6.9 6.9 17.1v48q0 10.2-6.9 17.1-6.9 6.9-17.1 6.9 10.2 0 17.1 6.9 6.9 6.9 6.9 17.1v48q0 10.2-6.9 17.1-6.9 6.9-17.1 6.9H144Zm0-240v-96q0-10.2 6.9-17.1 6.9-6.9 17.1-6.9h72v-24h-96v-48h120q10.2 0 17.1 6.9 6.9 6.9 6.9 17.1v72q0 10.2-6.9 17.1-6.9 6.9-17.1 6.9h-72v24h96v48H144Zm48-240v-144h-48v-48h96v192h-48Zm168 384v-72h456v72H360Zm0-204v-72h456v72H360Zm0-204v-72h456v72H360Z" />
      </svg>
    ),
    isActive: (editor) => editor.isActive('orderedList'),
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    canExecute: (editor) => editor.can().chain().focus().toggleOrderedList().run(),
    shortcuts: ['mod', 'shift', '7'],
  },
  {
    value: 'bulletList',
    label: labels.bulletList,
    icon: <ListBulletIcon className="size-5" />,
    isActive: (editor) => editor.isActive('bulletList'),
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    canExecute: (editor) => editor.can().chain().focus().toggleBulletList().run(),
    shortcuts: ['mod', 'shift', '8'],
  },
];

/**
 * Props for the SectionFour component.
 * Controls list formatting options in the toolbar.
 */
export interface SectionFourProps extends VariantProps<typeof toggleVariants> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Active list actions to display */
  activeActions?: ListItemAction[];
  /** Number of actions to show in main toolbar (rest in dropdown) */
  mainActionCount?: number;
  /** Custom labels for localization */
  labels?: Partial<SectionFourLabels>;
}

/**
 * SectionFour - List formatting toolbar section for the minimal TipTap editor.
 * Provides ordered (numbered) and bullet list options.
 */
export const SectionFour = React.forwardRef<HTMLDivElement, SectionFourProps>(
  (
    { editor, activeActions = DEFAULT_ACTIVE_ACTIONS, mainActionCount = 0, labels, size, variant },
    ref
  ) => {
    const mergedLabels = React.useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
    const formatActions = React.useMemo(() => createFormatActions(mergedLabels), [mergedLabels]);

    return (
      <div ref={ref} data-slot="section-four" data-testid="section-four">
        <ToolbarSection
          editor={editor}
          actions={formatActions}
          activeActions={activeActions}
          mainActionCount={mainActionCount}
          dropdownIcon={
            <>
              <ListBulletIcon className="size-5" />
              <CaretDownIcon className="size-5" />
            </>
          }
          dropdownTooltip={mergedLabels.lists}
          size={size}
          variant={variant}
        />
      </div>
    );
  }
);

SectionFour.displayName = 'SectionFour';

export default SectionFour;
