'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Checkbox component props
 *
 * @description Props for the Checkbox component.
 * Extends Radix UI Checkbox.Root props with testing support.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/checkbox
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
 */
export type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'checkbox'
   */
  testId?: string;
};

/**
 * Checkbox component - Toggleable boolean input
 *
 * @description
 * A control that allows the user to toggle between checked and unchecked states.
 * Supports three states: checked, unchecked, and indeterminate.
 *
 * ## Features
 * - **Three States**: Checked, unchecked, indeterminate
 * - **Controlled/Uncontrolled**: Works both ways
 * - **Form Integration**: Works with form libraries
 * - **Keyboard Support**: Space key to toggle
 * - **WCAG 2.1 Compliant**: Proper ARIA attributes
 *
 * ## Accessibility
 * - Native checkbox semantics via Radix
 * - `aria-checked` for state indication
 * - `aria-disabled` when disabled
 * - Focus ring for keyboard navigation
 *
 * @example
 * ```tsx
 * // Basic checkbox
 * <div className="flex items-center space-x-2">
 *   <Checkbox id="terms" />
 *   <Label htmlFor="terms">Accept terms</Label>
 * </div>
 *
 * // Controlled checkbox
 * const [checked, setChecked] = useState(false);
 * <Checkbox
 *   checked={checked}
 *   onCheckedChange={setChecked}
 * />
 *
 * // Indeterminate state
 * <Checkbox checked="indeterminate" />
 *
 * // Disabled checkbox
 * <Checkbox disabled checked />
 *
 * // With form
 * <FormField
 *   control={form.control}
 *   name="terms"
 *   render={({ field }) => (
 *     <Checkbox
 *       checked={field.value}
 *       onCheckedChange={field.onChange}
 *     />
 *   )}
 * />
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/checkbox
 */
const Checkbox = React.forwardRef<React.ComponentRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, disabled, testId = 'checkbox', ...props }, ref) => {
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        data-slot="checkbox"
        data-testid={testId}
        disabled={disabled}
        aria-disabled={disabled ? true : undefined}
        className={cn(
          'peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          data-testid={`${testId}-indicator`}
          className="flex items-center justify-center text-current transition-none"
        >
          <CheckIcon className="size-3.5" aria-hidden="true" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
