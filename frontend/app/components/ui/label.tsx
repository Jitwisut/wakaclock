'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/lib/utils';

/**
 * Label component props
 *
 * @description Props for the Label form label component.
 * @see https://www.radix-ui.com/primitives/docs/components/label
 */
export type LabelProps = React.ComponentProps<typeof LabelPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'label'
   */
  testId?: string;
};

/**
 * Label component - Accessible form field label
 *
 * @description
 * An accessible label element that properly associates with form
 * controls and handles disabled states automatically.
 *
 * ## Features
 * - **Accessible Association**: Uses htmlFor to link to inputs
 * - **Disabled State**: Grays out when form control is disabled
 * - **Click to Focus**: Clicking label focuses associated input
 * - **Peer Integration**: Works with Tailwind peer selectors
 *
 * ## Accessibility
 * - Properly associates with form controls via htmlFor
 * - Inherits disabled state from parent group
 * - Supports peer-disabled styling from sibling inputs
 *
 * @example
 * ```tsx
 * // Basic label with input
 * <div className="grid gap-2">
 *   <Label htmlFor="email">Email</Label>
 *   <Input id="email" type="email" />
 * </div>
 *
 * // Required field indicator
 * <Label htmlFor="name">
 *   Name <span className="text-destructive">*</span>
 * </Label>
 *
 * // With checkbox (inline)
 * <div className="flex items-center gap-2">
 *   <Checkbox id="terms" />
 *   <Label htmlFor="terms">Accept terms</Label>
 * </div>
 *
 * // With description
 * <Label htmlFor="username">
 *   Username
 *   <span className="text-muted-foreground font-normal">
 *     (optional)
 *   </span>
 * </Label>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/label
 */
const Label = React.forwardRef<React.ComponentRef<typeof LabelPrimitive.Root>, LabelProps>(
  ({ className, testId = 'label', ...props }, ref) => {
    return (
      <LabelPrimitive.Root
        ref={ref}
        data-slot="label"
        data-testid={testId}
        className={cn(
          'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
Label.displayName = 'Label';

export { Label };
