'use client';

import * as React from 'react';
import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Menubar component props
 *
 * @description Props for the Menubar root component.
 * @see https://www.radix-ui.com/primitives/docs/components/menubar
 */
export type MenubarProps = React.ComponentProps<typeof MenubarPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'menubar'
   */
  testId?: string;
};

/** MenubarMenu component props */
export type MenubarMenuProps = React.ComponentProps<typeof MenubarPrimitive.Menu>;

/** MenubarGroup component props */
export type MenubarGroupProps = React.ComponentProps<typeof MenubarPrimitive.Group>;

/** MenubarPortal component props */
export type MenubarPortalProps = React.ComponentProps<typeof MenubarPrimitive.Portal>;

/** MenubarRadioGroup component props */
export type MenubarRadioGroupProps = React.ComponentProps<typeof MenubarPrimitive.RadioGroup>;

/** MenubarTrigger component props */
export type MenubarTriggerProps = React.ComponentProps<typeof MenubarPrimitive.Trigger>;

/** MenubarContent component props */
export type MenubarContentProps = React.ComponentProps<typeof MenubarPrimitive.Content>;

/** MenubarItem component props */
export type MenubarItemProps = React.ComponentProps<typeof MenubarPrimitive.Item> & {
  /** Add left padding for alignment with icons */
  inset?: boolean;
  /** Visual variant */
  variant?: 'default' | 'destructive';
};

/** MenubarCheckboxItem component props */
export type MenubarCheckboxItemProps = React.ComponentProps<typeof MenubarPrimitive.CheckboxItem>;

/** MenubarRadioItem component props */
export type MenubarRadioItemProps = React.ComponentProps<typeof MenubarPrimitive.RadioItem> & {
  /** Whether the item is checked */
  checked?: boolean;
};

/** MenubarLabel component props */
export type MenubarLabelProps = React.ComponentProps<typeof MenubarPrimitive.Label> & {
  /** Add left padding for alignment with icons */
  inset?: boolean;
};

/** MenubarSeparator component props */
export type MenubarSeparatorProps = React.ComponentProps<typeof MenubarPrimitive.Separator>;

/** MenubarShortcut component props */
export type MenubarShortcutProps = React.ComponentProps<'span'>;

/** MenubarSub component props */
export type MenubarSubProps = React.ComponentProps<typeof MenubarPrimitive.Sub>;

/** MenubarSubTrigger component props */
export type MenubarSubTriggerProps = React.ComponentProps<typeof MenubarPrimitive.SubTrigger> & {
  /** Add left padding for alignment with icons */
  inset?: boolean;
};

/** MenubarSubContent component props */
export type MenubarSubContentProps = React.ComponentProps<typeof MenubarPrimitive.SubContent>;

/**
 * Menubar component - Horizontal menu bar for desktop applications
 *
 * @description
 * A visually persistent menu common in desktop applications.
 * Provides a horizontal bar of menu triggers that reveal dropdown menus.
 *
 * ## Features
 * - **Desktop Pattern**: Familiar File/Edit/View menu pattern
 * - **Keyboard Navigation**: Arrow keys, Enter, Escape
 * - **Submenus**: Nested menu support
 * - **Checkbox/Radio Items**: Toggle and selection options
 * - **Keyboard Shortcuts**: Display shortcut hints
 *
 * ## Accessibility
 * - Full keyboard navigation
 * - ARIA menubar role
 * - Focus management between menus
 *
 * @example
 * ```tsx
 * <Menubar>
 *   <MenubarMenu>
 *     <MenubarTrigger>File</MenubarTrigger>
 *     <MenubarContent>
 *       <MenubarItem>
 *         New File <MenubarShortcut>⌘N</MenubarShortcut>
 *       </MenubarItem>
 *       <MenubarItem>
 *         Open <MenubarShortcut>⌘O</MenubarShortcut>
 *       </MenubarItem>
 *       <MenubarSeparator />
 *       <MenubarSub>
 *         <MenubarSubTrigger>Share</MenubarSubTrigger>
 *         <MenubarSubContent>
 *           <MenubarItem>Email</MenubarItem>
 *           <MenubarItem>Messages</MenubarItem>
 *         </MenubarSubContent>
 *       </MenubarSub>
 *     </MenubarContent>
 *   </MenubarMenu>
 *   <MenubarMenu>
 *     <MenubarTrigger>Edit</MenubarTrigger>
 *     <MenubarContent>
 *       <MenubarItem>Undo</MenubarItem>
 *       <MenubarItem>Redo</MenubarItem>
 *     </MenubarContent>
 *   </MenubarMenu>
 * </Menubar>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/menubar
 */
const Menubar = React.forwardRef<React.ComponentRef<typeof MenubarPrimitive.Root>, MenubarProps>(
  ({ className, testId = 'menubar', ...props }, ref) => {
    return (
      <MenubarPrimitive.Root
        ref={ref}
        data-slot="menubar"
        data-testid={testId}
        className={cn(
          'bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs',
          className
        )}
        {...props}
      />
    );
  }
);
Menubar.displayName = 'Menubar';

/** MenubarMenu component - container for a menu within the menubar */
function MenubarMenu({ ...props }: MenubarMenuProps) {
  return <MenubarPrimitive.Menu {...props} />;
}
MenubarMenu.displayName = 'MenubarMenu';

/** MenubarGroup component - groups related menu items */
const MenubarGroup = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Group>,
  MenubarGroupProps
>(({ ...props }, ref) => {
  return (
    <MenubarPrimitive.Group
      ref={ref}
      data-slot="menubar-group"
      data-testid="menubar-group"
      {...props}
    />
  );
});
MenubarGroup.displayName = 'MenubarGroup';

