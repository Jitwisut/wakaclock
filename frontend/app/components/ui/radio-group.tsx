'use client';

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { CircleIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * RadioGroup component props
 *
 * @description Props for the RadioGroup selection component.
 * @see https://www.radix-ui.com/primitives/docs/components/radio-group
 */
export type RadioGroupProps = React.ComponentProps<typeof RadioGroupPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'radio-group'
   */
  testId?: string;
};

/**
 * RadioGroup component - Single-selection radio button group
 *
 * @description
 * A set of radio buttons where only one can be selected at a time.
 * Provides full keyboard navigation and ARIA support.
 *
 * ## Features
 * - **Single Selection**: Only one item selected at a time
 * - **Keyboard Navigation**: Arrow keys to navigate, Space to select
 * - **Roving Focus**: Focus follows selection
 * - **Form Integration**: Works with form libraries
 * - **Controlled/Uncontrolled**: Both modes supported
 *
 * ## Use Cases
 * - Form field choices (e.g., payment method, shipping option)
 * - Settings with mutually exclusive options
 * - Survey questions
 * - Filter selections
 *
 * ## Accessibility
 * - `role="radiogroup"` on container
 * - `role="radio"` on each item
 * - Arrow key navigation within group
 * - Space/Enter to select focused item
 *
 * @example
 * ```tsx
 * // Basic radio group
 * <RadioGroup defaultValue="option-1">
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="option-1" id="option-1" />
 *     <Label htmlFor="option-1">Option 1</Label>
 *   </div>
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="option-2" id="option-2" />
 *     <Label htmlFor="option-2">Option 2</Label>
 *   </div>
 * </RadioGroup>
 *
 * // Controlled radio group
 * const [value, setValue] = React.useState("default");
 * <RadioGroup value={value} onValueChange={setValue}>
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="default" id="r1" />
 *     <Label htmlFor="r1">Default</Label>
 *   </div>
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="comfortable" id="r2" />
 *     <Label htmlFor="r2">Comfortable</Label>
 *   </div>
 * </RadioGroup>
 *
 * // With form validation
 * <RadioGroup required aria-invalid={!!error}>
 *   ...
 * </RadioGroup>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/radio-group
 */
const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, testId = 'radio-group', ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      data-slot="radio-group"
      data-testid={testId}
      className={cn('grid gap-3', className)}
      {...props}
    />
  );
});
RadioGroup.displayName = 'RadioGroup';

/**
 * RadioGroupItem component props
 *
 * @description Props for individual radio button item.
 */
export type RadioGroupItemProps = React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  /**
   * Custom test ID for testing
   * @default 'radio-group-item'
   */
  testId?: string;
};

/** RadioGroupItem component - individual radio button */
const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, testId = 'radio-group-item', ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      data-slot="radio-group-item"
      data-testid={testId}
      className={cn(
        'border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        data-testid={`${testId}-indicator`}
        className="relative flex items-center justify-center"
      >
        <CircleIcon
          className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
