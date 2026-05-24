'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/lib/utils';

/**
 * Popover component props
 *
 * @description Props for the Popover root component.
 * @see https://www.radix-ui.com/primitives/docs/components/popover
 */
export type PopoverProps = React.ComponentProps<typeof PopoverPrimitive.Root>;

/**
 * Popover component - Floating content triggered by click
 *
 * @description
 * A floating panel that appears on click, ideal for rich content
 * that doesn't fit in a tooltip. Supports positioning and focus management.
 *
 * ## Features
 * - **Click Trigger**: Opens on click (not hover)
 * - **Focus Trapping**: Maintains focus within content
 * - **Positioning**: Automatic collision detection
 * - **Dismissal**: Close on outside click or Escape
 * - **Controlled/Uncontrolled**: Both modes supported
 *
 * ## Use Cases
 * - Settings/preferences panels
 * - Color pickers
 * - Date pickers
 * - Notification details
 * - Quick edit forms
 *
 * ## vs Tooltip
 * - **Popover**: Click-triggered, interactive content
 * - **Tooltip**: Hover-triggered, text-only, non-interactive
 *
 * ## Accessibility
 * - Focus moves to content on open
 * - Escape closes the popover
 * - Focus returns to trigger on close
 *
 * @example
 * ```tsx
 * // Basic popover
 * <Popover>
 *   <PopoverTrigger asChild>
 *     <Button variant="outline">Open Settings</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>
 *     <div className="grid gap-4">
 *       <h4 className="font-medium">Dimensions</h4>
 *       <div className="grid gap-2">
 *         <Label htmlFor="width">Width</Label>
 *         <Input id="width" defaultValue="100%" />
 *       </div>
 *     </div>
 *   </PopoverContent>
 * </Popover>
 *
 * // Controlled popover
 * const [open, setOpen] = React.useState(false);
 * <Popover open={open} onOpenChange={setOpen}>
 *   <PopoverTrigger asChild>
 *     <Button>Toggle</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>
 *     <p>Controlled content</p>
 *     <Button onClick={() => setOpen(false)}>Close</Button>
 *   </PopoverContent>
 * </Popover>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/popover
 */
function Popover({ ...props }: PopoverProps) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}
Popover.displayName = 'Popover';

/**
 * PopoverTrigger component props
 *
 * @description Props for the element that triggers the popover.
 */
export type PopoverTriggerProps = React.ComponentProps<typeof PopoverPrimitive.Trigger> & {
  /** Controlled open state */
  open?: boolean;
  /**
   * Custom test ID for testing
   * @default 'popover-trigger'
   */
  testId?: string;
};

/** PopoverTrigger component - element that triggers popover */
const PopoverTrigger = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Trigger>,
  PopoverTriggerProps
>(({ open, testId = 'popover-trigger', ...props }, ref) => {
  return (
    <PopoverPrimitive.Trigger
      ref={ref}
      data-slot="popover-trigger"
      data-testid={testId}
      aria-haspopup="dialog"
      aria-expanded={open}
      {...props}
    />
  );
});
PopoverTrigger.displayName = 'PopoverTrigger';

/**
 * PopoverContent component props
 *
 * @description Props for the popover content panel.
 */
export type PopoverContentProps = React.ComponentProps<typeof PopoverPrimitive.Content> & {
  /**
   * Custom test ID for testing
   * @default 'popover-content'
   */
  testId?: string;
};

/** PopoverContent component - content displayed in popover */
const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(({ className, align = 'center', sideOffset = 4, testId = 'popover-content', ...props }, ref) => {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        data-slot="popover-content"
        data-testid={testId}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 rounded-md border p-4 shadow-md outline-hidden',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = 'PopoverContent';

/**
 * PopoverAnchor component props
 *
 * @description Props for the anchor element used for popover positioning.
 */
export type PopoverAnchorProps = React.ComponentProps<typeof PopoverPrimitive.Anchor> & {
  /**
   * Custom test ID for testing
   * @default 'popover-anchor'
   */
  testId?: string;
};

/** PopoverAnchor component - anchor element for popover positioning */
const PopoverAnchor = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Anchor>,
  PopoverAnchorProps
>(({ testId = 'popover-anchor', ...props }, ref) => {
  return (
    <PopoverPrimitive.Anchor ref={ref} data-slot="popover-anchor" data-testid={testId} {...props} />
  );
});
PopoverAnchor.displayName = 'PopoverAnchor';

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
