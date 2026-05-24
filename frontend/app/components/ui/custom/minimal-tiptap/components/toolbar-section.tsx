import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { FormatAction } from '../types';
import type { VariantProps } from 'class-variance-authority';
import type { toggleVariants } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { CaretDownIcon } from '@radix-ui/react-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToolbarButton } from './toolbar-button';
import { ShortcutKey } from './shortcut-key';
import { getShortcutKey } from '../utils';

/** Props for the ToolbarSection component */
export interface ToolbarSectionProps
  extends VariantProps<typeof toggleVariants>, Omit<React.HTMLAttributes<HTMLDivElement>, 'size'> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Array of format actions to display */
  actions: FormatAction[];
  /** Array of action values that should be active */
  activeActions?: string[];
  /** Number of actions to show in main toolbar (rest go to dropdown) */
  mainActionCount?: number;
  /** Custom icon for the dropdown trigger */
  dropdownIcon?: React.ReactNode;
  /** Tooltip text for the dropdown trigger */
  dropdownTooltip?: string;
  /** CSS class for the dropdown trigger */
  dropdownClassName?: string;
}

/**
 * A toolbar section component that displays format actions for the TipTap editor.
 * Shows main actions directly and additional actions in a dropdown menu.
 */
export const ToolbarSection = React.forwardRef<HTMLDivElement, ToolbarSectionProps>(
  (
    {
      editor,
      actions,
      activeActions = actions.map((action) => action.value),
      mainActionCount = 0,
      dropdownIcon,
      dropdownTooltip = 'More options',
      dropdownClassName = 'w-12',
      size,
      variant,
      className,
      ...props
    },
    ref
  ) => {
    const { mainActions, dropdownActions } = React.useMemo(() => {
      const sortedActions = actions
        .filter((action) => activeActions.includes(action.value))
        .sort((a, b) => activeActions.indexOf(a.value) - activeActions.indexOf(b.value));

      return {
        mainActions: sortedActions.slice(0, mainActionCount),
        dropdownActions: sortedActions.slice(mainActionCount),
      };
    }, [actions, activeActions, mainActionCount]);

    const renderToolbarButton = React.useCallback(
      (action: FormatAction) => (
        <ToolbarButton
          key={action.value}
          onClick={() => action.action(editor)}
          pressed={action.isActive(editor)}
          disabled={!action.canExecute(editor)}
          isActive={action.isActive(editor)}
          tooltip={`${action.label} ${action.shortcuts.map((s) => getShortcutKey(s).symbol).join(' ')}`}
          aria-label={action.label}
          size={size}
          variant={variant}
        >
          {action.icon}
        </ToolbarButton>
      ),
      [editor, size, variant]
    );

    const renderDropdownMenuItem = React.useCallback(
      (action: FormatAction) => (
        <DropdownMenuItem
          key={action.value}
          onClick={() => action.action(editor)}
          disabled={!action.canExecute(editor)}
          className={cn('flex flex-row items-center justify-between gap-4', {
            'bg-accent': action.isActive(editor),
          })}
          aria-label={action.label}
        >
          <span className="grow">{action.label}</span>
          <ShortcutKey keys={action.shortcuts} />
        </DropdownMenuItem>
      ),
      [editor]
    );

    const isDropdownActive = React.useMemo(
      () => dropdownActions.some((action) => action.isActive(editor)),
      [dropdownActions, editor]
    );

    return (
      <div
        ref={ref}
        data-slot="toolbar-section"
        data-testid="toolbar-section"
        className={className}
        {...props}
      >
        {mainActions.map(renderToolbarButton)}
        {dropdownActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton
                isActive={isDropdownActive}
                tooltip={dropdownTooltip}
                aria-label={dropdownTooltip}
                className={cn(dropdownClassName)}
                size={size}
                variant={variant}
              >
                {dropdownIcon || <CaretDownIcon className="size-5" />}
              </ToolbarButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-full">
              {dropdownActions.map(renderDropdownMenuItem)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }
);

ToolbarSection.displayName = 'ToolbarSection';

export default ToolbarSection;
