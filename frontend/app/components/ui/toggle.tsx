'use client';

import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Toggle component props
 *
 * @description Props for the Toggle button component.
 * @see https://www.radix-ui.com/primitives/docs/components/toggle
 */
export type ToggleProps = React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    /**
     * Custom test ID for testing
     * @default 'toggle'
     */
    testId?: string;
  };

const toggleVariants = cva(
  "hover:bg-muted hover:text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border-input hover:bg-accent hover:text-accent-foreground border bg-transparent shadow-xs',
      },
      size: {
        default: 'h-9 min-w-9 px-2',
        sm: 'h-8 min-w-8 px-1.5',
        lg: 'h-10 min-w-10 px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * Toggle component - Two-state pressable button
 *
 * @description
 * A button that can be toggled on or off. Useful for toolbar buttons
 * and binary options where visual feedback of state is important.
 *
 * ## Features
 * - **Two States**: On/off with visual distinction
 * - **Variants**: Default (ghost-like) or outline
 * - **Sizes**: Small, default, or large
 * - **Controlled/Uncontrolled**: Both modes supported
 * - **Form Integration**: Works with form libraries
 *
 * ## Use Cases
 * - Toolbar formatting buttons (bold, italic)
 * - View mode toggles (grid/list)
 * - Feature enablement buttons
 * - Like/favorite buttons
 *
 * ## vs Switch
 * - **Toggle**: Button-like, often icon-only, grouped in toolbars
 * - **Switch**: iOS-style slider for settings
 *
 * ## Accessibility
 * - `aria-pressed` for screen readers
 * - Keyboard accessible (Enter/Space to toggle)
 * - Focus indicators
 *
 * @example
 * ```tsx
 * // Basic toggle
 * <Toggle aria-label="Toggle bold">
 *   <BoldIcon className="size-4" />
 * </Toggle>
 *
 * // Controlled toggle
 * const [bold, setBold] = React.useState(false);
 * <Toggle pressed={bold} onPressedChange={setBold}>
 *   <BoldIcon className="size-4" />
 * </Toggle>
 *
 * // Outline variant
 * <Toggle variant="outline">
 *   <StarIcon className="size-4" />
 * </Toggle>
 *
 * // With text
 * <Toggle>
 *   <ItalicIcon className="mr-2 size-4" />
 *   Italic
 * </Toggle>
 *
 * // In a toolbar (with ToggleGroup)
 * <ToggleGroup type="multiple">
 *   <Toggle value="bold"><BoldIcon /></Toggle>
 *   <Toggle value="italic"><ItalicIcon /></Toggle>
 *   <Toggle value="underline"><UnderlineIcon /></Toggle>
 * </ToggleGroup>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/toggle
 */
const Toggle = React.forwardRef<React.ComponentRef<typeof TogglePrimitive.Root>, ToggleProps>(
  ({ className, variant, size, pressed, testId = 'toggle', ...props }, ref) => {
    return (
      <TogglePrimitive.Root
        ref={ref}
        data-slot="toggle"
        data-testid={testId}
        data-state={pressed !== undefined ? (pressed ? 'on' : 'off') : undefined}
        pressed={pressed}
        className={cn(toggleVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Toggle.displayName = 'Toggle';

export { Toggle, toggleVariants };
