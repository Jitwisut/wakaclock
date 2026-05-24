'use client';

import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';

import { cn } from '@/lib/utils';

/**
 * Drawer component props
 *
 * @description Props for the Drawer root component.
 * Built on Vaul for smooth, gesture-driven drawer behavior.
 *
 * @see https://github.com/emilkowalski/vaul
 */
export type DrawerProps = React.ComponentProps<typeof DrawerPrimitive.Root>;

/** DrawerTrigger component props */
export type DrawerTriggerProps = React.ComponentProps<typeof DrawerPrimitive.Trigger>;

/** DrawerPortal component props */
export type DrawerPortalProps = React.ComponentProps<typeof DrawerPrimitive.Portal>;

/** DrawerClose component props */
export type DrawerCloseProps = React.ComponentProps<typeof DrawerPrimitive.Close>;

/** DrawerOverlay component props */
export type DrawerOverlayProps = React.ComponentProps<typeof DrawerPrimitive.Overlay>;

/** DrawerContent component props */
export type DrawerContentProps = React.ComponentProps<typeof DrawerPrimitive.Content>;

/** DrawerHeader component props */
export type DrawerHeaderProps = React.ComponentProps<'div'>;

/** DrawerFooter component props */
export type DrawerFooterProps = React.ComponentProps<'div'>;

/** DrawerTitle component props */
export type DrawerTitleProps = React.ComponentProps<typeof DrawerPrimitive.Title>;

/** DrawerDescription component props */
export type DrawerDescriptionProps = React.ComponentProps<typeof DrawerPrimitive.Description>;

/**
 * Drawer component - Slide-out panel from any edge
 *
 * @description
 * A panel that slides in from the edge of the screen.
 * Built on Vaul for smooth gesture-driven interactions.
 *
 * ## Features
 * - **Direction Support**: Top, bottom, left, right
 * - **Gesture Driven**: Swipe to dismiss on mobile
 * - **Snap Points**: Multiple snap positions
 * - **Nested Drawers**: Support for drawer within drawer
 * - **Responsive**: Different behavior on mobile/desktop
 *
 * ## Accessibility
 * - Focus trapped when open
 * - Escape key to close
 * - ARIA dialog attributes
 *
 * @example
 * ```tsx
 * // Basic drawer (bottom)
 * <Drawer>
 *   <DrawerTrigger asChild>
 *     <Button>Open Drawer</Button>
 *   </DrawerTrigger>
 *   <DrawerContent>
 *     <DrawerHeader>
 *       <DrawerTitle>Settings</DrawerTitle>
 *       <DrawerDescription>Adjust your preferences</DrawerDescription>
 *     </DrawerHeader>
 *     <div className="p-4">Content here</div>
 *     <DrawerFooter>
 *       <Button>Save</Button>
 *     </DrawerFooter>
 *   </DrawerContent>
 * </Drawer>
 *
 * // Side drawer
 * <Drawer direction="right">
 *   <DrawerTrigger>Open</DrawerTrigger>
 *   <DrawerContent>...</DrawerContent>
 * </Drawer>
 * ```
 *
 * @see https://github.com/emilkowalski/vaul
 */
const Drawer = ({ ...props }: DrawerProps) => {
  return <DrawerPrimitive.Root data-slot="drawer" data-testid="drawer" {...props} />;
};
Drawer.displayName = 'Drawer';

/** DrawerTrigger component - element that opens the drawer */
const DrawerTrigger = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Trigger>,
  DrawerTriggerProps
>(({ ...props }, ref) => {
  return (
    <DrawerPrimitive.Trigger
      ref={ref}
      data-slot="drawer-trigger"
      data-testid="drawer-trigger"
      {...props}
    />
  );
});
DrawerTrigger.displayName = 'DrawerTrigger';

/** DrawerPortal component - portal for rendering outside DOM hierarchy */
const DrawerPortal = ({ ...props }: DrawerPortalProps) => {
  return <DrawerPrimitive.Portal {...props} />;
};
DrawerPortal.displayName = 'DrawerPortal';

/** DrawerClose component - button to close the drawer */
const DrawerClose = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Close>,
  DrawerCloseProps
>(({ ...props }, ref) => {
  return (
    <DrawerPrimitive.Close
      ref={ref}
      data-slot="drawer-close"
      data-testid="drawer-close"
      {...props}
    />
  );
});
DrawerClose.displayName = 'DrawerClose';

/** DrawerOverlay component - backdrop behind the drawer */
const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Overlay>,
  DrawerOverlayProps
>(({ className, ...props }, ref) => {
  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      data-slot="drawer-overlay"
      data-testid="drawer-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  );
});
DrawerOverlay.displayName = 'DrawerOverlay';

/** DrawerContent component - main container for drawer content */
const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Content>,
  DrawerContentProps
>(({ className, children, ...props }, ref) => {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        data-slot="drawer-content"
        data-testid="drawer-content"
        className={cn(
          'group/drawer-content bg-background fixed z-50 flex h-auto flex-col',
          'data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b',
          'data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t',
          'data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm',
          'data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm',
          className
        )}
        {...props}
      >
        <div className="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = 'DrawerContent';

/** DrawerHeader component - container for title and description */
const DrawerHeader = React.forwardRef<HTMLDivElement, DrawerHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="drawer-header"
        data-testid="drawer-header"
        className={cn('flex flex-col gap-1.5 p-4', className)}
        {...props}
      />
    );
  }
);
DrawerHeader.displayName = 'DrawerHeader';

/** DrawerFooter component - container for action buttons */
const DrawerFooter = React.forwardRef<HTMLDivElement, DrawerFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="drawer-footer"
        data-testid="drawer-footer"
        className={cn('mt-auto flex flex-col gap-2 p-4', className)}
        {...props}
      />
    );
  }
);
DrawerFooter.displayName = 'DrawerFooter';

/** DrawerTitle component - accessible title for the drawer */
const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Title>,
  DrawerTitleProps
>(({ className, ...props }, ref) => {
  return (
    <DrawerPrimitive.Title
      ref={ref}
      data-slot="drawer-title"
      data-testid="drawer-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  );
});
DrawerTitle.displayName = 'DrawerTitle';

/** DrawerDescription component - accessible description text */
const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Description>,
  DrawerDescriptionProps
>(({ className, ...props }, ref) => {
  return (
    <DrawerPrimitive.Description
      ref={ref}
      data-slot="drawer-description"
      data-testid="drawer-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
});
DrawerDescription.displayName = 'DrawerDescription';

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
