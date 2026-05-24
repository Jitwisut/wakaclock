'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Accordion root component props
 *
 * @description Props for the Accordion container component.
 * Extends Radix UI Accordion.Root props with additional data attributes.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/accordion
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/accordion/
 */
export type AccordionProps = React.ComponentProps<typeof AccordionPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'accordion'
   */
  testId?: string;
};

/**
 * Accordion root component - Container for collapsible content sections
 *
 * @description
 * A vertically stacked set of interactive headings that each reveal
 * an associated section of content. Built on Radix UI Accordion primitive.
 *
 * ## Features
 * - **Single/Multiple Mode**: Control whether one or many items can be expanded
 * - **Collapsible**: Allow all items to be collapsed in single mode
 * - **Keyboard Navigation**: Full keyboard support (Arrow keys, Home, End, Enter, Space)
 * - **WCAG 2.1 Compliant**: Proper ARIA attributes and focus management
 * - **RTL Support**: Works correctly in right-to-left layouts
 * - **Animated**: Smooth expand/collapse animations
 *
 * ## Accessibility
 * - Uses `role="region"` for content panels
 * - Triggers have `aria-expanded` and `aria-controls`
 * - Content has `aria-labelledby` referencing trigger
 * - Keyboard: Arrow Up/Down, Home, End, Enter, Space
 *
 * @example
 * ```tsx
 * // Basic single accordion (collapsible)
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>Is it accessible?</AccordionTrigger>
 *     <AccordionContent>
 *       Yes. It adheres to the WAI-ARIA design pattern.
 *     </AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 *
 * // Multiple items can be open
 * <Accordion type="multiple" defaultValue={['item-1', 'item-2']}>
 *   <AccordionItem value="item-1">...</AccordionItem>
 *   <AccordionItem value="item-2">...</AccordionItem>
 * </Accordion>
 *
 * // Controlled accordion
 * const [value, setValue] = useState<string>('');
 * <Accordion type="single" value={value} onValueChange={setValue}>
 *   ...
 * </Accordion>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/accordion
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/accordion/
 */
const Accordion = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Root>,
  AccordionProps
>(({ testId = 'accordion', ...props }, ref) => {
  return (
    <AccordionPrimitive.Root ref={ref} data-slot="accordion" data-testid={testId} {...props} />
  );
});
Accordion.displayName = 'Accordion';

/**
 * Accordion item component props
 *
 * @description Props for individual accordion items.
 * Each item contains a trigger and collapsible content.
 */
export type AccordionItemProps = React.ComponentProps<typeof AccordionPrimitive.Item> & {
  /**
   * Custom test ID for testing
   * @default 'accordion-item'
   */
  testId?: string;
};

/**
 * Accordion item component - Container for trigger and content pair
 *
 * @description
 * Wraps a single accordion trigger and its associated content.
 * Must be used within an Accordion component.
 *
 * @example
 * ```tsx
 * <AccordionItem value="item-1">
 *   <AccordionTrigger>Click to expand</AccordionTrigger>
 *   <AccordionContent>Hidden content here</AccordionContent>
 * </AccordionItem>
 *
 * // Disabled item
 * <AccordionItem value="disabled" disabled>
 *   <AccordionTrigger>Cannot expand</AccordionTrigger>
 *   <AccordionContent>This content is inaccessible</AccordionContent>
 * </AccordionItem>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/accordion#item
 */
const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  AccordionItemProps
>(({ className, testId = 'accordion-item', disabled, ...props }, ref) => {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      data-slot="accordion-item"
      data-testid={testId}
      data-disabled={disabled || undefined}
      disabled={disabled}
      className={cn('border-b last:border-b-0', className)}
      {...props}
    />
  );
});
AccordionItem.displayName = 'AccordionItem';

/**
 * Accordion trigger component props
 *
 * @description Props for the clickable header that toggles content visibility.
 */
