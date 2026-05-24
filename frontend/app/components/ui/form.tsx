'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

/**
 * FormItem component props
 *
 * @description Props for the FormItem container component.
 * @see https://react-hook-form.com/
 */
export type FormItemProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'form-item'
   */
  testId?: string;
};

/** FormLabel component props */
export type FormLabelProps = React.ComponentProps<typeof LabelPrimitive.Root>;

/** FormControl component props */
export type FormControlProps = React.ComponentProps<typeof Slot>;

/** FormDescription component props */
export type FormDescriptionProps = React.ComponentProps<'p'>;

/** FormMessage component props */
export type FormMessageProps = React.ComponentProps<'p'>;

/**
 * Form component - React Hook Form integration
 *
 * @description
 * A complete form system built on React Hook Form. Provides
 * context-based field management with automatic ID generation.
 *
 * ## Features
 * - **React Hook Form Integration**: Full RHF feature support
 * - **Automatic IDs**: Generated IDs for label/input association
 * - **Validation**: Built-in error display with FormMessage
 * - **Accessible**: ARIA attributes managed automatically
 * - **Type-Safe**: Full TypeScript support with generics
 *
 * ## Components
 * - `Form` - Provider wrapper (FormProvider)
 * - `FormField` - Field registration with Controller
 * - `FormItem` - Container for field elements
 * - `FormLabel` - Accessible label
 * - `FormControl` - Input wrapper with ARIA
 * - `FormDescription` - Help text
 * - `FormMessage` - Validation error display
 *
 * ## Accessibility
 * - Auto-generated `aria-describedby` linking
 * - `aria-invalid` on validation errors
 * - `role="alert"` for error messages
 * - Proper label/input association
 *
 * @example
 * ```tsx
 * const form = useForm<FormValues>({
 *   resolver: zodResolver(schema),
 * });
 *
 * <Form {...form}>
 *   <form onSubmit={form.handleSubmit(onSubmit)}>
 *     <FormField
 *       control={form.control}
 *       name="email"
 *       render={({ field }) => (
 *         <FormItem>
 *           <FormLabel>Email</FormLabel>
 *           <FormControl>
 *             <Input {...field} />
 *           </FormControl>
 *           <FormDescription>
 *             We'll never share your email.
 *           </FormDescription>
 *           <FormMessage />
 *         </FormItem>
 *       )}
 *     />
 *     <Button type="submit">Submit</Button>
 *   </form>
 * </Form>
 * ```
 *
 * @see https://react-hook-form.com/
 * @see https://zod.dev/
 */
const Form = FormProvider;

/** Form field context value for internal use */
type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

/** Form field context for sharing field state */
const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

/**
 * FormField component - connects form input to react-hook-form
 * Provides field context for nested form components
 */
const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <div data-slot="form-field" data-testid={`form-field-${String(props.name)}`}>
        <Controller {...props} />
      </div>
    </FormFieldContext.Provider>
  );
};

/** Hook to access form field state and IDs */
const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>');
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

/** Form item context value for internal use */
type FormItemContextValue = {
  id: string;
};

/** Form item context for sharing item state */
const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

/**
 * FormItem component - Container for form field elements
 *
 * @description
 * Wraps form field components and provides context for ID generation.
 * Links labels, descriptions, and error messages automatically.
 */
const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
  ({ className, testId = 'form-item', ...props }, ref) => {
    const id = React.useId();

    return (
      <FormItemContext.Provider value={{ id }}>
        <div
          ref={ref}
          data-slot="form-item"
          data-testid={testId}
          className={cn('grid gap-2', className)}
          {...props}
        />
      </FormItemContext.Provider>
    );
  }
);
FormItem.displayName = 'FormItem';

/** FormLabel component - accessible label for form fields */
const FormLabel = React.forwardRef<React.ComponentRef<typeof LabelPrimitive.Root>, FormLabelProps>(
  ({ className, ...props }, ref) => {
    const { error, formItemId } = useFormField();

    return (
      <Label
        ref={ref}
        data-slot="form-label"
        data-testid="form-label"
        data-error={!!error}
        className={cn('data-[error=true]:text-destructive', className)}
        htmlFor={formItemId}
        {...props}
      />
    );
  }
);
FormLabel.displayName = 'FormLabel';

/** FormControl component - connects input to form field */
const FormControl = React.forwardRef<React.ComponentRef<typeof Slot>, FormControlProps>(
  ({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

    return (
      <Slot
        ref={ref}
        data-slot="form-control"
        data-testid="form-control"
        id={formItemId}
        aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
        aria-invalid={!!error}
        {...props}
      />
    );
  }
);
FormControl.displayName = 'FormControl';

/** FormDescription component - help text for form fields */
const FormDescription = React.forwardRef<HTMLParagraphElement, FormDescriptionProps>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField();

    return (
      <p
        ref={ref}
        data-slot="form-description"
        data-testid="form-description"
        id={formDescriptionId}
        className={cn('text-muted-foreground text-sm', className)}
        {...props}
      />
    );
  }
);
FormDescription.displayName = 'FormDescription';

/** FormMessage component - displays validation error messages */
const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, ...props }, ref) => {
    const { error, formMessageId } = useFormField();
    const body = error ? String(error?.message ?? '') : props.children;

    if (!body) {
      return null;
    }

    return (
      <p
        ref={ref}
        role="alert"
        aria-live="polite"
        data-slot="form-message"
        data-testid="form-message"
        id={formMessageId}
        className={cn('text-destructive text-sm', className)}
        {...props}
      >
        {body}
      </p>
    );
  }
);
FormMessage.displayName = 'FormMessage';

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
};
