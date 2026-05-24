'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * ToastProvider component props
 * @see https://www.radix-ui.com/primitives/docs/components/toast
 */
export type ToastProviderProps = React.ComponentProps<typeof ToastPrimitives.Provider>;

/** ToastViewport component props */
export type ToastViewportProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport> & {
  /**
   * Custom test ID for testing
   * @default 'toast-viewport'
   */
  testId?: string;
};

/** ToastAction component props */
export type ToastActionProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action> & {
  /**
   * Custom test ID for testing
   * @default 'toast-action'
   */
  testId?: string;
};

/** ToastClose component props */
export type ToastCloseProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close> & {
  /**
   * Custom test ID for testing
   * @default 'toast-close'
   */
  testId?: string;
};

/** ToastTitle component props */
export type ToastTitleProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title> & {
  /**
   * Custom test ID for testing
   * @default 'toast-title'
   */
  testId?: string;
};

/** ToastDescription component props */
export type ToastDescriptionProps = React.ComponentPropsWithoutRef<
  typeof ToastPrimitives.Description
> & {
  /**
   * Custom test ID for testing
   * @default 'toast-description'
   */
  testId?: string;
};

/** ToastProvider component - provides toast context */
function ToastProvider({ ...props }: ToastProviderProps) {
  return <ToastPrimitives.Provider {...props} />;
}
ToastProvider.displayName = 'ToastProvider';

/** ToastViewport component - container for toast notifications */
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  ToastViewportProps
>(({ className, testId = 'toast-viewport', ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    data-slot="toast-viewport"
    data-testid={testId}
    role="region"
    aria-live="polite"
    aria-label="Notifications"
    className={cn(
      'fixed top-0 z-100 flex max-h-screen w-full flex-col-reverse p-4 sm:top-auto sm:right-0 sm:bottom-0 sm:flex-col md:max-w-[420px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  'group data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full sm:data-[state=open]:slide-in-from-bottom-full pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground border',
        destructive:
          'destructive group border-destructive bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Toast component props
 *
 * @description Props for the Toast notification component.
 */
export type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants> & {
    /**
     * Custom test ID for testing
     * @default 'toast'
     */
    testId?: string;
  };

/** Toast action element type */
export type ToastActionElement = React.ReactElement<typeof ToastAction>;

/**
 * Toast component - Notification messages
 *
 * @description
 * A succinct message displayed temporarily to provide feedback or
 * information to users. Supports auto-dismiss and swipe-to-dismiss.
 *
 * ## Features
 * - **Auto-dismiss**: Configurable timeout
 * - **Swipe to Dismiss**: Touch-friendly dismissal
 * - **Variants**: Default and destructive styles
 * - **Actions**: Optional action buttons
 * - **Stacking**: Multiple toasts stack vertically
 * - **Animation**: Smooth enter/exit transitions
 *
 * ## Use Cases
 * - Success/error feedback after actions
 * - System notifications
 * - Undo opportunities
 * - Brief informational messages
 *
 * ## vs Sonner
 * - **Toast**: Radix-based, more customizable styling
 * - **Sonner**: Feature-rich, promise-based toasts
 *
 * ## Accessibility
 * - `aria-live="polite"` for screen readers
 * - Role="region" on viewport
 * - Keyboard dismissible
 * - Focus management
 *
 * @example
 * ```tsx
 * // Basic usage with useToast hook
 * const { toast } = useToast();
 *
 * toast({
 *   title: "Success!",
 *   description: "Your changes have been saved.",
 * });
 *
 * // Destructive variant
 * toast({
 *   variant: "destructive",
 *   title: "Error",
 *   description: "Something went wrong.",
 * });
 *
 * // With action
 * toast({
 *   title: "File deleted",
 *   action: <ToastAction altText="Undo">Undo</ToastAction>,
 * });
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/toast
 */
const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Root>, ToastProps>(
  ({ className, variant, testId = 'toast', ...props }, ref) => {
    return (
      <ToastPrimitives.Root
        ref={ref}
        data-slot="toast"
        data-testid={testId}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Toast.displayName = ToastPrimitives.Root.displayName;

/** ToastAction component - action button within toast */
const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  ToastActionProps
>(({ className, testId = 'toast-action', ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    data-slot="toast-action"
    data-testid={testId}
    className={cn(
      'ring-offset-background hover:bg-secondary focus:ring-ring group-[.destructive]:border-muted/40 hover:group-[.destructive]:border-destructive/30 hover:group-[.destructive]:bg-destructive hover:group-[.destructive]:text-destructive-foreground focus:group-[.destructive]:ring-destructive inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

/** ToastClose component - button to dismiss toast */
const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  ToastCloseProps
>(({ className, testId = 'toast-close', ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    data-slot="toast-close"
    data-testid={testId}
    className={cn(
      'text-foreground/50 hover:text-foreground absolute top-2 right-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 group-[.destructive]:text-red-300 hover:group-[.destructive]:text-red-50 focus:opacity-100 focus:ring-2 focus:outline-hidden focus:group-[.destructive]:ring-red-400 focus:group-[.destructive]:ring-offset-red-600',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" aria-hidden="true" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

/** ToastTitle component - title text for toast */
const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  ToastTitleProps
>(({ className, testId = 'toast-title', ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    data-slot="toast-title"
    data-testid={testId}
    className={cn('text-sm font-semibold', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

/** ToastDescription component - description text for toast */
const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  ToastDescriptionProps
>(({ className, testId = 'toast-description', ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    data-slot="toast-description"
    data-testid={testId}
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastVariants,
};
