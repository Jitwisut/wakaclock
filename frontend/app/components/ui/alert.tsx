import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { useId } from 'react';

/**
 * Alert variant styles using class-variance-authority
 *
 * @description Defines the visual variants for the Alert component.
 * Uses CSS grid layout with conditional columns based on SVG presence.
 *
 * @see https://cva.style/docs
 */
const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Alert component props
 *
 * @description Props for the Alert container component.
 * Extends native div props with variant styling options.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/alert/
 */
export type AlertProps = React.ComponentProps<'div'> &
  VariantProps<typeof alertVariants> & {
    /**
     * Custom test ID for testing
     * @default 'alert'
     */
    testId?: string;
  };

/**
 * Alert component - Displays important messages to users
 *
 * @description
 * A component for displaying brief, important messages in a way that
 * attracts the user's attention without interrupting their task.
 * Built with accessibility in mind using ARIA live regions.
 *
 * ## Features
 * - **Semantic HTML**: Uses appropriate ARIA attributes
 * - **Live Regions**: Announces content changes to screen readers
 * - **Variants**: Default (polite) and destructive (assertive) modes
 * - **Icon Support**: Automatic grid layout when icons are present
 * - **WCAG 2.1 Compliant**: Proper color contrast and announcements
 *
 * ## Accessibility
 * - Uses `role="alert"` for semantic meaning
 * - `aria-live="polite"` for default variant (non-interrupting)
 * - `aria-live="assertive"` for destructive variant (immediate)
 * - `aria-atomic="true"` to announce entire content
 *
 * @example
 * ```tsx
 * // Basic alert
 * <Alert>
 *   <AlertTitle>Heads up!</AlertTitle>
 *   <AlertDescription>
 *     You can add components to your app using the CLI.
 *   </AlertDescription>
 * </Alert>
 *
 * // Destructive alert with icon
 * <Alert variant="destructive">
 *   <AlertCircle className="size-4" />
 *   <AlertTitle>Error</AlertTitle>
 *   <AlertDescription>
 *     Your session has expired. Please log in again.
 *   </AlertDescription>
 * </Alert>
 *
 * // Info alert with icon
 * <Alert>
 *   <InfoIcon className="size-4" />
 *   <AlertTitle>Note</AlertTitle>
 *   <AlertDescription>
 *     This action cannot be undone.
 *   </AlertDescription>
 * </Alert>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/alert
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/alert/
 */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, testId = 'alert', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="alert"
        data-testid={testId}
        data-variant={variant}
        role="alert"
        aria-live={variant === 'destructive' ? 'assertive' : 'polite'}
        aria-atomic="true"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Alert.displayName = 'Alert';

/**
 * AlertTitle component props
 *
 * @description Props for the AlertTitle component.
 * Used for the main heading text of an alert.
 */
export type AlertTitleProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'alert-title'
   */
  testId?: string;
};

/**
 * AlertTitle component - Heading for the alert message
 *
 * @description
 * The title element for an Alert, styled as a prominent heading.
 * Should be used as the first text element within an Alert.
 *
 * @example
 * ```tsx
 * <Alert>
 *   <AlertTitle>Success!</AlertTitle>
 *   <AlertDescription>Your changes have been saved.</AlertDescription>
 * </Alert>
 * ```
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/alert/
 */
const AlertTitle = React.forwardRef<HTMLDivElement, AlertTitleProps>(
  ({ className, testId = 'alert-title', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="alert-title"
        data-testid={testId}
        className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
        {...props}
      />
    );
  }
);
AlertTitle.displayName = 'AlertTitle';

/**
 * AlertDescription component props
 *
 * @description Props for the AlertDescription component.
 * Used for the detailed content of an alert message.
 */
export type AlertDescriptionProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'alert-description'
   */
  testId?: string;
};

/**
 * AlertDescription component - Detailed message content
 *
 * @description
 * The description element for an Alert, containing the main
 * content or explanation. Automatically generates a unique ID
 * for accessibility linking.
 *
 * @example
 * ```tsx
 * <Alert>
 *   <AlertTitle>Note</AlertTitle>
 *   <AlertDescription>
 *     <p>Your session will expire in 5 minutes.</p>
 *     <p>Save your work to avoid losing changes.</p>
 *   </AlertDescription>
 * </Alert>
 * ```
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/alert/
 */
const AlertDescription = React.forwardRef<HTMLDivElement, AlertDescriptionProps>(
  ({ className, id, testId = 'alert-description', ...props }, ref) => {
    const generatedId = useId();
    const descriptionId = id ?? generatedId;
    return (
      <div
        ref={ref}
        id={descriptionId}
        data-slot="alert-description"
        data-testid={testId}
        className={cn(
          'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
          className
        )}
        {...props}
      />
    );
  }
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
