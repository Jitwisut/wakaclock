'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * InputGroup component props
 *
 * @description Props for the InputGroup container component.
 */
export type InputGroupProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'input-group'
   */
  testId?: string;
};

/**
 * InputGroup component - Composite input with addons
 *
 * @description
 * A container that groups input elements with addons like icons,
 * buttons, or text. Provides unified focus and error states.
 *
 * ## Features
 * - **Addon Alignment**: inline-start, inline-end, block-start, block-end
 * - **Focus State**: Unified focus ring for the entire group
 * - **Error State**: Coordinated error styling
 * - **Flexible Content**: Input, textarea, buttons, icons, text
 *
 * ## Alignment Options
 * - `inline-start` - Left side of input (default)
 * - `inline-end` - Right side of input
 * - `block-start` - Above input
 * - `block-end` - Below input
 *
 * ## Accessibility
 * - `role="group"` with aria-label
 * - Focus management across components
 * - Error state via aria-invalid on control
 *
 * @example
 * ```tsx
 * // Icon prefix
 * <InputGroup aria-label="Email input">
 *   <InputGroupAddon>
 *     <MailIcon />
 *   </InputGroupAddon>
 *   <InputGroupInput placeholder="Email" />
 * </InputGroup>
 *
 * // Button suffix
 * <InputGroup aria-label="Search">
 *   <InputGroupInput placeholder="Search..." />
 *   <InputGroupAddon align="inline-end">
 *     <InputGroupButton>Search</InputGroupButton>
 *   </InputGroupAddon>
 * </InputGroup>
 *
 * // Currency input
 * <InputGroup aria-label="Amount">
 *   <InputGroupAddon>
 *     <InputGroupText>$</InputGroupText>
 *   </InputGroupAddon>
 *   <InputGroupInput type="number" placeholder="0.00" />
 *   <InputGroupAddon align="inline-end">
 *     <InputGroupText>USD</InputGroupText>
 *   </InputGroupAddon>
 * </InputGroup>
 * ```
 */
const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, testId = 'input-group', 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="input-group"
        data-testid={testId}
        role="group"
        aria-label={ariaLabel}
        className={cn(
          'group/input-group border-input dark:bg-input/30 relative flex w-full items-center rounded-md border shadow-xs transition-[color,box-shadow] outline-none',
          'h-9 min-w-0 has-[>textarea]:h-auto',

          // Variants based on alignment.
          'has-[>[data-align=inline-start]]:[&>input]:pl-2',
          'has-[>[data-align=inline-end]]:[&>input]:pr-2',
          'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3',
          'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3',

          // Focus state.
          'has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]',

          // Error state.
          'has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',

          className
        )}
        {...props}
      />
    );
  }
);
InputGroup.displayName = 'InputGroup';

/** InputGroupAddon component props */
export type InputGroupAddonProps = React.ComponentProps<'div'> &
  VariantProps<typeof inputGroupAddonVariants>;

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        'inline-start': 'order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]',
        'inline-end': 'order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]',
        'block-start':
          'order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3',
        'block-end':
          'order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  }
);

/** InputGroupAddon component - addon element for input group */
const InputGroupAddon = React.forwardRef<HTMLDivElement, InputGroupAddonProps>(
  ({ className, align = 'inline-start', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        data-slot="input-group-addon"
        data-testid="input-group-addon"
        data-align={align}
        className={cn(inputGroupAddonVariants({ align }), className)}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) {
            return;
          }
          e.currentTarget.parentElement?.querySelector('input')?.focus();
        }}
        {...props}
      />
    );
  }
);
InputGroupAddon.displayName = 'InputGroupAddon';

/** InputGroupButton component props */
export type InputGroupButtonProps = Omit<React.ComponentProps<typeof Button>, 'size'> &
  VariantProps<typeof inputGroupButtonVariants>;

const inputGroupButtonVariants = cva('flex items-center gap-2 text-sm shadow-none', {
  variants: {
    size: {
      xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
      sm: 'h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5',
      'icon-xs': 'size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0',
      'icon-sm': 'size-8 p-0 has-[>svg]:p-0',
    },
  },
  defaultVariants: {
    size: 'xs',
  },
});

/** InputGroupButton component - button element for input group */
const InputGroupButton = React.forwardRef<React.ComponentRef<typeof Button>, InputGroupButtonProps>(
  ({ className, type = 'button', variant = 'ghost', size = 'xs', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        type={type}
        data-slot="input-group-button"
        data-testid="input-group-button"
        data-size={size}
        variant={variant}
        className={cn(inputGroupButtonVariants({ size }), className)}
        {...props}
      />
    );
  }
);
InputGroupButton.displayName = 'InputGroupButton';

/** InputGroupText component props */
export type InputGroupTextProps = React.ComponentProps<'span'>;

/** InputGroupText component - text element for input group */
const InputGroupText = React.forwardRef<HTMLSpanElement, InputGroupTextProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="input-group-text"
        data-testid="input-group-text"
        className={cn(
          "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
          className
        )}
        {...props}
      />
    );
  }
);
InputGroupText.displayName = 'InputGroupText';

/** InputGroupInput component props */
export type InputGroupInputProps = React.ComponentProps<'input'>;

/** InputGroupInput component - input element for input group */
const InputGroupInput = React.forwardRef<HTMLInputElement, InputGroupInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        data-slot="input-group-control"
        data-testid="input-group-input"
        className={cn(
          'flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent',
          className
        )}
        {...props}
      />
    );
  }
);
InputGroupInput.displayName = 'InputGroupInput';

/** InputGroupTextarea component props */
export type InputGroupTextareaProps = React.ComponentProps<'textarea'>;

/** InputGroupTextarea component - textarea element for input group */
const InputGroupTextarea = React.forwardRef<HTMLTextAreaElement, InputGroupTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <Textarea
        ref={ref}
        data-slot="input-group-control"
        data-testid="input-group-textarea"
        className={cn(
          'flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent',
          className
        )}
        {...props}
      />
    );
  }
);
InputGroupTextarea.displayName = 'InputGroupTextarea';

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
  inputGroupAddonVariants,
  inputGroupButtonVariants,
};
