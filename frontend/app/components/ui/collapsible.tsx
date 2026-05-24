'use client';

import * as React from 'react';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

/**
 * Collapsible component props
 *
 * @description Props for the Collapsible container component.
 * Extends Radix UI Collapsible.Root props.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/collapsible
 */
export type CollapsibleProps = React.ComponentProps<typeof CollapsiblePrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'collapsible'
   */
  testId?: string;
};

/**
 * Collapsible component - Expandable/collapsible content container
 *
 * @description
 * An interactive component that reveals or hides content.
 * Supports controlled and uncontrolled states.
 *
 * ## Features
 * - **Controlled/Uncontrolled**: Flexible state management
 * - **Animated**: Add CSS animations to content
 * - **Keyboard Support**: Enter/Space to toggle
 * - **ARIA Support**: Proper accessibility attributes
 *
 * ## Accessibility
 * - Trigger has `aria-expanded` attribute
 * - Content is hidden when collapsed
 * - Keyboard accessible
 *
 * @example
 * ```tsx
 * // Basic collapsible
 * <Collapsible>
 *   <CollapsibleTrigger>Toggle</CollapsibleTrigger>
 *   <CollapsibleContent>
 *     Hidden content here
 *   </CollapsibleContent>
 * </Collapsible>
 *
 * // Controlled collapsible
 * const [open, setOpen] = useState(false);
 * <Collapsible open={open} onOpenChange={setOpen}>
 *   <CollapsibleTrigger>
 *     {open ? 'Hide' : 'Show'}
 *   </CollapsibleTrigger>
 *   <CollapsibleContent>Content</CollapsibleContent>
 * </Collapsible>
 *
 * // With animation
 * <Collapsible>
 *   <CollapsibleTrigger asChild>
 *     <Button variant="ghost">
 *       <ChevronDown className="size-4 transition-transform data-[state=open]:rotate-180" />
 *     </Button>
 *   </CollapsibleTrigger>
 *   <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-collapse data-[state=open]:animate-expand">
 *     Content
 *   </CollapsibleContent>
 * </Collapsible>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/collapsible
 */
const Collapsible = React.forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Root>,
  CollapsibleProps
>(({ testId = 'collapsible', ...props }, ref) => {
  return (
    <CollapsiblePrimitive.Root ref={ref} data-slot="collapsible" data-testid={testId} {...props} />
  );
});
Collapsible.displayName = 'Collapsible';

/**
 * CollapsibleTrigger component props
 *
 * @description Props for the button that toggles the collapsible.
 */
export type CollapsibleTriggerProps = React.ComponentProps<
  typeof CollapsiblePrimitive.CollapsibleTrigger
> & {
  /**
   * Custom test ID for testing
   * @default 'collapsible-trigger'
   */
  testId?: string;
};

/**
 * CollapsibleTrigger component - Button to toggle collapsible
 *
 * @description
 * The button that controls the open/closed state of the collapsible.
 * Use `asChild` to render a custom element as the trigger.
 */
const CollapsibleTrigger = React.forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  CollapsibleTriggerProps
>(({ testId = 'collapsible-trigger', ...props }, ref) => {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      ref={ref}
      data-slot="collapsible-trigger"
      data-testid={testId}
      {...props}
    />
  );
});
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

/**
 * CollapsibleContent component props
 *
 * @description Props for the collapsible content area.
 */
export type CollapsibleContentProps = React.ComponentProps<
  typeof CollapsiblePrimitive.CollapsibleContent
> & {
  /**
   * Custom test ID for testing
   * @default 'collapsible-content'
   */
  testId?: string;
};

/**
 * CollapsibleContent component - Content that expands/collapses
 *
 * @description
 * The content area that is shown/hidden based on the collapsible state.
 * Add CSS animations using data-[state=open/closed] selectors.
 */
const CollapsibleContent = React.forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  CollapsibleContentProps
>(({ testId = 'collapsible-content', ...props }, ref) => {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      ref={ref}
      data-slot="collapsible-content"
      data-testid={testId}
      {...props}
    />
  );
});
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