/** MenubarPortal component - portal for rendering outside DOM hierarchy */
function MenubarPortal({ ...props }: MenubarPortalProps) {
  return <MenubarPrimitive.Portal {...props} />;
}
MenubarPortal.displayName = 'MenubarPortal';

/** MenubarRadioGroup component - group of mutually exclusive options */
const MenubarRadioGroup = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.RadioGroup>,
  MenubarRadioGroupProps
>(({ ...props }, ref) => {
  return (
    <MenubarPrimitive.RadioGroup
      ref={ref}
      data-slot="menubar-radio-group"
      data-testid="menubar-radio-group"
      {...props}
    />
  );
});
MenubarRadioGroup.displayName = 'MenubarRadioGroup';

/** MenubarTrigger component - button that opens the menu */
const MenubarTrigger = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Trigger>,
  MenubarTriggerProps
>(({ className, ...props }, ref) => {
  return (
    <MenubarPrimitive.Trigger
      ref={ref}
      data-slot="menubar-trigger"
      data-testid="menubar-trigger"
      className={cn(
        'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none',
        className
      )}
      {...props}
    />
  );
});
MenubarTrigger.displayName = 'MenubarTrigger';

/** MenubarContent component - container for menu items */
const MenubarContent = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Content>,
  MenubarContentProps
>(({ className, align = 'start', alignOffset = -4, sideOffset = 8, ...props }, ref) => {
  return (
    <MenubarPortal>
      <MenubarPrimitive.Content
        ref={ref}
        data-slot="menubar-content"
        data-testid="menubar-content"
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem] overflow-hidden rounded-md border p-1 shadow-md',
          className
        )}
        {...props}
      />
    </MenubarPortal>
  );
});
MenubarContent.displayName = 'MenubarContent';

/** MenubarItem component - individual menu action */
const MenubarItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Item>,
  MenubarItemProps
>(({ className, inset, variant = 'default', disabled, ...props }, ref) => {
  return (
    <MenubarPrimitive.Item
      ref={ref}
      data-slot="menubar-item"
      data-testid="menubar-item"
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
MenubarItem.displayName = 'MenubarItem';

/** MenubarCheckboxItem component - toggleable checkbox item */
const MenubarCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.CheckboxItem>,
  MenubarCheckboxItemProps
>(({ className, children, checked, ...props }, ref) => {
  return (
    <MenubarPrimitive.CheckboxItem
      ref={ref}
      data-slot="menubar-checkbox-item"
      data-testid="menubar-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      aria-checked={checked ? 'true' : 'false'}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon className="size-4" aria-hidden="true" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  );
});
MenubarCheckboxItem.displayName = 'MenubarCheckboxItem';

/** MenubarRadioItem component - selectable radio option */
const MenubarRadioItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.RadioItem>,
  MenubarRadioItemProps
>(({ className, children, checked, ...props }, ref) => {
  return (
    <MenubarPrimitive.RadioItem
      ref={ref}
      data-slot="menubar-radio-item"
      data-testid="menubar-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      aria-checked={checked ? 'true' : 'false'}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" aria-hidden="true" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.RadioItem>
  );
});
MenubarRadioItem.displayName = 'MenubarRadioItem';

/** MenubarLabel component - non-interactive label */
const MenubarLabel = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Label>,
  MenubarLabelProps
>(({ className, inset, ...props }, ref) => {
  return (
    <MenubarPrimitive.Label
      ref={ref}
      data-slot="menubar-label"
      data-testid="menubar-label"
      data-inset={inset}
      className={cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)}
      {...props}
    />
  );
});
MenubarLabel.displayName = 'MenubarLabel';

/** MenubarSeparator component - visual divider between items */
const MenubarSeparator = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Separator>,
  MenubarSeparatorProps
>(({ className, ...props }, ref) => {
  return (
    <MenubarPrimitive.Separator
      ref={ref}
      data-slot="menubar-separator"
      data-testid="menubar-separator"
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
});
MenubarSeparator.displayName = 'MenubarSeparator';

/** MenubarShortcut component - keyboard shortcut hint */
const MenubarShortcut = React.forwardRef<HTMLSpanElement, MenubarShortcutProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="menubar-shortcut"
        data-testid="menubar-shortcut"
        className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)}
        {...props}
      />
    );
  }
);
MenubarShortcut.displayName = 'MenubarShortcut';

/** MenubarSub component - nested submenu container */
function MenubarSub({ ...props }: MenubarSubProps) {
  return <MenubarPrimitive.Sub {...props} />;
}
MenubarSub.displayName = 'MenubarSub';

/** MenubarSubTrigger component - opens nested submenu */
const MenubarSubTrigger = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.SubTrigger>,
  MenubarSubTriggerProps
>(({ className, inset, children, ...props }, ref) => {
  return (
    <MenubarPrimitive.SubTrigger
      ref={ref}
      data-slot="menubar-sub-trigger"
      data-testid="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[inset]:pl-8',
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto h-4 w-4" aria-hidden="true" />
    </MenubarPrimitive.SubTrigger>
  );
});
MenubarSubTrigger.displayName = 'MenubarSubTrigger';

/** MenubarSubContent component - submenu content container */
const MenubarSubContent = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.SubContent>,
  MenubarSubContentProps
>(({ className, ...props }, ref) => {
  return (
    <MenubarPrimitive.SubContent
      ref={ref}
      data-slot="menubar-sub-content"
      data-testid="menubar-sub-content"
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg',
        className
      )}
      {...props}
    />
  );
});
MenubarSubContent.displayName = 'MenubarSubContent';

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
