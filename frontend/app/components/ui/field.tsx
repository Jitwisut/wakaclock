'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

/**
 * FieldSet component props
 *
 * @description Props for the FieldSet semantic container.
 */
export type FieldSetProps = React.ComponentProps<'fieldset'> & {
  /**
   * Custom test ID for testing
   * @default 'field-set'
   */
  testId?: string;
};

/**
 * FieldSet component - Semantic fieldset for form field groups
 *
 * @description
 * A semantic HTML fieldset container that groups related form fields.
 * Use with FieldLegend for accessible field grouping.
 *
 * ## Features
 * - **Semantic HTML**: Uses native fieldset element
 * - **Auto-spacing**: Adjusts gap for checkbox/radio groups
 * - **Accessible**: Works with FieldLegend for screen readers
 *
 * @example
 * ```tsx
 * <FieldSet>
 *   <FieldLegend>Personal Information</FieldLegend>
 *   <Field>
 *     <FieldLabel>Name</FieldLabel>
 *     <Input />
 *   </Field>
 *   <Field>
 *     <FieldLabel>Email</FieldLabel>
 *     <Input type="email" />
 *   </Field>
 * </FieldSet>
 * ```
 */
const FieldSet = React.forwardRef<HTMLFieldSetElement, FieldSetProps>(
  ({ className, testId = 'field-set', ...props }, ref) => {
    return (
      <fieldset
        ref={ref}
        data-slot="field-set"
        data-testid={testId}
        className={cn(
          'flex flex-col gap-6',
          'has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3',
          className
        )}
        {...props}
      />
    );
  }
);
FieldSet.displayName = 'FieldSet';

/** FieldLegend component props */
export type FieldLegendProps = React.ComponentProps<'legend'> & {
  /** Display variant */
  variant?: 'legend' | 'label';
};

/** FieldLegend component - legend for fieldset grouping */
const FieldLegend = React.forwardRef<HTMLLegendElement, FieldLegendProps>(
  ({ className, variant = 'legend', ...props }, ref) => {
    return (
      <legend
        ref={ref}
        data-slot="field-legend"
        data-testid="field-legend"
        data-variant={variant}
        className={cn(
          'mb-3 font-medium',
          'data-[variant=legend]:text-base',
          'data-[variant=label]:text-sm',
          className
        )}
        {...props}
      />
    );
  }
);
FieldLegend.displayName = 'FieldLegend';

/** FieldGroup component props */
export type FieldGroupProps = React.ComponentProps<'div'>;

/** FieldGroup component - container for multiple fields */
const FieldGroup = React.forwardRef<HTMLDivElement, FieldGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="field-group"
        data-testid="field-group"
        className={cn(
          'group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4',
          className
        )}
        {...props}
      />
    );
  }
);
FieldGroup.displayName = 'FieldGroup';

const fieldVariants = cva('group/field data-[invalid=true]:text-destructive flex w-full gap-3', {
  variants: {
    orientation: {
      vertical: ['flex-col [&>*]:w-full [&>.sr-only]:w-auto'],
      horizontal: [
        'flex-row items-center',
        '[&>[data-slot=field-label]]:flex-auto',
        'has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
      ],
      responsive: [
        'flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto',
        '@md/field-group:[&>[data-slot=field-label]]:flex-auto',
        '@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
      ],
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
});

/**
 * Field component props
 *
 * @description Props for the Field container component.
 */
export type FieldProps = React.ComponentProps<'div'> &
  VariantProps<typeof fieldVariants> & {
    /**
     * Custom test ID for testing
     * @default 'field'
     */
    testId?: string;
  };

/**
 * Field component - Individual form field container
 *
 * @description
 * A container for individual form fields supporting multiple
 * layout orientations. Provides consistent spacing and alignment.
 *
 * ## Features
 * - **Orientations**: vertical, horizontal, responsive
 * - **Invalid State**: Automatic styling via data-invalid attribute
 * - **Composable**: Works with FieldLabel, FieldContent, FieldDescription, FieldError
 * - **Container Queries**: Responsive layout uses @container queries
 *
 * ## Orientations
 * - `vertical`: Label above input (default)
 * - `horizontal`: Label beside input
 * - `responsive`: Vertical on mobile, horizontal on larger screens
 *
 * @example
 * ```tsx
 * // Vertical layout (default)
 * <Field>
 *   <FieldLabel>Username</FieldLabel>
 *   <FieldContent>
 *     <Input />
 *     <FieldDescription>Choose a unique username</FieldDescription>
 *   </FieldContent>
 * </Field>
 *
 * // Horizontal layout
 * <Field orientation="horizontal">
 *   <FieldLabel>Email</FieldLabel>
 *   <Input type="email" />
 * </Field>
 *
 * // With validation error
 * <Field data-invalid="true">
 *   <FieldLabel>Password</FieldLabel>
 *   <Input type="password" aria-invalid />
 *   <FieldError>Password must be at least 8 characters</FieldError>
 * </Field>
 * ```
 */
const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, orientation = 'vertical', testId = 'field', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        data-slot="field"
        data-testid={testId}
        data-orientation={orientation}
        className={cn(fieldVariants({ orientation }), className)}
        {...props}
      />
    );
  }
);
Field.displayName = 'Field';

