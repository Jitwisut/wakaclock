'use client';

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * AlertDialog component props
 *
 * @description Props for the AlertDialog root component.
 * Controls the open state and provides callbacks for state changes.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/alert-dialog
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
 */
export type AlertDialogProps = React.ComponentProps<typeof AlertDialogPrimitive.Root>;

/**
 * AlertDialogTrigger component props
 *
 * @description Props for the element that opens the alert dialog.
 * Can be rendered as a child element using `asChild` prop.
 */
export type AlertDialogTriggerProps = React.ComponentProps<typeof AlertDialogPrimitive.Trigger> & {
  /**
   * Custom test ID for testing
   * @default 'alert-dialog-trigger'
   */
  testId?: string;
};

/** AlertDialogPortal component props */
export type AlertDialogPortalProps = React.ComponentProps<typeof AlertDialogPrimitive.Portal>;

/** AlertDialogOverlay component props */
export type AlertDialogOverlayProps = React.ComponentProps<typeof AlertDialogPrimitive.Overlay>;

/**
 * AlertDialogContent component props
 *
 * @description Props for the main dialog content container.
 * Includes accessibility IDs for title and description linking.
 */
export type AlertDialogContentProps = React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  /**
   * ID for the title element for accessibility
   * @description Links to AlertDialogTitle via aria-labelledby
   */
  titleId?: string;
  /**
   * ID for the description element for accessibility
   * @description Links to AlertDialogDescription via aria-describedby
   */
  descriptionId?: string;
  /**
   * Custom test ID for testing
   * @default 'alert-dialog-content'
   */
  testId?: string;
};

/** AlertDialogHeader component props */
export type AlertDialogHeaderProps = React.ComponentProps<'div'>;

/** AlertDialogFooter component props */
export type AlertDialogFooterProps = React.ComponentProps<'div'>;

/** AlertDialogTitle component props */
export type AlertDialogTitleProps = React.ComponentProps<typeof AlertDialogPrimitive.Title>;

/** AlertDialogDescription component props */
export type AlertDialogDescriptionProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Description
>;

/** AlertDialogAction component props */
export type AlertDialogActionProps = React.ComponentProps<typeof AlertDialogPrimitive.Action>;

/** AlertDialogCancel component props */
export type AlertDialogCancelProps = React.ComponentProps<typeof AlertDialogPrimitive.Cancel>;

/**
 * AlertDialog component - Modal dialog requiring user acknowledgment
 *
 * @description
 * A modal dialog that interrupts the user with important content and expects
 * a response. Unlike regular dialogs, alert dialogs are specifically designed
 * for critical actions that require explicit user confirmation.
 *
 * ## Features
 * - **Modal Behavior**: Blocks interaction with the rest of the page
 * - **Focus Trapping**: Keeps focus within the dialog
 * - **Keyboard Navigation**: Escape key support (when appropriate)
 * - **WCAG 2.1 Compliant**: Proper ARIA attributes and focus management
 * - **Animated**: Smooth open/close animations
 *
 * ## Accessibility
 * - Uses `role="alertdialog"` for semantic meaning
 * - `aria-modal="true"` indicates modal behavior
 * - `aria-labelledby` references the title
 * - `aria-describedby` references the description
 * - Focus is trapped within the dialog when open
 *
 * ## Use Cases
 * - Confirming destructive actions (delete, remove)
 * - Warning users about irreversible operations
 * - Requiring explicit acknowledgment of important information
 *
 * @example
 * ```tsx
 * // Basic confirmation dialog
 * <AlertDialog>
 *   <AlertDialogTrigger asChild>
 *     <Button variant="destructive">Delete Account</Button>
 *   </AlertDialogTrigger>
 *   <AlertDialogContent>
 *     <AlertDialogHeader>
 *       <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
 *       <AlertDialogDescription>
 *         This action cannot be undone. This will permanently delete your
 *         account and remove your data from our servers.
 *       </AlertDialogDescription>
 *     </AlertDialogHeader>
 *     <AlertDialogFooter>
 *       <AlertDialogCancel>Cancel</AlertDialogCancel>
 *       <AlertDialogAction>Continue</AlertDialogAction>
 *     </AlertDialogFooter>
 *   </AlertDialogContent>
 * </AlertDialog>
 *
 * // Controlled alert dialog
 * const [open, setOpen] = useState(false);
 * <AlertDialog open={open} onOpenChange={setOpen}>
 *   ...
 * </AlertDialog>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/alert-dialog
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
 */
function AlertDialog({ ...props }: AlertDialogProps) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}
AlertDialog.displayName = 'AlertDialog';

