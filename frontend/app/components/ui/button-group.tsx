import * as React from 'react';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

/**
 * ButtonGroup variant styles using class-variance-authority
 *
 * @description Defines orientation variants for grouped buttons.
 * Handles border radius and border removal for seamless grouping.
 */
const buttonGroupVariants = cva(
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          '[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none',
        vertical:
          'flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
);

/**
 * ButtonGroup component props
 *
 * @description Props for the ButtonGroup container.
 * Extends native div props with orientation variant.
 */
export type ButtonGroupProps = React.ComponentProps<'div'> &
  VariantProps<typeof buttonGroupVariants> & {
    /**
     * Custom test ID for testing
     * @default 'button-group'
     */
    testId?: string;
  };

/**
 * ButtonGroup component - Groups related buttons together
 *
 * @description
 * A container that visually groups multiple buttons, removing
 * inner borders and rounding only the outer corners.
 *
 * ## Features
 * - **Horizontal/Vertical**: Two orientation options
 * - **Seamless Borders**: Inner borders removed
 * - **Focus Management**: Maintains z-index on focus
 * - **Mixed Content**: Supports buttons, selects, inputs
 *
 * ## Accessibility
 * - Uses `role="group"` for semantic grouping
 * - Requires `aria-label` for screen readers
 *
 * @example
 * ```tsx
 * // Horizontal button group
 * <ButtonGroup aria-label="Text formatting">
 *   <Button variant="outline">Bold</Button>
 *   <Button variant="outline">Italic</Button>
 *   <Button variant="outline">Underline</Button>
 * </ButtonGroup>
 *
 * // Vertical button group
 * <ButtonGroup orientation="vertical" aria-label="Actions">
 *   <Button>New</Button>
 *   <Button>Edit</Button>
 *   <Button>Delete</Button>
 * </ButtonGroup>
 *
 * // Mixed content
 * <ButtonGroup aria-label="Search controls">
 *   <Input placeholder="Search..." />
 *   <Button>Search</Button>
 * </ButtonGroup>
 * ```
 *
 * @see https://ui.shadcn.com/docs/components/button-group
 */
const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation, 'aria-label': ariaLabel, testId = 'button-group', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
        data-slot="button-group"
        data-testid={testId}
        data-orientation={orientation ?? 'horizontal'}
        className={cn(buttonGroupVariants({ orientation }), className)}
        {...props}
      />
    );
  }
);
ButtonGroup.displayName = 'ButtonGroup';

/**
 * ButtonGroupText component props
 *
 * @description Props for static text elements in button groups.
 */
export type ButtonGroupTextProps = React.ComponentProps<'div'> & {
  /**
   * Render as child element
   * @default false
   */
  asChild?: boolean;
  /**
   * Custom test ID for testing
   * @default 'button-group-text'
   */
  testId?: string;
};

/**
 * ButtonGroupText component - Static text element within button group
 *
 * @description
 * A non-interactive text element that can be placed within a ButtonGroup
 * to display labels or values alongside buttons.
 *
 * @example
 * ```tsx
 * <ButtonGroup aria-label="Quantity selector">
 *   <Button>-</Button>
 *   <ButtonGroupText>5</ButtonGroupText>
 *   <Button>+</Button>
 * </ButtonGroup>
 * ```
 */
const ButtonGroupText = React.forwardRef<HTMLDivElement, ButtonGroupTextProps>(
  ({ className, asChild = false, testId = 'button-group-text', ...props }, ref) => {
    const Comp = asChild ? Slot : 'div';

    return (
      <Comp
        ref={ref}
        data-slot="button-group-text"
        data-testid={testId}
        className={cn(
          "bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
          className
        )}
        {...props}
      />
    );
  }
);
ButtonGroupText.displayName = 'ButtonGroupText';

/**
 * ButtonGroupSeparator component props
 *
 * @description Props for visual separators within button groups.
 */
export type ButtonGroupSeparatorProps = React.ComponentProps<typeof Separator> & {
  /**
   * Custom test ID for testing
   * @default 'button-group-separator'
   */
  testId?: string;
};

/**
 * ButtonGroupSeparator component - Visual separator within button group
 *
 * @description
 * A visual divider between button group items. Useful for
 * separating logical groups of actions.
 *
 * @example
 * ```tsx
 * <ButtonGroup aria-label="Editor actions">
 *   <Button>Cut</Button>
 *   <Button>Copy</Button>
 *   <Button>Paste</Button>
 *   <ButtonGroupSeparator />
 *   <Button>Undo</Button>
 *   <Button>Redo</Button>
 * </ButtonGroup>
 * ```
 */
const ButtonGroupSeparator = React.forwardRef<
  React.ComponentRef<typeof Separator>,
  ButtonGroupSeparatorProps
>(({ className, orientation = 'vertical', testId = 'button-group-separator', ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-slot="button-group-separator"
      data-testid={testId}
      orientation={orientation}
      className={cn(
        'bg-input relative !m-0 self-stretch data-[orientation=vertical]:h-auto',
        className
      )}
      {...props}
    />
  );
});
ButtonGroupSeparator.displayName = 'ButtonGroupSeparator';

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants };
