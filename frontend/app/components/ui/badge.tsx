import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Badge variant styles using class-variance-authority
 *
 * @description Defines the visual variants for the Badge component.
 * Includes semantic colors for different use cases.
 *
 * @see https://cva.style/docs
 */
const badgeVariants = cva(
  'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/90 border-transparent',
        secondary:
          'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90 border-transparent',
        warning:
          'border border-orange-400 bg-orange-50 text-orange-800 focus-visible:ring-orange-500/20 dark:bg-orange-900/70 dark:text-white/80 dark:focus-visible:ring-orange-500/40 [a&]:hover:bg-orange-500/90',
        info: 'border border-blue-400 bg-blue-50 text-blue-800 focus-visible:ring-blue-500/20 dark:bg-blue-900/70 dark:text-white/80 dark:focus-visible:ring-blue-500/40 [a&]:hover:bg-blue-500/90',
        success:
          'border border-green-400 bg-green-50 text-green-800 focus-visible:ring-green-500/20 dark:bg-green-900/70 dark:text-white/80 dark:focus-visible:ring-green-500/40 [a&]:hover:bg-green-500/90',
        destructive:
          'border border-red-400 bg-red-50 text-red-800 focus-visible:ring-red-500/20 dark:bg-red-900/70 dark:text-white/80 dark:focus-visible:ring-red-500/40 [a&]:hover:bg-red-500/90',
        outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Badge component props
 *
 * @description Props for the Badge component.
 * Extends native span props with variant styling options.
 */
export type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    /**
     * Render as child element (using Radix Slot)
     * @default false
     */
    asChild?: boolean;
    /**
     * Custom test ID for testing
     * @default 'badge'
     */
    testId?: string;
  };

/**
 * Badge component - Displays a small status indicator
 *
 * @description
 * A small label that provides context or status information.
 * Commonly used for notification counts, status labels, or tags.
 *
 * ## Features
 * - **Semantic Variants**: Success, warning, info, destructive
 * - **Focus Ring**: Accessible focus indicators
 * - **Invalid State**: ARIA-based error styling
 * - **Link Support**: Can be rendered as anchor with asChild
 * - **Icon Support**: Automatic icon sizing
 *
 * ## Variants
 * - **default**: Primary color, solid background
 * - **secondary**: Muted color, subtle appearance
 * - **warning**: Orange, for warnings/alerts
 * - **info**: Blue, for informational content
 * - **success**: Green, for positive states
 * - **destructive**: Red, for errors/dangers
 * - **outline**: Bordered, transparent background
 *
 * @example
 * ```tsx
 * // Simple badge
 * <Badge>New</Badge>
 *
 * // Status badges
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning">Pending</Badge>
 * <Badge variant="destructive">Failed</Badge>
 *
 * // With icon
 * <Badge variant="info">
 *   <InfoIcon className="size-3" />
 *   Info
 * </Badge>
 *
 * // As link
 * <Badge asChild variant="outline">
 *   <a href="/tags/react">React</a>
 * </Badge>
 *
 * // Notification count
 * <Button>
 *   Messages
 *   <Badge className="ml-2">5</Badge>
 * </Button>
 * ```
 *
 * @see https://ui.shadcn.com/docs/components/badge
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, asChild = false, testId = 'badge', ...props }, ref) => {
    const Comp = asChild ? Slot : 'span';

    return (
      <Comp
        ref={ref}
        data-slot="badge"
        data-testid={testId}
        data-variant={variant}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
