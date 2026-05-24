'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Select component props
 *
 * @description Props for the Select dropdown component.
 * @see https://www.radix-ui.com/primitives/docs/components/select
 */
export type SelectProps = React.ComponentProps<typeof SelectPrimitive.Root>;

/** SelectGroup component props */
export type SelectGroupProps = React.ComponentProps<typeof SelectPrimitive.Group>;

/** SelectValue component props */
export type SelectValueProps = React.ComponentProps<typeof SelectPrimitive.Value>;

/**
 * SelectTrigger component props
 *
 * @description Props for the select trigger button.
 */
export type SelectTriggerProps = React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  /** Trigger size variant */
  size?: 'sm' | 'default';
  /**
   * Custom test ID for testing
   * @default 'select-trigger'
   */
  testId?: string;
};

/**
 * SelectContent component props
 *
 * @description Props for the dropdown content container.
 */
export type SelectContentProps = React.ComponentProps<typeof SelectPrimitive.Content> & {
  /**
   * Custom test ID for testing
   * @default 'select-content'
   */
  testId?: string;
};

/** SelectLabel component props */
export type SelectLabelProps = React.ComponentProps<typeof SelectPrimitive.Label>;

/**
 * SelectItem component props
 *
 * @description Props for individual selectable option.
 */
export type SelectItemProps = React.ComponentProps<typeof SelectPrimitive.Item> & {
  /**
   * Custom test ID for testing
   * @default 'select-item'
   */
  testId?: string;
};

/** SelectSeparator component props */
export type SelectSeparatorProps = React.ComponentProps<typeof SelectPrimitive.Separator>;

/** SelectScrollUpButton component props */
export type SelectScrollUpButtonProps = React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>;

/** SelectScrollDownButton component props */
export type SelectScrollDownButtonProps = React.ComponentProps<
  typeof SelectPrimitive.ScrollDownButton
>;

/**
 * Select component - Customizable dropdown selection
 *
 * @description
 * A dropdown menu for selecting a single value from a list of options.
 * Provides full keyboard navigation and accessibility support.
 *
 * ## Features
 * - **Single Selection**: Choose one option from a list
 * - **Groups**: Organize options into labeled groups
 * - **Searchable**: Type to filter options (when focused)
 * - **Scrollable**: Handles long lists with scroll buttons
 * - **Controlled/Uncontrolled**: Both modes supported
 * - **Size Variants**: Default and small trigger sizes
 *
 * ## Use Cases
 * - Form field dropdowns
 * - Filter/sort selectors
 * - Settings preferences
 * - Language/locale selectors
 *
 * ## vs NativeSelect
 * - **Select**: Custom styling, groups, searchable, rich content
 * - **NativeSelect**: Better mobile UX, native OS integration
 *
 * ## Accessibility
 * - Full keyboard navigation (Arrow, Home, End, PageUp/Down)
 * - Type-ahead search
 * - ARIA listbox pattern
 * - Focus management
 *
 * @example
 * ```tsx
 * // Basic select
 * <Select>
 *   <SelectTrigger className="w-[180px]">
 *     <SelectValue placeholder="Select a fruit" />
 *   </SelectTrigger>
 *   <SelectContent>
 *     <SelectItem value="apple">Apple</SelectItem>
 *     <SelectItem value="banana">Banana</SelectItem>
 *     <SelectItem value="orange">Orange</SelectItem>
 *   </SelectContent>
 * </Select>
 *
 * // With groups
 * <Select>
 *   <SelectTrigger>
 *     <SelectValue placeholder="Select timezone" />
 *   </SelectTrigger>
 *   <SelectContent>
 *     <SelectGroup>
 *       <SelectLabel>North America</SelectLabel>
 *       <SelectItem value="est">Eastern</SelectItem>
 *       <SelectItem value="pst">Pacific</SelectItem>
 *     </SelectGroup>
 *     <SelectSeparator />
 *     <SelectGroup>
 *       <SelectLabel>Europe</SelectLabel>
 *       <SelectItem value="gmt">GMT</SelectItem>
 *       <SelectItem value="cet">CET</SelectItem>
 *     </SelectGroup>
 *   </SelectContent>
 * </Select>
 *
 * // Controlled
 * const [value, setValue] = React.useState("");
 * <Select value={value} onValueChange={setValue}>
 *   ...
 * </Select>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/select
 */
const Select = ({ ...props }: SelectProps) => {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
};
Select.displayName = 'Select';

/** SelectGroup component - groups related select items */
const SelectGroup = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Group>,
  SelectGroupProps
>(({ ...props }, ref) => {
  return (
    <SelectPrimitive.Group
      ref={ref}
      data-slot="select-group"
      data-testid="select-group"
      {...props}
    />
  );
});
SelectGroup.displayName = 'SelectGroup';

/** SelectValue component - displays the selected value */
const SelectValue = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Value>,
  SelectValueProps
>(({ ...props }, ref) => {
  return (
    <SelectPrimitive.Value
      ref={ref}
      data-slot="select-value"
      data-testid="select-value"
      {...props}
    />
  );
});
SelectValue.displayName = 'SelectValue';

/** SelectTrigger component - button that opens the dropdown */
const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, size = 'default', children, testId = 'select-trigger', ...props }, ref) => {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      data-slot="select-trigger"
      data-testid={testId}
      data-size={size}
      aria-haspopup="listbox"
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = 'SelectTrigger';

/** SelectContent component - dropdown content container */
const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = 'popper', testId = 'select-content', ...props }, ref) => {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        data-slot="select-content"
        data-testid={testId}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border shadow-md',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-slot="select-viewport"
          data-testid={`${testId}-viewport`}
          className={cn(
            'p-1',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1'
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = 'SelectContent';

/** SelectLabel component - label for a group of items */
const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  SelectLabelProps
>(({ className, ...props }, ref) => {
  return (
    <SelectPrimitive.Label
      ref={ref}
      data-slot="select-label"
      data-testid="select-label"
      className={cn('px-2 py-1.5 text-sm font-medium', className)}
      {...props}
    />
  );
});
SelectLabel.displayName = 'SelectLabel';

/** SelectItem component - individual selectable option */
const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, testId = 'select-item', ...props }, ref) => {
  return (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="select-item"
      data-testid={testId}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = 'SelectItem';

/** SelectSeparator component - visual separator between items */
const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  SelectSeparatorProps
>(({ className, ...props }, ref) => {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      data-slot="select-separator"
      data-testid="select-separator"
      className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
});
SelectSeparator.displayName = 'SelectSeparator';

/** SelectScrollUpButton component - button to scroll up in long lists */
const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  SelectScrollUpButtonProps
>(({ className, ...props }, ref) => {
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      data-slot="select-scroll-up-button"
      data-testid="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  );
});
SelectScrollUpButton.displayName = 'SelectScrollUpButton';

/** SelectScrollDownButton component - button to scroll down in long lists */
const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  SelectScrollDownButtonProps
>(({ className, ...props }, ref) => {
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      data-slot="select-scroll-down-button"
      data-testid="select-scroll-down-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  );
});
SelectScrollDownButton.displayName = 'SelectScrollDownButton';

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
