'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Sheet component props
 *
 * @description Props for the Sheet sliding panel component.
 * @see https://www.radix-ui.com/primitives/docs/components/dialog
 */
export type SheetProps = React.ComponentProps<typeof SheetPrimitive.Root>;

/** SheetTrigger component props */
export type SheetTriggerProps = React.ComponentProps<typeof SheetPrimitive.Trigger> & {
  /**
   * Custom test ID for testing
   * @default 'sheet-trigger'
   */
  testId?: string;
};

/** SheetClose component props */
export type SheetCloseProps = React.ComponentProps<typeof SheetPrimitive.Close>;

/** SheetPortal component props */
export type SheetPortalProps = React.ComponentProps<typeof SheetPrimitive.Portal>;

/** SheetOverlay component props */
export type SheetOverlayProps = React.ComponentProps<typeof SheetPrimitive.Overlay>;

/**
 * SheetContent component props
 *
 * @description Props for the main sheet content container.
 */
export type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> & {
  /** Side from which sheet slides in */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** ID for the title element for accessibility */
  titleId?: string;
  /**
   * Custom test ID for testing
   * @default 'sheet-content'
   */
  testId?: string;
};

/** SheetHeader component props */
export type SheetHeaderProps = React.ComponentProps<'div'>;

/** SheetFooter component props */
export type SheetFooterProps = React.ComponentProps<'div'>;

/** SheetTitle component props */
export type SheetTitleProps = React.ComponentProps<typeof SheetPrimitive.Title>;

/** SheetDescription component props */
export type SheetDescriptionProps = React.ComponentProps<typeof SheetPrimitive.Description>;

/**
 * Sheet component - Sliding panel overlay from screen edges
 *
 * @description
 * A modal panel that slides in from the edge of the screen.
 * Based on Dialog primitive with directional slide animations.
 *
 * ## Features
 * - **Four Directions**: Slides from top, right, bottom, or left
 * - **Modal Behavior**: Focus trap, backdrop overlay, Escape to close
 * - **Responsive**: Max-width constraints on side sheets
 * - **Accessible**: Proper ARIA attributes and focus management
 * - **Controlled/Uncontrolled**: Both modes supported
 *
 * ## Use Cases
 * - Mobile navigation drawers
 * - Filter/settings panels
 * - Shopping cart sidebars
 * - Detail views without leaving page
 * - Form panels
 *
 * ## vs Dialog
 * - **Sheet**: Edge-anchored, slides in, often full-height/width
 * - **Dialog**: Centered, scales up, typically smaller content
 *
 * ## Accessibility
 * - Focus trapped inside when open
 * - Escape key closes sheet
 * - Background scrolling disabled
 * - aria-modal and aria-labelledby support
 *
 * @example
 * ```tsx
 * // Basic sheet from right
 * <Sheet>
 *   <SheetTrigger asChild>
 *     <Button variant="outline">Open</Button>
 *   </SheetTrigger>
 *   <SheetContent>
 *     <SheetHeader>
 *       <SheetTitle>Edit profile</SheetTitle>
 *       <SheetDescription>
 *         Make changes to your profile here.
 *       </SheetDescription>
 *     </SheetHeader>
 *     <div className="py-4">
 *       // Form content here
 *     </div>
 *     <SheetFooter>
 *       <Button type="submit">Save changes</Button>
 *     </SheetFooter>
 *   </SheetContent>
 * </Sheet>
 *
 * // Sheet from left (navigation)
 * <Sheet>
 *   <SheetTrigger asChild>
 *     <Button size="icon" variant="ghost">
 *       <MenuIcon />
 *     </Button>
 *   </SheetTrigger>
 *   <SheetContent side="left">
 *     <nav>...</nav>
 *   </SheetContent>
 * </Sheet>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/dialog
 */
function Sheet({ ...props }: SheetProps) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}
Sheet.displayName = 'Sheet';

/** SheetTrigger component - element that opens the sheet */
const SheetTrigger = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Trigger>,
  SheetTriggerProps
>(({ testId = 'sheet-trigger', ...props }, ref) => {
  return (
    <SheetPrimitive.Trigger ref={ref} data-slot="sheet-trigger" data-testid={testId} {...props} />
  );
});
SheetTrigger.displayName = 'SheetTrigger';

/** SheetClose component - button to close the sheet */
const SheetClose = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Close>,
  SheetCloseProps
>(({ ...props }, ref) => {
  return (
    <SheetPrimitive.Close ref={ref} data-slot="sheet-close" data-testid="sheet-close" {...props} />
  );
});
SheetClose.displayName = 'SheetClose';

/** SheetPortal component - portal for rendering outside DOM hierarchy */
function SheetPortal({ ...props }: SheetPortalProps) {
  return <SheetPrimitive.Portal {...props} />;
}
SheetPortal.displayName = 'SheetPortal';

/** SheetOverlay component - backdrop behind the sheet */
const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Overlay>,
  SheetOverlayProps
>(({ className, ...props }, ref) => {
  return (
    <SheetPrimitive.Overlay
      ref={ref}
      data-slot="sheet-overlay"
      data-testid="sheet-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  );
});
SheetOverlay.displayName = 'SheetOverlay';

/** SheetContent component - main container for sheet content */
const SheetContent = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = 'right', titleId, testId = 'sheet-content', ...props }, ref) => {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        data-slot="sheet-content"
        data-testid={testId}
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
          side === 'right' &&
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
          side === 'left' &&
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
          side === 'top' &&
            'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
          side === 'bottom' &&
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          data-slot="sheet-close-button"
          data-testid="sheet-close-button"
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        >
          <XIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = 'SheetContent';

/** SheetHeader component - container for title and description */
const SheetHeader = React.forwardRef<HTMLDivElement, SheetHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="sheet-header"
        data-testid="sheet-header"
        className={cn('flex flex-col gap-1.5 p-4', className)}
        {...props}
      />
    );
  }
);
SheetHeader.displayName = 'SheetHeader';

/** SheetFooter component - container for action buttons */
const SheetFooter = React.forwardRef<HTMLDivElement, SheetFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="sheet-footer"
        data-testid="sheet-footer"
        className={cn('mt-auto flex flex-col gap-2 p-4', className)}
        {...props}
      />
    );
  }
);
SheetFooter.displayName = 'SheetFooter';

/** SheetTitle component - accessible title for the sheet */
const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Title>,
  SheetTitleProps
>(({ className, ...props }, ref) => {
  return (
    <SheetPrimitive.Title
      ref={ref}
      data-slot="sheet-title"
      data-testid="sheet-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  );
});
SheetTitle.displayName = 'SheetTitle';

/** SheetDescription component - accessible description text */
const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Description>,
  SheetDescriptionProps
>(({ className, ...props }, ref) => {
  return (
    <SheetPrimitive.Description
      ref={ref}
      data-slot="sheet-description"
      data-testid="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
});
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
