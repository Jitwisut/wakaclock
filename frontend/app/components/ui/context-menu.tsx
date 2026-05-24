'use client';

import * as React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * ContextMenu component props
 *
 * @description Props for the ContextMenu root component.
 * Provides right-click menu functionality.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/context-menu
 */
export type ContextMenuProps = React.ComponentProps<typeof ContextMenuPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'context-menu'
   */
  testId?: string;
};

/** ContextMenuTrigger component props */
export type ContextMenuTriggerProps = React.ComponentProps<typeof ContextMenuPrimitive.Trigger>;

/** ContextMenuGroup component props */
export type ContextMenuGroupProps = React.ComponentProps<typeof ContextMenuPrimitive.Group>;

/** ContextMenuPortal component props */
export type ContextMenuPortalProps = React.ComponentProps<typeof ContextMenuPrimitive.Portal>;

/** ContextMenuSub component props */
export type ContextMenuSubProps = React.ComponentProps<typeof ContextMenuPrimitive.Sub>;

/** ContextMenuRadioGroup component props */
export type ContextMenuRadioGroupProps = React.ComponentProps<
  typeof ContextMenuPrimitive.RadioGroup
>;

/** ContextMenuSubTrigger component props */
export type ContextMenuSubTriggerProps = React.ComponentProps<
  typeof ContextMenuPrimitive.SubTrigger
> & {
  /** Add left padding for alignment with icons */
  inset?: boolean;
};

/** ContextMenuSubContent component props */
export type ContextMenuSubContentProps = React.ComponentProps<
  typeof ContextMenuPrimitive.SubContent
>;

/** ContextMenuContent component props */
export type ContextMenuContentProps = React.ComponentProps<typeof ContextMenuPrimitive.Content>;

/** ContextMenuItem component props */
export type ContextMenuItemProps = React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  /** Add left padding for alignment with icons */
  inset?: boolean;
  /** Visual variant */
  variant?: 'default' | 'destructive';
};

/** ContextMenuCheckboxItem component props */
export type ContextMenuCheckboxItemProps = React.ComponentProps<
  typeof ContextMenuPrimitive.CheckboxItem
>;

/** ContextMenuRadioItem component props */
export type ContextMenuRadioItemProps = React.ComponentProps<
  typeof ContextMenuPrimitive.RadioItem
> & {
  /** Whether the item is checked */
  checked?: boolean;
};

/** ContextMenuLabel component props */
export type ContextMenuLabelProps = React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
  /** Add left padding for alignment with icons */
  inset?: boolean;
};

/** ContextMenuSeparator component props */
export type ContextMenuSeparatorProps = React.ComponentProps<typeof ContextMenuPrimitive.Separator>;

/** ContextMenuShortcut component props */
export type ContextMenuShortcutProps = React.ComponentProps<'span'>;

/**
 * ContextMenu component - Right-click context menu
 *
 * @description
 * A menu that appears on right-click (context menu) containing
 * a list of actions relevant to the clicked element.
 *
 * ## Features
 * - **Right-click Trigger**: Opens on context menu event
 * - **Submenus**: Nested menu support
 * - **Checkbox Items**: Toggle options
 * - **Radio Groups**: Mutually exclusive options
 * - **Keyboard Shortcuts**: Display shortcut hints
 *
 * ## Accessibility
 * - Full keyboard navigation
 * - ARIA attributes for menu structure
 * - Focus management
 *
 * @example
 * ```tsx
 * <ContextMenu>
 *   <ContextMenuTrigger>Right click here</ContextMenuTrigger>
 *   <ContextMenuContent>
 *     <ContextMenuItem>Copy</ContextMenuItem>
 *     <ContextMenuItem>Paste</ContextMenuItem>
 *     <ContextMenuSeparator />
 *     <ContextMenuSub>
 *       <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
 *       <ContextMenuSubContent>
 *         <ContextMenuItem>Save As...</ContextMenuItem>
 *       </ContextMenuSubContent>
 *     </ContextMenuSub>
 *   </ContextMenuContent>
 * </ContextMenu>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/context-menu
 */
function ContextMenu({ testId = 'context-menu', ...props }: ContextMenuProps) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" data-testid={testId} {...props} />;
}
ContextMenu.displayName = 'ContextMenu';

/** ContextMenuTrigger component - element that shows menu on right-click */
const ContextMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Trigger>,
  ContextMenuTriggerProps
>(({ ...props }, ref) => {
  return (
    <ContextMenuPrimitive.Trigger
      ref={ref}
      data-slot="context-menu-trigger"
      data-testid="context-menu-trigger"
      {...props}
    />
  );
});
ContextMenuTrigger.displayName = 'ContextMenuTrigger';

/** ContextMenuGroup component - groups related menu items */
const ContextMenuGroup = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Group>,
  ContextMenuGroupProps
>(({ ...props }, ref) => {
  return (
    <ContextMenuPrimitive.Group
      ref={ref}
      data-slot="context-menu-group"
      data-testid="context-menu-group"
      {...props}
    />
  );
});
ContextMenuGroup.displayName = 'ContextMenuGroup';

