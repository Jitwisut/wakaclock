import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Input component props
 *
 * @description Props for the Input text field component.
 */
export type InputProps = React.ComponentProps<'input'> & {
  /**
   * Custom test ID for testing
   * @default 'input'
   */
  testId?: string;
};

/**
 * Input component - Text input field with form integration
 *
 * @description
 * A styled text input component that supports all native input types
 * with built-in validation states and accessibility features.
 *
 * ## Features
 * - **All Input Types**: text, email, password, number, tel, url, search, etc.
 * - **Validation States**: Visual feedback via aria-invalid
 * - **File Inputs**: Styled file upload support
 * - **Focus States**: Visible focus ring for accessibility
 * - **Dark Mode**: Automatic dark mode styling
 *
 * ## Supported Types
 * - `text` - Standard text input (default)
 * - `email` - Email address with validation
 * - `password` - Masked password field
 * - `number` - Numeric input with spinner
 * - `tel` - Telephone number
 * - `url` - URL with validation
 * - `search` - Search with clear button
 * - `file` - File upload
 * - `date`, `time`, `datetime-local` - Date/time pickers
 *
 * ## Accessibility
 * - `aria-required` for required fields
 * - `aria-invalid` for validation errors
 * - Visible focus indicators
 * - Works with FormControl for full ARIA support
 *
 * @example
 * ```tsx
 * // Basic text input
 * <Input placeholder="Enter your name" />
 *
 * // Email with validation
 * <Input type="email" required />
 *
 * // Password field
 * <Input type="password" placeholder="••••••••" />
 *
 * // With error state
 * <Input aria-invalid="true" className="..." />
 *
 * // File upload
 * <Input type="file" accept="image/*" />
 *
 * // Within a form field
 * <Field>
 *   <FieldLabel>Username</FieldLabel>
 *   <Input required />
 *   <FieldError>Username is required</FieldError>
 * </Field>
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, required, testId = 'input', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type ?? 'text'}
        data-slot="input"
        data-testid={testId}
        required={required}
        aria-required={required ? true : undefined}
        aria-invalid={props['aria-invalid'] ?? undefined}
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
