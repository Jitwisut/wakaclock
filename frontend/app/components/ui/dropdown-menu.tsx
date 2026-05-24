'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * DropdownMenu component props
 *
 * @description Props for the DropdownMenu root component.
 * Controls the open state and provides callbacks for state changes.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/dropdown-menu
 */
export type DropdownMenuProps = React.ComponentProps<typeof DropdownMenuPrimitive.Root>;

/** DropdownMenuPortal component props */
export type DropdownMenuPortalProps = React.ComponentProps<typeof DropdownMenuPrimitive.Portal>;

/** DropdownMenuTrigger component props */
export type DropdownMenuTriggerProps = React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>;

/** DropdownMenuContent component props */
export type DropdownMenuContentProps = React.ComponentProps<typeof DropdownMenuPrimitive.Content>;

/** DropdownMenuGroup component props */
export type DropdownMenuGroupProps = React.ComponentProps<typeof DropdownMenuPrimitive.Group>;

/** DropdownMenuItem component props */
export type DropdownMenuItemProps = React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  /** Add left padding for alignment with icons */
  inset?: boolean;
  /** Visual variant */
  variant?: 'default' | 'destructive';
};

/** DropdownMenuCheckboxItem component props */
export type DropdownMenuCheckboxItemProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.CheckboxItem
>;

/** DropdownMenuRadioGroup component props */
export type DropdownMenuRadioGroupProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.RadioGroup
>;

/** DropdownMenuRadioItem component props */
export type DropdownMenuRadioItemProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.RadioItem
> & {
  /** Whether the item is checked */
  checked?: boolean;
};

/** DropdownMenuLabel component props */
export type DropdownMenuLabelProps = React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  /** Add left padding for alignment with icons */
  inset?: boolean;
};

/** DropdownMenuSeparator component props */
export type DropdownMenuSeparatorProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Separator
>;

/** DropdownMenuShortcut component props */
export type DropdownMenuShortcutProps = React.ComponentProps<'span'>;

/** DropdownMenuSub component props */
export type DropdownMenuSubProps = React.ComponentProps<typeof DropdownMenuPrimitive.Sub>;

/** DropdownMenuSubTrigger component props */
export type DropdownMenuSubTriggerProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.SubTrigger
> & {
  /** Add left padding for alignment with icons */
  inset?: boolean;
};

/** DropdownMenuSubContent component props */
export type DropdownMenuSubContentProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.SubContent
>;

/**
 * DropdownMenu component - Click-triggered menu for actions
 *
 * @description
 * A popover menu that appears when a trigger element is clicked.
 * Provides a list of actions, navigation items, or settings.
 *
 * ## Features
 * - **Click Trigger**: Opens on click (vs ContextMenu's right-click)
 * - **Submenus**: Nested menu support with hover expansion
 * - **Checkbox Items**: Toggle options within the menu
 * - **Radio Groups**: Mutually exclusive options
 * - **Keyboard Shortcuts**: Display shortcut hints with DropdownMenuShortcut
 * - **Destructive Actions**: Visual variant for dangerous operations
 *
 * ## Accessibility
 * - Full keyboard navigation (Arrow keys, Enter, Escape)
 * - ARIA attributes for menu structure
 * - Focus management and focus trap
 * - Screen reader announcements
 *
 * @example
 * ```tsx
 * // Basic dropdown menu
 * <DropdownMenu>
 *   <DropdownMenuTrigger asChild>
 *     <Button variant="outline">Open Menu</Button>
 *   </DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuLabel>My Account</DropdownMenuLabel>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem>Profile</DropdownMenuItem>
 *     <DropdownMenuItem>Settings</DropdownMenuItem>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem variant="destructive">
 *       Log out
 *     </DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 *
 * // With checkbox items
 * <DropdownMenuCheckboxItem checked={showStatus}>
 *   Show Status Bar
 * </DropdownMenuCheckboxItem>
 *
 * // With keyboard shortcuts
 * <DropdownMenuItem>
 *   Save <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
 * </DropdownMenuItem>
 *
 * // With submenu
 * <DropdownMenuSub>
 *   <DropdownMenuSubTrigger>More Options</DropdownMenuSubTrigger>
 *   <DropdownMenuSubContent>
 *     <DropdownMenuItem>Export</DropdownMenuItem>
 *     <DropdownMenuItem>Import</DropdownMenuItem>
 *   </DropdownMenuSubContent>
 * </DropdownMenuSub>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/dropdown-menu
 */