/** ContextMenuPortal component - portal for rendering outside DOM hierarchy */
function ContextMenuPortal({ ...props }: ContextMenuPortalProps) {
  return <ContextMenuPrimitive.Portal {...props} />;
}
ContextMenuPortal.displayName = 'ContextMenuPortal';

/** ContextMenuSub component - nested submenu container */
function ContextMenuSub({ ...props }: ContextMenuSubProps) {
  return <ContextMenuPrimitive.Sub {...props} />;
}
ContextMenuSub.displayName = 'ContextMenuSub';

/** ContextMenuRadioGroup component - group of mutually exclusive options */
const ContextMenuRadioGroup = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.RadioGroup>,
  ContextMenuRadioGroupProps
>(({ ...props }, ref) => {
  return (
    <ContextMenuPrimitive.RadioGroup
      ref={ref}
      data-slot="context-menu-radio-group"
      data-testid="context-menu-radio-group"
      {...props}
    />
  );
});
ContextMenuRadioGroup.displayName = 'ContextMenuRadioGroup';

/** ContextMenuSubTrigger component - opens nested submenu */
const ContextMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.SubTrigger>,
  ContextMenuSubTriggerProps
>(({ className, inset, children, ...props }, ref) => {
  return (
    <ContextMenuPrimitive.SubTrigger
      ref={ref}
      data-slot="context-menu-sub-trigger"
      data-testid="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" aria-hidden="true" />
    </ContextMenuPrimitive.SubTrigger>
  );
});
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger';

/** ContextMenuSubContent component - submenu content container */
const ContextMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.SubContent>,
  ContextMenuSubContentProps
>(({ className, ...props }, ref) => {
  return (
    <ContextMenuPrimitive.SubContent
      ref={ref}
      data-slot="context-menu-sub-content"
      data-testid="context-menu-sub-content"
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg',
        className
      )}
      {...props}
    />
  );
});
ContextMenuSubContent.displayName = 'ContextMenuSubContent';

/** ContextMenuContent component - container for menu items */
const ContextMenuContent = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Content>,
  ContextMenuContentProps
>(({ className, ...props }, ref) => {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        ref={ref}
        data-slot="context-menu-content"
        data-testid="context-menu-content"
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
});
ContextMenuContent.displayName = 'ContextMenuContent';

/** ContextMenuItem component - individual menu action */
const ContextMenuItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Item>,
  ContextMenuItemProps
>(({ className, inset, variant = 'default', disabled, ...props }, ref) => {
  return (
    <ContextMenuPrimitive.Item
      ref={ref}
      data-slot="context-menu-item"
      data-testid="context-menu-item"
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
ContextMenuItem.displayName = 'ContextMenuItem';

/** ContextMenuCheckboxItem component - toggleable checkbox item */
const ContextMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.CheckboxItem>,
  ContextMenuCheckboxItemProps
>(({ className, children, checked, ...props }, ref) => {
  return (
    <ContextMenuPrimitive.CheckboxItem
      ref={ref}
      data-slot="context-menu-checkbox-item"
      data-testid="context-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      aria-checked={checked ? 'true' : 'false'}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" aria-hidden="true" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
});
ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem';

/** ContextMenuRadioItem component - selectable radio option */
const ContextMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.RadioItem>,
  ContextMenuRadioItemProps
>(({ className, children, checked, ...props }, ref) => {
  return (
    <ContextMenuPrimitive.RadioItem
      ref={ref}
      data-slot="context-menu-radio-item"
      data-testid="context-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      aria-checked={checked ? 'true' : 'false'}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" aria-hidden="true" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
});
ContextMenuRadioItem.displayName = 'ContextMenuRadioItem';

/** ContextMenuLabel component - non-interactive label */
const ContextMenuLabel = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Label>,
  ContextMenuLabelProps
>(({ className, inset, ...props }, ref) => {
  return (
    <ContextMenuPrimitive.Label
      ref={ref}
      data-slot="context-menu-label"
      data-testid="context-menu-label"
      data-inset={inset}
      className={cn('text-foreground px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)}
      {...props}
    />
  );
});
ContextMenuLabel.displayName = 'ContextMenuLabel';

/** ContextMenuSeparator component - visual divider between items */
const ContextMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Separator>,
  ContextMenuSeparatorProps
>(({ className, ...props }, ref) => {
  return (
    <ContextMenuPrimitive.Separator
      ref={ref}
      data-slot="context-menu-separator"
      data-testid="context-menu-separator"
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
});
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

/** ContextMenuShortcut component - keyboard shortcut hint */
const ContextMenuShortcut = React.forwardRef<HTMLSpanElement, ContextMenuShortcutProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="context-menu-shortcut"
        data-testid="context-menu-shortcut"
        className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)}
        {...props}
      />
    );
  }
);
ContextMenuShortcut.displayName = 'ContextMenuShortcut';

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
