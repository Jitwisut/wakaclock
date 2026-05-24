import * as React from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Empty component props
 *
 * @description Props for the Empty state container component.
 */
export type EmptyProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'empty'
   */
  testId?: string;
};

/**
 * Empty component - Display state when no content is available
 *
 * @description
 * A flexible container for displaying empty states when there's
 * no data to show. Combines icon, title, description, and actions.
 *
 * ## Features
 * - **Flexible Layout**: Center-aligned with responsive spacing
 * - **Composable**: Mix EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent
 * - **Icon Variants**: Default or contained icon styles
 * - **Action Support**: Add buttons via EmptyContent
 *
 * ## Use Cases
 * - No search results
 * - Empty data tables
 * - First-time user experience
 * - Error recovery states
 *
 * @example
 * ```tsx
 * // Basic empty state
 * <Empty>
 *   <EmptyHeader>
 *     <EmptyMedia variant="icon">
 *       <InboxIcon />
 *     </EmptyMedia>
 *     <EmptyTitle>No messages</EmptyTitle>
 *     <EmptyDescription>
 *       Your inbox is empty. New messages will appear here.
 *     </EmptyDescription>
 *   </EmptyHeader>
 *   <EmptyContent>
 *     <Button>Compose Message</Button>
 *   </EmptyContent>
 * </Empty>
 *
 * // Search results empty
 * <Empty>
 *   <EmptyHeader>
 *     <EmptyMedia>
 *       <SearchIcon className="size-12 text-muted-foreground" />
 *     </EmptyMedia>
 *     <EmptyTitle>No results found</EmptyTitle>
 *     <EmptyDescription>
 *       Try adjusting your search or filter criteria.
 *     </EmptyDescription>
 *   </EmptyHeader>
 * </Empty>
 * ```
 */
const Empty = React.forwardRef<HTMLDivElement, EmptyProps>(
  ({ className, testId = 'empty', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="empty"
        data-testid={testId}
        className={cn(
          'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12',
          className
        )}
        {...props}
      />
    );
  }
);
Empty.displayName = 'Empty';

/** EmptyHeader component props */
export type EmptyHeaderProps = React.ComponentProps<'div'>;

/** EmptyHeader component - header section of empty state */
const EmptyHeader = React.forwardRef<HTMLDivElement, EmptyHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="empty-header"
        data-testid="empty-header"
        className={cn('flex max-w-sm flex-col items-center gap-2 text-center', className)}
        {...props}
      />
    );
  }
);
EmptyHeader.displayName = 'EmptyHeader';

const emptyMediaVariants = cva(
  'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/** EmptyMedia component props */
export type EmptyMediaProps = React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>;

/** EmptyMedia component - icon/image container for empty state */
const EmptyMedia = React.forwardRef<HTMLDivElement, EmptyMediaProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="empty-icon"
        data-testid="empty-icon"
        data-variant={variant}
        className={cn(emptyMediaVariants({ variant, className }))}
        {...props}
      />
    );
  }
);
EmptyMedia.displayName = 'EmptyMedia';

/** EmptyTitle component props */
export type EmptyTitleProps = React.ComponentProps<'div'>;

/** EmptyTitle component - title text for empty state */
const EmptyTitle = React.forwardRef<HTMLDivElement, EmptyTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="empty-title"
        data-testid="empty-title"
        className={cn('text-lg font-medium tracking-tight', className)}
        {...props}
      />
    );
  }
);
EmptyTitle.displayName = 'EmptyTitle';

/** EmptyDescription component props */
export type EmptyDescriptionProps = React.ComponentProps<'div'>;

/** EmptyDescription component - description text for empty state */
const EmptyDescription = React.forwardRef<HTMLDivElement, EmptyDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="empty-description"
        data-testid="empty-description"
        className={cn(
          'text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4',
          className
        )}
        {...props}
      />
    );
  }
);
EmptyDescription.displayName = 'EmptyDescription';

/** EmptyContent component props */
export type EmptyContentProps = React.ComponentProps<'div'>;

/** EmptyContent component - action content area for empty state */
const EmptyContent = React.forwardRef<HTMLDivElement, EmptyContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="empty-content"
        data-testid="empty-content"
        className={cn(
          'flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance',
          className
        )}
        {...props}
      />
    );
  }
);
EmptyContent.displayName = 'EmptyContent';

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
  emptyMediaVariants,
};