function DropdownMenu({ ...props }: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root data-slot="dropdown-menu" data-testid="dropdown-menu" {...props} />
  );
}

/** DropdownMenuPortal component - portal for rendering outside DOM hierarchy */
function DropdownMenuPortal({ ...props }: DropdownMenuPortalProps) {
  return <DropdownMenuPrimitive.Portal {...props} />;
}

/** DropdownMenuTrigger component - element that opens the menu */
const DropdownMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Trigger>,
  DropdownMenuTriggerProps
>(({ ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.Trigger
      ref={ref}
      data-slot="dropdown-menu-trigger"
      data-testid="dropdown-menu-trigger"
      {...props}
    />
  );
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

/** DropdownMenuContent component - container for menu items */
const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  DropdownMenuContentProps
>(({ className, sideOffset = 4, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        data-slot="dropdown-menu-content"
        data-testid="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = 'DropdownMenuContent';

/** DropdownMenuGroup component - groups related menu items */
const DropdownMenuGroup = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Group>,
  DropdownMenuGroupProps
>(({ ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.Group
      ref={ref}
      data-slot="dropdown-menu-group"
      data-testid="dropdown-menu-group"
      {...props}
    />
  );
});
DropdownMenuGroup.displayName = 'DropdownMenuGroup';

/** DropdownMenuItem component - individual menu action */
const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(({ className, inset, variant = 'default', disabled, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      data-slot="dropdown-menu-item"
      data-testid="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = 'DropdownMenuItem';

/** DropdownMenuCheckboxItem component - toggleable checkbox item */
const DropdownMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(({ className, children, checked, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      data-slot="dropdown-menu-checkbox-item"
      data-testid="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      aria-checked={checked ? 'true' : 'false'}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" aria-hidden="true" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
});
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

/** DropdownMenuRadioGroup component - group of mutually exclusive options */
const DropdownMenuRadioGroup = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.RadioGroup>,
  DropdownMenuRadioGroupProps
>(({ ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.RadioGroup
      ref={ref}
      data-slot="dropdown-menu-radio-group"
      data-testid="dropdown-menu-radio-group"
      {...props}
    />
  );
});
DropdownMenuRadioGroup.displayName = 'DropdownMenuRadioGroup';

/** DropdownMenuRadioItem component - selectable radio option */
const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
  DropdownMenuRadioItemProps
>(({ className, children, checked, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      data-slot="dropdown-menu-radio-item"
      data-testid="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      aria-checked={checked ? 'true' : 'false'}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" aria-hidden="true" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
});
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

/** DropdownMenuLabel component - non-interactive label */
const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
  DropdownMenuLabelProps
>(({ className, inset, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      data-slot="dropdown-menu-label"
      data-testid="dropdown-menu-label"
      data-inset={inset}
      className={cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

/** DropdownMenuSeparator component - visual divider between items */
const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      data-slot="dropdown-menu-separator"
      data-testid="dropdown-menu-separator"
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

/** DropdownMenuShortcut component - keyboard shortcut hint */
const DropdownMenuShortcut = React.forwardRef<HTMLSpanElement, DropdownMenuShortcutProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="dropdown-menu-shortcut"
        data-testid="dropdown-menu-shortcut"
        className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)}
        {...props}
      />
    );
  }
);
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

/** DropdownMenuSub component - nested submenu container */
function DropdownMenuSub({ ...props }: DropdownMenuSubProps) {
  return <DropdownMenuPrimitive.Sub {...props} />;
}

/** DropdownMenuSubTrigger component - opens nested submenu */
const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
  DropdownMenuSubTriggerProps
>(({ className, inset, children, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      data-slot="dropdown-menu-sub-trigger"
      data-testid="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8',
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" aria-hidden="true" />
    </DropdownMenuPrimitive.SubTrigger>
  );
});
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

/** DropdownMenuSubContent component - submenu content container */
const DropdownMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
  DropdownMenuSubContentProps
>(({ className, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      data-slot="dropdown-menu-sub-content"
      data-testid="dropdown-menu-sub-content"
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg',
        className
      )}
      {...props}
    />
  );
});
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
