'use client';

import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';

import { cn } from '@/lib/utils';

/**
 * Separator component props
 *
 * @description Props for the Separator divider component.
 * @see https://www.radix-ui.com/primitives/docs/components/separator
 */
export type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'separator'
   */
  testId?: string;
};

/**
 * Separator component - Visual divider between content sections
 *
 * @description
 * A semantic horizontal or vertical line that visually separates
 * content sections with proper accessibility semantics.
 *
 * ## Features
 * - **Orientation**: Horizontal (default) or vertical
 * - **Decorative Mode**: Purely visual or semantic separator
 * - **Responsive**: Full width/height in its orientation
 * - **Theme-Aware**: Uses border color from theme
 *
 * ## Use Cases
 * - Section dividers in cards/dialogs
 * - Menu item separators
 * - Toolbar section dividers
 * - List group separators
 *
 * ## Accessibility
 * - `decorative=true`: Hidden from screen readers (visual only)
 * - `decorative=false`: `role="separator"` for semantic meaning
 *
 * @example
 * ```tsx
 * // Horizontal separator (default)
 * <div className="space-y-4">
 *   <p>Section 1</p>
 *   <Separator />
 *   <p>Section 2</p>
 * </div>
 *
 * // Vertical separator
 * <div className="flex h-5 items-center space-x-4">
 *   <span>Item 1</span>
 *   <Separator orientation="vertical" />
 *   <span>Item 2</span>
 * </div>
 *
 * // Non-decorative (semantic)
 * <Separator decorative={false} />
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/separator
 */
const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(
  (
    { className, orientation = 'horizontal', decorative = true, testId = 'separator', ...props },
    ref
  ) => {
    return (
      <SeparatorPrimitive.Root
        ref={ref}
        data-slot="separator"
        data-testid={testId}
        decorative={decorative}
        orientation={orientation}
        className={cn(
          'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
          className
        )}
        {...props}
      />
    );
  }
);
Separator.displayName = 'Separator';

export { Separator };
