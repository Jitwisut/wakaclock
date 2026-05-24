import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';

/**
 * Pagination component props
 *
 * @description Props for the Pagination navigation component.
 */
export type PaginationProps = React.ComponentProps<'nav'> & {
  /**
   * Custom test ID for testing
   * @default 'pagination'
   */
  testId?: string;
};

/**
 * Pagination component - Navigation controls for paginated content
 *
 * @description
 * A navigation component for moving between pages of content with
 * accessible controls and proper ARIA attributes.
 *
 * ## Features
 * - **Accessible Navigation**: Proper role and aria-label
 * - **Responsive Design**: Adapts to mobile with icon-only buttons
 * - **Keyboard Navigation**: Full Tab/Enter support
 * - **Ellipsis Support**: Indicates hidden page ranges
 *
 * ## Use Cases
 * - Data table pagination
 * - Search results pages
 * - Blog post listings
 * - Image galleries
 *
 * ## Accessibility
 * - Uses `role="navigation"` with `aria-label`
 * - `aria-current="page"` on active link
 * - Screen reader text for ellipsis
 *
 * @example
 * ```tsx
 * // Basic pagination
 * <Pagination>
 *   <PaginationContent>
 *     <PaginationItem>
 *       <PaginationPrevious href="/page/1" />
 *     </PaginationItem>
 *     <PaginationItem>
 *       <PaginationLink href="/page/1">1</PaginationLink>
 *     </PaginationItem>
 *     <PaginationItem>
 *       <PaginationLink href="/page/2" isActive>2</PaginationLink>
 *     </PaginationItem>
 *     <PaginationItem>
 *       <PaginationEllipsis />
 *     </PaginationItem>
 *     <PaginationItem>
 *       <PaginationNext href="/page/3" />
 *     </PaginationItem>
 *   </PaginationContent>
 * </Pagination>
 *
 * // With custom labels
 * <Pagination>
 *   <PaginationContent>
 *     <PaginationItem>
 *       <PaginationPrevious href="#" label="Prev" />
 *     </PaginationItem>
 *     <PaginationItem>
 *       <PaginationNext href="#" label="Next" />
 *     </PaginationItem>
 *   </PaginationContent>
 * </Pagination>
 * ```
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/navigation/
 */
const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  ({ className, testId = 'pagination', ...props }, ref) => {
    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label="pagination"
        data-slot="pagination"
        data-testid={testId}
        className={cn('mx-auto flex w-full justify-center', className)}
        {...props}
      />
    );
  }
);
Pagination.displayName = 'Pagination';

/**
 * PaginationContent component props
 *
 * @description Props for the pagination items container.
 */
export type PaginationContentProps = React.ComponentProps<'ul'> & {
  /**
   * Custom test ID for testing
   * @default 'pagination-content'
   */
  testId?: string;
};

/** PaginationContent component - container for pagination items */
const PaginationContent = React.forwardRef<HTMLUListElement, PaginationContentProps>(
  ({ className, testId = 'pagination-content', ...props }, ref) => {
    return (
      <ul
        ref={ref}
        data-slot="pagination-content"
        data-testid={testId}
        className={cn('flex flex-row items-center gap-1', className)}
        {...props}
      />
    );
  }
);
PaginationContent.displayName = 'PaginationContent';

/** PaginationItem component props */
export type PaginationItemProps = React.ComponentProps<'li'>;

/** PaginationItem component - wrapper for pagination controls */
const PaginationItem = React.forwardRef<HTMLLIElement, PaginationItemProps>(({ ...props }, ref) => {
  return <li ref={ref} data-slot="pagination-item" data-testid="pagination-item" {...props} />;
});
PaginationItem.displayName = 'PaginationItem';

/** PaginationLink component props */
export type PaginationLinkProps = {
  /** Whether this link is the current page */
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  React.ComponentProps<'a'>;

/** PaginationLink component - individual page link */
const PaginationLink = React.forwardRef<HTMLAnchorElement, PaginationLinkProps>(
  ({ className, isActive, size = 'icon', ...props }, ref) => {
    return (
      <a
        ref={ref}
        aria-current={isActive ? 'page' : undefined}
        data-slot="pagination-link"
        data-testid="pagination-link"
        data-active={isActive}
        className={cn(
          buttonVariants({
            variant: isActive ? 'outline' : 'ghost',
            size,
          }),
          className
        )}
        {...props}
      />
    );
  }
);
PaginationLink.displayName = 'PaginationLink';

/** PaginationPrevious component props */
export type PaginationPreviousProps = React.ComponentProps<typeof PaginationLink> & {
  /** Button label text */
  label?: string;
};

/** PaginationPrevious component - link to previous page */
const PaginationPrevious = React.forwardRef<HTMLAnchorElement, PaginationPreviousProps>(
  ({ className, label = 'Previous', 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <PaginationLink
        ref={ref}
        aria-label={ariaLabel ?? 'Go to previous page'}
        size="default"
        data-slot="pagination-previous"
        data-testid="pagination-previous"
        className={cn('gap-1 px-2.5 sm:pl-2.5', className)}
        {...props}
      >
        <ChevronLeftIcon aria-hidden="true" />
        <span className="hidden sm:block">{label}</span>
      </PaginationLink>
    );
  }
);
PaginationPrevious.displayName = 'PaginationPrevious';

/** PaginationNext component props */
export type PaginationNextProps = React.ComponentProps<typeof PaginationLink> & {
  /** Button label text */
  label?: string;
};

/** PaginationNext component - link to next page */
const PaginationNext = React.forwardRef<HTMLAnchorElement, PaginationNextProps>(
  ({ className, label = 'Next', 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <PaginationLink
        ref={ref}
        aria-label={ariaLabel ?? 'Go to next page'}
        size="default"
        data-slot="pagination-next"
        data-testid="pagination-next"
        className={cn('gap-1 px-2.5 sm:pr-2.5', className)}
        {...props}
      >
        <span className="hidden sm:block">{label}</span>
        <ChevronRightIcon aria-hidden="true" />
      </PaginationLink>
    );
  }
);
PaginationNext.displayName = 'PaginationNext';

/** PaginationEllipsis component props */
export type PaginationEllipsisProps = React.ComponentProps<'span'> & {
  /** Screen reader label */
  label?: string;
};

/** PaginationEllipsis component - indicates hidden page links */
const PaginationEllipsis = React.forwardRef<HTMLSpanElement, PaginationEllipsisProps>(
  ({ className, label = 'More pages', ...props }, ref) => {
    return (
      <span
        ref={ref}
        aria-hidden
        data-slot="pagination-ellipsis"
        data-testid="pagination-ellipsis"
        className={cn('flex size-9 items-center justify-center', className)}
        {...props}
      >
        <MoreHorizontalIcon className="size-4" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
