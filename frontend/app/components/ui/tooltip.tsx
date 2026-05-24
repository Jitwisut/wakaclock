'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

/**
 * TooltipProvider component props
 * @see https://www.radix-ui.com/primitives/docs/components/tooltip
 */
export type TooltipProviderProps = React.ComponentProps<typeof TooltipPrimitive.Provider>;

/** TooltipProvider component - provides tooltip context */
function TooltipProvider({ delayDuration = 0, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}
TooltipProvider.displayName = 'TooltipProvider';

/**
 * Tooltip component props
 *
 * @description Props for the Tooltip root component.
 * @see https://www.radix-ui.com/primitives/docs/components/tooltip
 */
export type TooltipProps = React.ComponentProps<typeof TooltipPrimitive.Root>;

/**
 * Tooltip component - Informative text on hover/focus
 *
 * @description
 * A popup that displays brief information about an element when
 * the user hovers over or focuses on it. Non-interactive.
 *
 * ## Features
 * - **Hover Trigger**: Shows on mouse hover
 * - **Focus Trigger**: Shows on keyboard focus
 * - **Positioning**: Automatic collision avoidance
 * - **Arrow**: Visual pointer to trigger element
 * - **Animation**: Smooth fade and slide transitions
 * - **Delay**: Configurable show/hide delay
 *
 * ## Use Cases
 * - Icon button labels
 * - Abbreviated text explanation
 * - Keyboard shortcut hints
 * - Form field help text
 * - Truncated content preview
 *
 * ## vs Popover
 * - **Tooltip**: Hover-triggered, non-interactive, brief text
 * - **Popover**: Click-triggered, interactive content
 *
 * ## Accessibility
 * - `role="tooltip"` for screen readers
 * - Accessible via keyboard focus
 * - aria-describedby linking
 * - Proper focus management
 *
 * @example
 * ```tsx
 * // Basic tooltip
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <Button variant="outline" size="icon">
 *       <PlusIcon className="size-4" />
 *     </Button>
 *   </TooltipTrigger>
 *   <TooltipContent>
 *     <p>Add to library</p>
 *   </TooltipContent>
 * </Tooltip>
 *
 * // With keyboard shortcut
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <Button>Save</Button>
 *   </TooltipTrigger>
 *   <TooltipContent>
 *     <p>Save changes <Kbd>⌘S</Kbd></p>
 *   </TooltipContent>
 * </Tooltip>
 *
 * // Custom side
 * <TooltipContent side="right">
 *   <p>Appears on right</p>
 * </TooltipContent>
 *
 * // With delay
 * <TooltipProvider delayDuration={300}>
 *   <Tooltip>...</Tooltip>
 * </TooltipProvider>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/tooltip
 */
function Tooltip({ ...props }: TooltipProps) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}
Tooltip.displayName = 'Tooltip';

/**
 * TooltipTrigger component props
 *
 * @description Props for the tooltip trigger element.
 */
export type TooltipTriggerProps = React.ComponentProps<typeof TooltipPrimitive.Trigger> & {
  /** ID for linking trigger to tooltip content */
  tooltipId?: string;
  /**
   * Custom test ID for testing
   * @default 'tooltip-trigger'
   */
  testId?: string;
};

/** TooltipTrigger component - element that triggers tooltip */
const TooltipTrigger = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Trigger>,
  TooltipTriggerProps
>(({ tooltipId, testId = 'tooltip-trigger', ...props }, ref) => {
  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      data-slot="tooltip-trigger"
      data-testid={testId}
      aria-describedby={tooltipId}
      {...props}
    />
  );
});
TooltipTrigger.displayName = 'TooltipTrigger';

/**
 * TooltipContent component props
 *
 * @description Props for the tooltip content panel.
 */
export type TooltipContentProps = React.ComponentProps<typeof TooltipPrimitive.Content> & {
  /**
   * Custom test ID for testing
   * @default 'tooltip-content'
   */
  testId?: string;
};

/** TooltipContent component - tooltip content with arrow */
const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 0, children, id, testId = 'tooltip-content', ...props }, ref) => {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        data-slot="tooltip-content"
        data-testid={testId}
        id={id}
        role="tooltip"
        sideOffset={sideOffset}
        className={cn(
          'bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance',
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
