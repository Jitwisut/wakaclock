import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { Level } from '@tiptap/extension-heading';
import type { FormatAction } from '../../types';
import type { VariantProps } from 'class-variance-authority';
import type { toggleVariants } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { CaretDownIcon, LetterCaseCapitalizeIcon } from '@radix-ui/react-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToolbarButton } from '../toolbar-button';
import { ShortcutKey } from '../shortcut-key';

/**
 * Internal text style configuration for heading levels.
 * Extends FormatAction with element and styling information.
 */
interface TextStyle extends Omit<
  FormatAction,
  'value' | 'icon' | 'action' | 'isActive' | 'canExecute'
> {
  element: keyof React.JSX.IntrinsicElements;
  level?: Level;
  className: string;
}

/**
 * Localization labels for the SectionOne component.
 * Provides customizable strings for text style options.
 */
export type SectionOneLabels = {
  textStyles: string;
  normalText: string;
  heading1: string;
  heading2: string;
  heading3: string;
  heading4: string;
  heading5: string;
  heading6: string;
};

const DEFAULT_LABELS: SectionOneLabels = {
  textStyles: 'Text styles',
  normalText: 'Normal Text',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  heading4: 'Heading 4',
  heading5: 'Heading 5',
  heading6: 'Heading 6',
};

const createFormatActions = (labels: SectionOneLabels): TextStyle[] => [
  {
    label: labels.normalText,
    element: 'span',
    className: 'grow',
    shortcuts: ['mod', 'alt', '0'],
  },
  {
    label: labels.heading1,
    element: 'h1',
    level: 1,
    className: 'm-0 grow text-3xl font-extrabold',
    shortcuts: ['mod', 'alt', '1'],
  },
  {
    label: labels.heading2,
    element: 'h2',
    level: 2,
    className: 'm-0 grow text-xl font-bold',
    shortcuts: ['mod', 'alt', '2'],
  },
  {
    label: labels.heading3,
    element: 'h3',
    level: 3,
    className: 'm-0 grow text-lg font-semibold',
    shortcuts: ['mod', 'alt', '3'],
  },
  {
    label: labels.heading4,
    element: 'h4',
    level: 4,
    className: 'm-0 grow text-base font-semibold',
    shortcuts: ['mod', 'alt', '4'],
  },
  {
    label: labels.heading5,
    element: 'h5',
    level: 5,
    className: 'm-0 grow text-sm font-normal',
    shortcuts: ['mod', 'alt', '5'],
  },
  {
    label: labels.heading6,
    element: 'h6',
    level: 6,
    className: 'm-0 grow text-sm font-normal',
    shortcuts: ['mod', 'alt', '6'],
  },
];

/**
 * Props for the SectionOne component.
 * Controls text style/heading level selection in the toolbar.
 */
export interface SectionOneProps extends VariantProps<typeof toggleVariants> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Active heading levels to display (defaults to all 1-6) */
  activeLevels?: Level[];
  /** Custom labels for localization */
  labels?: Partial<SectionOneLabels>;
}

/**
 * SectionOne - Text style/heading level selector for the minimal TipTap toolbar.
 * Provides a dropdown menu for selecting paragraph or heading levels (H1-H6).
 */
export const SectionOne = React.forwardRef<HTMLDivElement, SectionOneProps>(
  ({ editor, activeLevels = [1, 2, 3, 4, 5, 6], labels, size, variant }, ref) => {
    const mergedLabels = React.useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
    const formatActions = React.useMemo(() => createFormatActions(mergedLabels), [mergedLabels]);
    const filteredActions = React.useMemo(
      () => formatActions.filter((action) => !action.level || activeLevels.includes(action.level)),
      [activeLevels, formatActions]
    );

    const handleStyleChange = React.useCallback(
      (level?: Level) => {
        if (level) {
          editor.chain().focus().toggleHeading({ level }).run();
        } else {
          editor.chain().focus().setParagraph().run();
        }
      },
      [editor]
    );

    const renderMenuItem = React.useCallback(
      ({ label, element: Element, level, className, shortcuts }: TextStyle) => (
        <DropdownMenuItem
          key={label}
          onClick={() => handleStyleChange(level)}
          className={cn('flex flex-row items-center justify-between gap-4', {
            'bg-accent': level
              ? editor.isActive('heading', { level })
              : editor.isActive('paragraph'),
          })}
          aria-label={label}
        >
          <Element className={className}>{label}</Element>
          <ShortcutKey keys={shortcuts} />
        </DropdownMenuItem>
      ),
      [editor, handleStyleChange]
    );

    return (
      <div ref={ref} data-slot="section-one" data-testid="section-one">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarButton
              isActive={editor.isActive('heading')}
              tooltip={mergedLabels.textStyles}
              aria-label={mergedLabels.textStyles}
              pressed={editor.isActive('heading')}
              className="w-12"
              disabled={editor.isActive('codeBlock')}
              size={size}
              variant={variant}
            >
              <LetterCaseCapitalizeIcon className="size-5" />
              <CaretDownIcon className="size-5" />
            </ToolbarButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-full">
            {filteredActions.map(renderMenuItem)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

SectionOne.displayName = 'SectionOne';

export default SectionOne;
