'use client';

import * as React from 'react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';

import { cn } from '@/lib/utils';

/**
 * HoverCard component props
 *
 * @description Props for the HoverCard root component.
 * @see https://www.radix-ui.com/primitives/docs/components/hover-card
 */
export type HoverCardProps = React.ComponentProps<typeof HoverCardPrimitive.Root>;

/**
 * HoverCard component - Display content on hover interaction
 *
 * @description
 * A popup card that appears when the user hovers over a trigger element.
 * Perfect for showing previews, profiles, or additional information
 * without requiring a click.
 *
 * ## Features
 * - **Hover Activation**: Opens on mouse hover (not click)
 * - **Delay Control**: Configurable open/close delays
 * - **Positioning**: Smart positioning with collision avoidance
 * - **Accessible**: Proper ARIA attributes for dialogs
 *
 * ## Use Cases
 * - User profile previews
 * - Link previews (like Wikipedia)
 * - Product details on hover
 * - Tooltip with rich content
 *
 * ## Accessibility
 * - `aria-haspopup="dialog"` on trigger
 * - `aria-expanded` state management
 * - Keyboard accessible via focus
 *
 * @example
 * ```tsx
 * // Basic hover card
 * <HoverCard>
 *   <HoverCardTrigger asChild>
 *     <a href="/user/johndoe">@johndoe</a>
 *   </HoverCardTrigger>
 *   <HoverCardContent>
 *     <div className="flex gap-4">
 *       <Avatar>
 *         <AvatarImage src="/avatars/john.jpg" />
 *       </Avatar>
 *       <div>
 *         <h4>John Doe</h4>
 *         <p className="text-sm text-muted-foreground">
 *           Software Engineer at Acme
 *         </p>
 *       </div>
 *     </div>
 *   </HoverCardContent>
 * </HoverCard>
 *
 * // With custom delays
 * <HoverCard openDelay={200} closeDelay={100}>
 *   <HoverCardTrigger>Hover me</HoverCardTrigger>
 *   <HoverCardContent>Quick preview</HoverCardContent>
 * </HoverCard>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/hover-card
 */
function HoverCard({ ...props }: HoverCardProps) {
  // Note: Root is a context provider, doesn't render DOM - data-* attributes go on children
  return <HoverCardPrimitive.Root {...props} />;
}
HoverCard.displayName = 'HoverCard';

/** HoverCardTrigger component props */
export type HoverCardTriggerProps = React.ComponentProps<typeof HoverCardPrimitive.Trigger> & {
  /** Controlled open state */
  open?: boolean;
};

/** HoverCardTrigger component - element that triggers hover card */
const HoverCardTrigger = React.forwardRef<
  React.ComponentRef<typeof HoverCardPrimitive.Trigger>,
  HoverCardTriggerProps
>(({ open, ...props }, ref) => {
  return (
    <HoverCardPrimitive.Trigger
      ref={ref}
      data-slot="hover-card-trigger"
      data-testid="hover-card-trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      {...props}
    />
  );
});
HoverCardTrigger.displayName = 'HoverCardTrigger';

/** HoverCardContent component props */
export type HoverCardContentProps = React.ComponentProps<typeof HoverCardPrimitive.Content>;

/** HoverCardContent component - content displayed in hover card */
const HoverCardContent = React.forwardRef<
  React.ComponentRef<typeof HoverCardPrimitive.Content>,
  HoverCardContentProps
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        ref={ref}
        data-slot="hover-card-content"
        data-testid="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-64 rounded-md border p-4 shadow-md outline-hidden',
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
});
HoverCardContent.displayName = 'HoverCardContent';

export { HoverCard, HoverCardTrigger, HoverCardContent };
