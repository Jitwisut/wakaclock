import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Kbd component props
 *
 * @description Props for the Kbd keyboard key component.
 */
export type KbdProps = React.ComponentProps<'kbd'> & {
  /**
   * Custom test ID for testing
   * @default 'kbd'
   */
  testId?: string;
};

/**
 * Kbd component - Display keyboard shortcut keys
 *
 * @description
 * A styled inline element for displaying keyboard shortcuts
 * and key combinations. Designed to look like physical keys.
 *
 * ## Features
 * - **Visual Key Style**: Rounded, bordered appearance
 * - **Icon Support**: Include key icons like ⌘, ⌥, ⇧
 * - **Grouping**: Use KbdGroup for key combinations
 * - **Tooltip Integration**: Adapts styling inside tooltips
 *
 * ## Common Keys
 * - `⌘` or `Cmd` - Command (macOS)
 * - `Ctrl` - Control
 * - `⌥` or `Alt` - Option/Alt
 * - `⇧` or `Shift` - Shift
 * - `↵` or `Enter` - Enter/Return
 * - `⎋` or `Esc` - Escape
 *
 * @example
 * ```tsx
 * // Single key
 * <Kbd>K</Kbd>
 *
 * // Key combination
 * <KbdGroup>
 *   <Kbd>⌘</Kbd>
 *   <Kbd>K</Kbd>
 * </KbdGroup>
 *
 * // With icon
 * <Kbd>
 *   <ArrowUpIcon className="size-3" />
 * </Kbd>
 *
 * // In a menu item
 * <DropdownMenuItem>
 *   Save
 *   <KbdGroup>
 *     <Kbd>⌘</Kbd>
 *     <Kbd>S</Kbd>
 *   </KbdGroup>
 * </DropdownMenuItem>
 * ```
 */
const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ className, testId = 'kbd', ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        data-slot="kbd"
        data-testid={testId}
        className={cn(
          'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none',
          "[&_svg:not([class*='size-'])]:size-3",
          '[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10',
          className
        )}
        {...props}
      />
    );
  }
);
Kbd.displayName = 'Kbd';

/** KbdGroup component props */
export type KbdGroupProps = React.ComponentProps<'kbd'>;

/**
 * KbdGroup component - container for multiple keyboard keys
 * Groups related shortcuts like Ctrl+C
 */
const KbdGroup = React.forwardRef<HTMLElement, KbdGroupProps>(({ className, ...props }, ref) => {
  return (
    <kbd
      ref={ref}
      data-slot="kbd-group"
      data-testid="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  );
});
KbdGroup.displayName = 'KbdGroup';

export { Kbd, KbdGroup };
