'use client';

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

import { cn } from '@/lib/utils';

/**
 * ScrollArea component props
 *
 * @description Props for the ScrollArea container component.
 * @see https://www.radix-ui.com/primitives/docs/components/scroll-area
 */
export type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'scroll-area'
   */
  testId?: string;
};

/**
 * ScrollArea component - Custom scrollable container
 *
 * @description
 * A scrollable container with custom-styled scrollbars that maintains
 * consistent appearance across all platforms and browsers.
 *
 * ## Features
 * - **Custom Scrollbars**: Styled scrollbars replacing native ones
 * - **Cross-Platform**: Consistent look on macOS, Windows, Linux
 * - **Auto-Hide**: Scrollbars appear on hover/scroll
 * - **Keyboard Accessible**: Tab-focusable viewport
 * - **Touch Support**: Works on touch devices
 *
 * ## Use Cases
 * - Sidebar navigation with many items
 * - Chat message containers
 * - Code editors with long content
 * - Dropdown menus with many options
 * - Modal content that may overflow
 *
 * ## Accessibility
 * - Viewport is focusable for keyboard scrolling
 * - Scrollbars remain visible when needed
 * - Touch gestures work naturally
 *
 * @example
 * ```tsx
 * // Basic scroll area
 * <ScrollArea className="h-72 w-48 rounded-md border">
 *   <div className="p-4">
 *     {items.map((item) => (
 *       <div key={item} className="text-sm">{item}</div>
 *     ))}
 *   </div>
 * </ScrollArea>
 *
 * // Horizontal scrolling
 * <ScrollArea className="w-96 whitespace-nowrap">
 *   <div className="flex space-x-4 p-4">
 *     {images.map((img) => (
 *       <img key={img.id} src={img.src} className="h-32 w-32" />
 *     ))}
 *   </div>
 *   <ScrollBar orientation="horizontal" />
 * </ScrollArea>
 *
 * // Chat container
 * <ScrollArea className="flex-1">
 *   <div className="space-y-4 p-4">
 *     {messages.map((msg) => (
 *       <Message key={msg.id} {...msg} />
 *     ))}
 *   </div>
 * </ScrollArea>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/scroll-area
 */
const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, testId = 'scroll-area', ...props }, ref) => {
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      data-slot="scroll-area"
      data-testid={testId}
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        data-testid={`${testId}-viewport`}
        className="ring-ring/10 dark:ring-ring/20 dark:outline-ring/40 outline-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] focus-visible:ring-4 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
ScrollArea.displayName = 'ScrollArea';

/**
 * ScrollBar component props
 *
 * @description Props for the custom scrollbar component.
 */
export type ScrollBarProps = React.ComponentProps<
  typeof ScrollAreaPrimitive.ScrollAreaScrollbar
> & {
  /**
   * Custom test ID for testing
   * @default 'scroll-area-scrollbar'
   */
  testId?: string;
};

/** ScrollBar component - custom scrollbar for scroll area */
const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ScrollBarProps
>(({ className, orientation = 'vertical', testId = 'scroll-area-scrollbar', ...props }, ref) => {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      data-slot="scroll-area-scrollbar"
      data-testid={testId}
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        data-testid={`${testId}-thumb`}
        className="bg-border relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
});
ScrollBar.displayName = 'ScrollBar';

export { ScrollArea, ScrollBar };
