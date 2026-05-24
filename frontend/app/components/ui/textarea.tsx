import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Textarea component props
 *
 * @description Props for the Textarea multi-line input component.
 */
export type TextareaProps = React.ComponentProps<'textarea'> & {
  /**
   * Custom test ID for testing
   * @default 'textarea'
   */
  testId?: string;
};

/**
 * Textarea component - Multi-line text input field
 *
 * @description
 * A styled textarea for multi-line text input with auto-sizing
 * support and accessible validation states.
 *
 * ## Features
 * - **Auto-Sizing**: Grows with content (field-sizing-content)
 * - **Validation States**: Error styling via aria-invalid
 * - **Required Field**: aria-required support
 * - **Responsive Text**: Larger on mobile, smaller on desktop
 * - **Dark Mode**: Adaptive background styling
 *
 * ## Use Cases
 * - Comment/message inputs
 * - Description fields
 * - Bio/about sections
 * - Feedback forms
 * - Notes and documentation
 *
 * ## Accessibility
 * - aria-required for required fields
 * - aria-invalid for validation errors
 * - Proper label association via id
 *
 * @example
 * ```tsx
 * // Basic textarea
 * <Textarea placeholder="Enter your message..." />
 *
 * // With label
 * <div className="grid gap-2">
 *   <Label htmlFor="message">Message</Label>
 *   <Textarea id="message" placeholder="Type your message here" />
 * </div>
 *
 * // With validation
 * <Textarea
 *   aria-invalid={!!errors.message}
 *   {...register('message')}
 * />
 *
 * // Required field
 * <Textarea required placeholder="Required field..." />
 *
 * // Custom rows
 * <Textarea rows={5} placeholder="Longer content..." />
 *
 * // Disabled
 * <Textarea disabled value="Cannot edit" />
 * ```
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows, required, testId = 'textarea', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        data-testid={testId}
        rows={rows ?? 3}
        required={required}
        aria-required={required ? true : undefined}
        className={cn(
          'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
