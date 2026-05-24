'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Command component props
 *
 * @description Props for the Command palette component.
 * Built on cmdk library for fast, composable command menus.
 *
 * @see https://cmdk.paco.me/
 */
export type CommandProps = React.ComponentProps<typeof CommandPrimitive> & {
  /**
   * Custom test ID for testing
   * @default 'command'
   */
  testId?: string;
};

/** CommandDialog component props */
export type CommandDialogProps = React.ComponentProps<typeof Dialog> & {
  /** Dialog title for accessibility */
  title?: string;
  /** Dialog description for accessibility */
  description?: string;
};

/** CommandInput component props */
export type CommandInputProps = React.ComponentProps<typeof CommandPrimitive.Input>;

/** CommandList component props */
export type CommandListProps = React.ComponentProps<typeof CommandPrimitive.List>;

/** CommandEmpty component props */
export type CommandEmptyProps = React.ComponentProps<typeof CommandPrimitive.Empty>;

/** CommandGroup component props */
export type CommandGroupProps = React.ComponentProps<typeof CommandPrimitive.Group>;

/** CommandSeparator component props */
export type CommandSeparatorProps = React.ComponentProps<typeof CommandPrimitive.Separator>;

/** CommandItem component props */
export type CommandItemProps = React.ComponentProps<typeof CommandPrimitive.Item>;

/** CommandShortcut component props */
export type CommandShortcutProps = React.ComponentProps<'span'>;

/**
 * Command component - Command palette and search interface
 *
 * @description
 * A fast, composable command menu component for building
 * command palettes, search dialogs, and autocomplete interfaces.
 *
 * ## Features
 * - **Fast Search**: Built-in fuzzy search filtering
 * - **Keyboard Navigation**: Full keyboard support
 * - **Composable**: Mix and match subcomponents
 * - **Groups**: Organize commands into groups
 * - **Empty State**: Built-in "no results" handling
 *
 * ## Keyboard Shortcuts
 * - Arrow Up/Down: Navigate items
 * - Enter: Select current item
 * - Escape: Close (when in dialog)
 *
 * @example
 * ```tsx
 * // Basic command menu
 * <Command>
 *   <CommandInput placeholder="Search..." />
 *   <CommandList>
 *     <CommandEmpty>No results found.</CommandEmpty>
 *     <CommandGroup heading="Suggestions">
 *       <CommandItem>Calendar</CommandItem>
 *       <CommandItem>Search Emoji</CommandItem>
 *       <CommandItem>Calculator</CommandItem>
 *     </CommandGroup>
 *   </CommandList>
 * </Command>
 *
 * // In a dialog
 * <CommandDialog>
 *   <CommandInput placeholder="Type a command..." />
 *   <CommandList>
 *     <CommandGroup heading="Actions">
 *       <CommandItem>
 *         <PlusIcon className="mr-2 size-4" />
 *         Create New
 *         <CommandShortcut>⌘N</CommandShortcut>
 *       </CommandItem>
 *     </CommandGroup>
 *   </CommandList>
 * </CommandDialog>
 * ```
 *
 * @see https://cmdk.paco.me/
 */
const Command = React.forwardRef<React.ComponentRef<typeof CommandPrimitive>, CommandProps>(
  ({ className, testId = 'command', ...props }, ref) => {
    return (
      <CommandPrimitive
        ref={ref}
        data-slot="command"
        data-testid={testId}
        className={cn(
          'bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md',
          className
        )}
        {...props}
      />
    );
  }
);
Command.displayName = 'Command';

/** CommandDialog component - command palette in a dialog */
function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  ...props
}: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
CommandDialog.displayName = 'CommandDialog';

/** CommandInput component - search input field */
const CommandInput = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Input>,
  CommandInputProps
>(({ className, ...props }, ref) => {
  return (
    <div
      data-slot="command-input-wrapper"
      data-testid="command-input-wrapper"
      className="flex h-9 items-center gap-2 border-b px-3"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      <CommandPrimitive.Input
        ref={ref}
        data-slot="command-input"
        data-testid="command-input"
        className={cn(
          'placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    </div>
  );
});
CommandInput.displayName = 'CommandInput';

/** CommandList component - scrollable list of items */
const CommandList = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.List>,
  CommandListProps
>(({ className, ...props }, ref) => {
  return (
    <CommandPrimitive.List
      ref={ref}
      data-slot="command-list"
      data-testid="command-list"
      className={cn('max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto', className)}
      {...props}
    />
  );
});
CommandList.displayName = 'CommandList';

/** CommandEmpty component - shown when no results found */
const CommandEmpty = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Empty>,
  CommandEmptyProps
>(({ ...props }, ref) => {
  return (
    <CommandPrimitive.Empty
      ref={ref}
      data-slot="command-empty"
      data-testid="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  );
});
CommandEmpty.displayName = 'CommandEmpty';

/** CommandGroup component - groups related command items */
const CommandGroup = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Group>,
  CommandGroupProps
>(({ className, ...props }, ref) => {
  return (
    <CommandPrimitive.Group
      ref={ref}
      data-slot="command-group"
      data-testid="command-group"
      className={cn(
        'text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
        className
      )}
      {...props}
    />
  );
});
CommandGroup.displayName = 'CommandGroup';

/** CommandSeparator component - visual divider between groups */
const CommandSeparator = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Separator>,
  CommandSeparatorProps
>(({ className, ...props }, ref) => {
  return (
    <CommandPrimitive.Separator
      ref={ref}
      data-slot="command-separator"
      data-testid="command-separator"
      className={cn('bg-border -mx-1 h-px', className)}
      {...props}
    />
  );
});
CommandSeparator.displayName = 'CommandSeparator';

/** CommandItem component - selectable command option */
const CommandItem = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Item>,
  CommandItemProps
>(({ className, ...props }, ref) => {
  return (
    <CommandPrimitive.Item
      ref={ref}
      data-slot="command-item"
      data-testid="command-item"
      className={cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
});
CommandItem.displayName = 'CommandItem';

/** CommandShortcut component - keyboard shortcut hint */
const CommandShortcut = React.forwardRef<HTMLSpanElement, CommandShortcutProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="command-shortcut"
        data-testid="command-shortcut"
        className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)}
        {...props}
      />
    );
  }
);
CommandShortcut.displayName = 'CommandShortcut';

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