/**
 * AlertDialogTrigger component - Element that opens the dialog
 *
 * @description
 * The button or element that opens the alert dialog when activated.
 * Uses `asChild` prop to render as a custom element while preserving behavior.
 *
 * @example
 * ```tsx
 * // Default button trigger
 * <AlertDialogTrigger>Open Dialog</AlertDialogTrigger>
 *
 * // Custom button trigger
 * <AlertDialogTrigger asChild>
 *   <Button variant="destructive">Delete</Button>
 * </AlertDialogTrigger>
 * ```
 */
const AlertDialogTrigger = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Trigger>,
  AlertDialogTriggerProps
>(({ testId = 'alert-dialog-trigger', ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Trigger
      ref={ref}
      data-slot="alert-dialog-trigger"
      data-testid={testId}
      {...props}
    />
  );
});
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

/** AlertDialogPortal component - portal for rendering outside DOM hierarchy */
function AlertDialogPortal({ ...props }: AlertDialogPortalProps) {
  return <AlertDialogPrimitive.Portal {...props} />;
}
AlertDialogPortal.displayName = 'AlertDialogPortal';

/** AlertDialogOverlay component - backdrop behind the dialog */
const AlertDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Overlay>,
  AlertDialogOverlayProps
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      data-slot="alert-dialog-overlay"
      data-testid="alert-dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  );
});
AlertDialogOverlay.displayName = 'AlertDialogOverlay';

/**
 * AlertDialogContent component - Main container for dialog content
 *
 * @description
 * The main content container for the alert dialog. Includes the overlay,
 * animations, and proper ARIA attributes for accessibility.
 *
 * ## Features
 * - **Centered**: Positioned center of viewport
 * - **Animated**: Fade and zoom animations
 * - **Responsive**: Adapts to screen size with max-width
 * - **Focus Trap**: Keeps keyboard focus within dialog
 *
 * @example
 * ```tsx
 * <AlertDialogContent>
 *   <AlertDialogHeader>
 *     <AlertDialogTitle>Confirm Action</AlertDialogTitle>
 *     <AlertDialogDescription>
 *       This will permanently delete the item.
 *     </AlertDialogDescription>
 *   </AlertDialogHeader>
 *   <AlertDialogFooter>
 *     <AlertDialogCancel>Cancel</AlertDialogCancel>
 *     <AlertDialogAction>Delete</AlertDialogAction>
 *   </AlertDialogFooter>
 * </AlertDialogContent>
 * ```
 */
const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(({ className, titleId, descriptionId, testId = 'alert-dialog-content', ...props }, ref) => {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        data-slot="alert-dialog-content"
        data-testid={testId}
        role="alertdialog"
        aria-modal="true"
        {...(titleId ? { 'aria-labelledby': titleId } : {})}
        {...(descriptionId ? { 'aria-describedby': descriptionId } : {})}
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = 'AlertDialogContent';

/** AlertDialogHeader component - container for title and description */
const AlertDialogHeader = React.forwardRef<HTMLDivElement, AlertDialogHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="alert-dialog-header"
        data-testid="alert-dialog-header"
        className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
        {...props}
      />
    );
  }
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

/** AlertDialogFooter component - container for action buttons */
const AlertDialogFooter = React.forwardRef<HTMLDivElement, AlertDialogFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="alert-dialog-footer"
        data-testid="alert-dialog-footer"
        className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
        {...props}
      />
    );
  }
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

/** AlertDialogTitle component - accessible title for the dialog */
const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Title>,
  AlertDialogTitleProps
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      data-slot="alert-dialog-title"
      data-testid="alert-dialog-title"
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  );
});
AlertDialogTitle.displayName = 'AlertDialogTitle';

/** AlertDialogDescription component - accessible description text */
const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Description>,
  AlertDialogDescriptionProps
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      data-slot="alert-dialog-description"
      data-testid="alert-dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
});
AlertDialogDescription.displayName = 'AlertDialogDescription';

/** AlertDialogAction component - primary action button */
const AlertDialogAction = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Action>,
  AlertDialogActionProps
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Action
      ref={ref}
      data-slot="alert-dialog-action"
      data-testid="alert-dialog-action"
      className={cn(buttonVariants(), className)}
      {...props}
    />
  );
});
AlertDialogAction.displayName = 'AlertDialogAction';

/** AlertDialogCancel component - cancel/dismiss button */
const AlertDialogCancel = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Cancel>,
  AlertDialogCancelProps
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Cancel
      ref={ref}
      data-slot="alert-dialog-cancel"
      data-testid="alert-dialog-cancel"
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = 'AlertDialogCancel';

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