/** FieldContent component props */
export type FieldContentProps = React.ComponentProps<'div'>;

/** FieldContent component - content area for field inputs */
const FieldContent = React.forwardRef<HTMLDivElement, FieldContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="field-content"
        data-testid="field-content"
        className={cn('group/field-content flex flex-1 flex-col gap-1.5 leading-snug', className)}
        {...props}
      />
    );
  }
);
FieldContent.displayName = 'FieldContent';

/** FieldLabel component props */
export type FieldLabelProps = React.ComponentProps<typeof Label>;

/** FieldLabel component - accessible label for field inputs */
const FieldLabel = React.forwardRef<React.ComponentRef<typeof Label>, FieldLabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <Label
        ref={ref}
        data-slot="field-label"
        data-testid="field-label"
        className={cn(
          'group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50',
          'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4',
          'has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10',
          className
        )}
        {...props}
      />
    );
  }
);
FieldLabel.displayName = 'FieldLabel';

/** FieldTitle component props */
export type FieldTitleProps = React.ComponentProps<'div'>;

/** FieldTitle component - title text for field */
const FieldTitle = React.forwardRef<HTMLDivElement, FieldTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="field-label"
        data-testid="field-title"
        className={cn(
          'flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
FieldTitle.displayName = 'FieldTitle';

/** FieldDescription component props */
export type FieldDescriptionProps = React.ComponentProps<'p'>;

/** FieldDescription component - helper text for field */
const FieldDescription = React.forwardRef<HTMLParagraphElement, FieldDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        data-slot="field-description"
        data-testid="field-description"
        className={cn(
          'text-muted-foreground text-sm leading-normal font-normal group-has-[[data-orientation=horizontal]]/field:text-balance',
          'last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5',
          '[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
          className
        )}
        {...props}
      />
    );
  }
);
FieldDescription.displayName = 'FieldDescription';

/** FieldSeparator component props */
export type FieldSeparatorProps = React.ComponentProps<'div'> & {
  /** Optional text content in separator */
  children?: React.ReactNode;
};

/** FieldSeparator component - divider between fields */
const FieldSeparator = React.forwardRef<HTMLDivElement, FieldSeparatorProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="field-separator"
        data-testid="field-separator"
        data-content={!!children}
        className={cn(
          'relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2',
          className
        )}
        {...props}
      >
        <Separator className="absolute inset-0 top-1/2" />
        {children && (
          <span
            className="bg-background text-muted-foreground relative mx-auto block w-fit px-2"
            data-slot="field-separator-content"
            data-testid="field-separator-content"
          >
            {children}
          </span>
        )}
      </div>
    );
  }
);
FieldSeparator.displayName = 'FieldSeparator';

/** FieldError component props */
export type FieldErrorProps = React.ComponentProps<'div'> & {
  /** Array of error objects with messages */
  errors?: Array<{ message?: string } | undefined>;
};

/**
 * FieldError component - displays validation errors
 * Supports single or multiple error messages
 */
const FieldError = React.forwardRef<HTMLDivElement, FieldErrorProps>(
  ({ className, children, errors, ...props }, ref) => {
    const content = React.useMemo(() => {
      if (children) {
        return children;
      }

      if (!errors?.length) {
        return null;
      }

      const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];

      if (uniqueErrors?.length == 1) {
        return uniqueErrors[0]?.message;
      }

      return (
        <ul className="ml-4 flex list-disc flex-col gap-1">
          {uniqueErrors.map(
            (error) => error?.message && <li key={`error-${error.message}`}>{error.message}</li>
          )}
        </ul>
      );
    }, [children, errors]);

    if (!content) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        data-slot="field-error"
        data-testid="field-error"
        className={cn('text-destructive text-sm font-normal', className)}
        {...props}
      >
        {content}
      </div>
    );
  }
);
FieldError.displayName = 'FieldError';

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
  fieldVariants,
};
