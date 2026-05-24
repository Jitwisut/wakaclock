'use client';

import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { toggleVariants } from '@/components/ui/toggle';

/**
 * ToggleGroup component props
 *
 * @description Props for the ToggleGroup component.
 * @see https://www.radix-ui.com/primitives/docs/components/toggle-group
 */
export type ToggleGroupProps = React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    /**
     * Custom test ID for testing
     * @default 'toggle-group'
     */
    testId?: string;
  };

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: 'default',
  variant: 'default',
});

/**
 * ToggleGroup component - Group of exclusive toggles
 *
 * @description
 * A set of toggle buttons where only one (single) or multiple items
 * can be pressed at a time. Useful for toolbar button groups.
 *
 * ## Features
 * - **Single/Multiple Selection**: type="single" or type="multiple"
 * - **Variant Inheritance**: Children inherit parent variant/size
 * - **Keyboard Navigation**: Arrow keys between items
 * - **Controlled/Uncontrolled**: Both modes supported
 *
 * ## Use Cases
 * - Text formatting toolbars (bold, italic, underline)
 * - View mode toggles (grid/list/table)
 * - Alignment options
 * - Filter options
 *
 * ## vs RadioGroup
 * - **ToggleGroup**: Button-style, horizontal layout, toolbar context
 * - **RadioGroup**: Form-style, vertical layout, form context
 *
 * ## Accessibility
 * - `role="group"` for screen readers
 * - `aria-pressed` on individual toggles
 * - Arrow key navigation
 *
 * @example
 * ```tsx
 * // Single selection (like radio)
 * <ToggleGroup type="single" defaultValue="center">
 *   <ToggleGroupItem value="left">
 *     <AlignLeftIcon />
 *   </ToggleGroupItem>
 *   <ToggleGroupItem value="center">
 *     <AlignCenterIcon />
 *   </ToggleGroupItem>
 *   <ToggleGroupItem value="right">
 *     <AlignRightIcon />
 *   </ToggleGroupItem>
 * </ToggleGroup>
 *
 * // Multiple selection (like checkboxes)
 * <ToggleGroup type="multiple" defaultValue={["bold"]}>
 *   <ToggleGroupItem value="bold">
 *     <BoldIcon />
 *   </ToggleGroupItem>
 *   <ToggleGroupItem value="italic">
 *     <ItalicIcon />
 *   </ToggleGroupItem>
 *   <ToggleGroupItem value="underline">
 *     <UnderlineIcon />
 *   </ToggleGroupItem>
 * </ToggleGroup>
 *
 * // With variant
 * <ToggleGroup type="single" variant="outline" size="sm">
 *   ...
 * </ToggleGroup>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/toggle-group
 */
const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  ToggleGroupProps
>(({ className, variant, size, children, testId = 'toggle-group', ...props }, ref) => {
  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      data-slot="toggle-group"
      data-testid={testId}
      data-variant={variant}
      data-size={size}
      className={cn(
        'group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs',
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
});
ToggleGroup.displayName = 'ToggleGroup';

/** ToggleGroupItem component props */
export type ToggleGroupItemProps = React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants> & {
    /** Controlled pressed state */
    pressed?: boolean;
    /**
     * Custom test ID for testing
     * @default 'toggle-group-item'
     */
    testId?: string;
  };

/** ToggleGroupItem component - individual toggle in a group */
const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  ToggleGroupItemProps
>(
  (
    { className, children, variant, size, pressed, testId = 'toggle-group-item', ...props },
    ref
  ) => {
    const context = React.useContext(ToggleGroupContext);

    return (
      <ToggleGroupPrimitive.Item
        ref={ref}
        data-slot="toggle-group-item"
        data-testid={testId}
        data-variant={context.variant || variant}
        data-size={context.size || size}
        data-state={pressed !== undefined ? (pressed ? 'on' : 'off') : undefined}
        className={cn(
          toggleVariants({
            variant: context.variant || variant,
            size: context.size || size,
          }),
          'min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l',
          className
        )}
        {...props}
      >
        {children}
      </ToggleGroupPrimitive.Item>
    );
  }
);
ToggleGroupItem.displayName = 'ToggleGroupItem';

export { ToggleGroup, ToggleGroupItem };
