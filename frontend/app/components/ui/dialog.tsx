'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Dialog component props
 *
 * @description Props for the Dialog root component.
 * Controls the open state and provides callbacks for state changes.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/dialog
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */
export type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root>;

/**
 * DialogTrigger component props
 *
 * @description Props for the element that opens the dialog.
 */
export type DialogTriggerProps = React.ComponentProps<typeof DialogPrimitive.Trigger> & {
  /**
   * Custom test ID for testing
   * @default 'dialog-trigger'
   */
  testId?: string;
};

/** DialogPortal component props */
export type DialogPortalProps = React.ComponentProps<typeof DialogPrimitive.Portal>;

/** DialogClose component props */
export type DialogCloseProps = React.ComponentProps<typeof DialogPrimitive.Close>;

/** DialogOverlay component props */
export type DialogOverlayProps = React.ComponentProps<typeof DialogPrimitive.Overlay>;

/**
 * DialogContent component props
 *
 * @description Props for the main dialog content container.
 */
export type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  /**
   * Whether to show the close icon button
   * @default true
   */
  showCloseIcon?: boolean;
  /**
   * Custom test ID for testing
   * @default 'dialog-content'
   */
  testId?: string;
};

/** DialogHeader component props */
export type DialogHeaderProps = React.ComponentProps<'div'>;

/** DialogFooter component props */
export type DialogFooterProps = React.ComponentProps<'div'>;

/** DialogTitle component props */
export type DialogTitleProps = React.ComponentProps<typeof DialogPrimitive.Title>;

/** DialogDescription component props */
export type DialogDescriptionProps = React.ComponentProps<typeof DialogPrimitive.Description>;

/**
 * Dialog component - Modal dialog for displaying content
 *
 * @description
 * A window overlaid on the primary window, rendering content above
 * the main application. Uses context to link title and description
 * for accessibility.
 *
 * ## Features
 * - **Modal Behavior**: Blocks interaction with background
 * - **Focus Trapping**: Keeps focus within dialog
 * - **Escape Key**: Closes dialog on Escape
 * - **Click Outside**: Optional close on outside click
 * - **WCAG 2.1 Compliant**: Proper ARIA attributes
 *
 * ## Accessibility
 * - Auto-generated IDs for title/description linking
 * - `aria-modal="true"` on content
 * - `aria-labelledby` and `aria-describedby` auto-linked
 * - Focus returned to trigger on close
 *
 * @example
 * ```tsx
 * // Basic dialog
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>Open Dialog</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Edit Profile</DialogTitle>
 *       <DialogDescription>
 *         Make changes to your profile here.
 *       </DialogDescription>
 *     </DialogHeader>
 *     <div className="grid gap-4 py-4">
 *       <Input placeholder="Name" />
 *     </div>
 *     <DialogFooter>
 *       <Button type="submit">Save changes</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 *
 * // Controlled dialog
 * const [open, setOpen] = useState(false);
 * <Dialog open={open} onOpenChange={setOpen}>
 *   ...
 * </Dialog>
 *
 * // Without close icon
 * <DialogContent showCloseIcon={false}>
 *   ...
 * </DialogContent>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/dialog
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */
function Dialog({ ...props }: DialogProps) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}
Dialog.displayName = 'Dialog';

/**
 * DialogTrigger component - Element that opens the dialog
 *
 * @description
 * The button or element that opens the dialog when activated.
 * Use `asChild` to render a custom element.
 */
const DialogTrigger = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Trigger>,
  DialogTriggerProps
>(({ testId = 'dialog-trigger', ...props }, ref) => {
  return (
    <DialogPrimitive.Trigger ref={ref} data-slot="dialog-trigger" data-testid={testId} {...props} />
  );
});
DialogTrigger.displayName = 'DialogTrigger';

/** DialogPortal component - portal for rendering outside DOM hierarchy */
function DialogPortal({ ...props }: DialogPortalProps) {
  return <DialogPrimitive.Portal {...props} />;
}
DialogPortal.displayName = 'DialogPortal';

/** DialogClose component - button to close the dialog */
const DialogClose = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Close>,
  DialogCloseProps
>(({ ...props }, ref) => {
  return (
    <DialogPrimitive.Close
      ref={ref}
      data-slot="dialog-close"
      data-testid="dialog-close"
      {...props}
    />
  );
});
DialogClose.displayName = 'DialogClose';

/** DialogOverlay component - backdrop behind the dialog */
const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      data-testid="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = 'DialogOverlay';

/**
 * DialogContent component - Main container for dialog content
 *
 * @description
 * The main content container for the dialog. Includes overlay,
 * animations, and optional close button.
 */
const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ showCloseIcon = true, className, children, testId = 'dialog-content', ...props }, ref) => {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        data-testid={testId}
        aria-modal="true"
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
          className
        )}
        {...props}
      >
        {children}
        {showCloseIcon && (
          <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
            <XIcon aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = 'DialogContent';

/** DialogHeader component - container for title and description */
const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="dialog-header"
        data-testid="dialog-header"
        className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
        {...props}
      />
    );
  }
);
DialogHeader.displayName = 'DialogHeader';

/** DialogFooter component - container for action buttons */
const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="dialog-footer"
        data-testid="dialog-footer"
        className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
        {...props}
      />
    );
  }
);
DialogFooter.displayName = 'DialogFooter';

/** DialogTitle component - accessible title for the dialog */
const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  DialogTitleProps
>(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Title
      ref={ref}
      data-slot="dialog-title"
      data-testid="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  );
});
DialogTitle.displayName = 'DialogTitle';

/** DialogDescription component - accessible description text */
const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  DialogDescriptionProps
>(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Description
      ref={ref}
      data-slot="dialog-description"
      data-testid="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
});
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