export type AccordionTriggerProps = React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  /**
   * Custom test ID for testing
   * @default 'accordion-trigger'
   */
  testId?: string;

  /**
   * Hide the chevron indicator icon
   * @default false
   */
  hideChevron?: boolean;
};

/**
 * Accordion trigger component - Clickable header that toggles content
 *
 * @description
 * The interactive button that expands/collapses the associated content.
 * Includes an animated chevron indicator that rotates when open.
 *
 * ## Features
 * - **Animated Chevron**: Rotates 180° when expanded
 * - **Focus Ring**: WCAG 2.2 compliant focus indicator
 * - **Hover Underline**: Visual feedback on hover
 * - **Disabled State**: Reduced opacity, no pointer events
 *
 * ## Accessibility
 * - `aria-expanded`: Indicates current expanded state
 * - `aria-controls`: References the content panel ID
 * - Responds to Enter/Space for activation
 *
 * @example
 * ```tsx
 * // Basic trigger
 * <AccordionTrigger>Click to expand</AccordionTrigger>
 *
 * // With custom content
 * <AccordionTrigger>
 *   <span className="flex items-center gap-2">
 *     <SettingsIcon className="size-4" />
 *     Settings
 *   </span>
 * </AccordionTrigger>
 *
 * // Without chevron icon
 * <AccordionTrigger hideChevron>Custom Toggle</AccordionTrigger>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/accordion#trigger
 */
const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(({ className, children, testId = 'accordion-trigger', hideChevron = false, ...props }, ref) => {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        data-slot="accordion-trigger"
        data-testid={testId}
        className={cn(
          'focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180',
          className
        )}
        {...props}
      >
        {children}
        {!hideChevron && (
          <ChevronDownIcon
            className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200"
            aria-hidden="true"
          />
        )}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});
AccordionTrigger.displayName = 'AccordionTrigger';

/**
 * Accordion content component props
 *
 * @description Props for the collapsible content panel.
 */
export type AccordionContentProps = React.ComponentProps<typeof AccordionPrimitive.Content> & {
  /**
   * Custom test ID for testing
   * @default 'accordion-content'
   */
  testId?: string;

  /**
   * Disable the expand/collapse animation
   * Useful for users who prefer reduced motion
   * @default false
   */
  disableAnimation?: boolean;
};

/**
 * Accordion content component - Collapsible content panel
 *
 * @description
 * The expandable content area revealed when the trigger is activated.
 * Features smooth open/close animations that can be disabled.
 *
 * ## Features
 * - **Animated Reveal**: Smooth slide-down animation on open
 * - **Animated Collapse**: Smooth slide-up animation on close
 * - **Overflow Hidden**: Content is hidden during animation
 * - **Reduced Motion**: Animations can be disabled
 *
 * ## Accessibility
 * - `role="region"`: Identifies as a landmark region
 * - `aria-labelledby`: References the trigger button
 * - Hidden from screen readers when collapsed
 *
 * @example
 * ```tsx
 * // Basic content
 * <AccordionContent>
 *   This content is hidden until the trigger is clicked.
 * </AccordionContent>
 *
 * // Rich content
 * <AccordionContent>
 *   <ul className="list-disc pl-4">
 *     <li>Feature one</li>
 *     <li>Feature two</li>
 *   </ul>
 * </AccordionContent>
 *
 * // Without animation (reduced motion)
 * <AccordionContent disableAnimation>
 *   Content without animation
 * </AccordionContent>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/accordion#content
 */
const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  AccordionContentProps
>(
  (
    { className, children, testId = 'accordion-content', disableAnimation = false, ...props },
    ref
  ) => {
    return (
      <AccordionPrimitive.Content
        ref={ref}
        data-slot="accordion-content"
        data-testid={testId}
        className={cn(
          'overflow-hidden text-sm',
          !disableAnimation &&
            'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'
        )}
        {...props}
      >
        <div className={cn('pt-0 pb-4', className)}>{children}</div>
      </AccordionPrimitive.Content>
    );
  }
);
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
