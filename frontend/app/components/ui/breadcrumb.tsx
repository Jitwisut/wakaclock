import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Breadcrumb component props
 *
 * @description Props for the Breadcrumb navigation container.
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
 */
export type BreadcrumbProps = React.ComponentProps<'nav'> & {
  /**
   * Custom test ID for testing
   * @default 'breadcrumb'
   */
  testId?: string;
};

/**
 * Breadcrumb component - Navigation showing page hierarchy
 *
 * @description
 * A navigation component that shows the user's current location
 * within the site hierarchy. Helps users understand their position
 * and navigate back to parent pages.
 *
 * ## Features
 * - **Semantic HTML**: Uses nav with aria-label
 * - **Ordered List**: Proper ol/li structure
 * - **Current Page**: Marked with aria-current
 * - **Collapsible**: Supports ellipsis for long trails
 * - **Customizable Separators**: Chevron by default
 *
 * ## Accessibility
 * - Uses `nav` element with `aria-label="breadcrumb"`
 * - Current page has `aria-current="page"`
 * - Separators are hidden from screen readers
 *
 * @example
 * ```tsx
 * // Basic breadcrumb
 * <Breadcrumb>
 *   <BreadcrumbList>
 *     <BreadcrumbItem>
 *       <BreadcrumbLink href="/">Home</BreadcrumbLink>
 *     </BreadcrumbItem>
 *     <BreadcrumbSeparator />
 *     <BreadcrumbItem>
 *       <BreadcrumbLink href="/products">Products</BreadcrumbLink>
 *     </BreadcrumbItem>
 *     <BreadcrumbSeparator />
 *     <BreadcrumbItem>
 *       <BreadcrumbPage>Current Product</BreadcrumbPage>
 *     </BreadcrumbItem>
 *   </BreadcrumbList>
 * </Breadcrumb>
 *
 * // With collapsed items
 * <Breadcrumb>
 *   <BreadcrumbList>
 *     <BreadcrumbItem>
 *       <BreadcrumbLink href="/">Home</BreadcrumbLink>
 *     </BreadcrumbItem>
 *     <BreadcrumbSeparator />
 *     <BreadcrumbItem>
 *       <BreadcrumbEllipsis />
 *     </BreadcrumbItem>
 *     <BreadcrumbSeparator />
 *     <BreadcrumbItem>
 *       <BreadcrumbPage>Current</BreadcrumbPage>
 *     </BreadcrumbItem>
 *   </BreadcrumbList>
 * </Breadcrumb>
 * ```
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
 */
const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ testId = 'breadcrumb', ...props }, ref) => {
    return (
      <nav
        ref={ref}
        aria-label="breadcrumb"
        data-slot="breadcrumb"
        data-testid={testId}
        {...props}
      />
    );
  }
);
Breadcrumb.displayName = 'Breadcrumb';

/**
 * BreadcrumbList component props
 *
 * @description Props for the ordered list container.
 */
export type BreadcrumbListProps = React.ComponentProps<'ol'> & {
  /**
   * Custom test ID for testing
   * @default 'breadcrumb-list'
   */
  testId?: string;
};

/**
 * BreadcrumbList component - Ordered list of breadcrumb items
 *
 * @description
 * Container for BreadcrumbItem components. Uses semantic ol element
 * for proper accessibility structure.
 */
const BreadcrumbList = React.forwardRef<HTMLOListElement, BreadcrumbListProps>(
  ({ className, testId = 'breadcrumb-list', ...props }, ref) => {
    return (
      <ol
        ref={ref}
        data-slot="breadcrumb-list"
        data-testid={testId}
        className={cn(
          'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5',
          className
        )}
        {...props}
      />
    );
  }
);
BreadcrumbList.displayName = 'BreadcrumbList';

/**
 * BreadcrumbItem component props
 *
 * @description Props for individual breadcrumb entries.
 */
export type BreadcrumbItemProps = React.ComponentProps<'li'> & {
  /**
   * Custom test ID for testing
   * @default 'breadcrumb-item'
   */
  testId?: string;
};

/**
 * BreadcrumbItem component - Individual breadcrumb entry
 *
 * @description
 * Container for a single breadcrumb, containing either a link
 * (BreadcrumbLink) or the current page (BreadcrumbPage).
 */
const BreadcrumbItem = React.forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  ({ className, testId = 'breadcrumb-item', ...props }, ref) => {
    return (
      <li
        ref={ref}
        data-slot="breadcrumb-item"
        data-testid={testId}
        className={cn('inline-flex items-center gap-1.5', className)}
        {...props}
      />
    );
  }
);
BreadcrumbItem.displayName = 'BreadcrumbItem';

/**
 * BreadcrumbLink component props
 *
 * @description Props for clickable breadcrumb links.
 */
export type BreadcrumbLinkProps = React.ComponentProps<'a'> & {
  /**
   * Render as child element (for router links)
   * @default false
   */
  asChild?: boolean;
  /**
   * Custom test ID for testing
   * @default 'breadcrumb-link'
   */
  testId?: string;
};

/**
 * BreadcrumbLink component - Clickable breadcrumb link
 *
 * @description
 * A link to a parent page in the breadcrumb trail.
 * Use `asChild` with router Link components for SPA navigation.
 *
 * @example
 * ```tsx
 * // Standard link
 * <BreadcrumbLink href="/products">Products</BreadcrumbLink>
 *
 * // With Next.js Link
 * <BreadcrumbLink asChild>
 *   <Link href="/products">Products</Link>
 * </BreadcrumbLink>
 * ```
 */
const BreadcrumbLink = React.forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ asChild, className, testId = 'breadcrumb-link', ...props }, ref) => {
    const Comp = asChild ? Slot : 'a';

    return (
      <Comp
        ref={ref}
        data-slot="breadcrumb-link"
        data-testid={testId}
        className={cn('hover:text-foreground transition-colors', className)}
        {...props}
      />
    );
  }
);
BreadcrumbLink.displayName = 'BreadcrumbLink';

/**
 * BreadcrumbPage component props
 *
 * @description Props for the current page indicator.
 */
export type BreadcrumbPageProps = React.ComponentProps<'span'> & {
  /**
   * Custom test ID for testing
   * @default 'breadcrumb-page'
   */
  testId?: string;
};

/**
 * BreadcrumbPage component - Current page in breadcrumb trail
 *
 * @description
 * The final item in the breadcrumb trail, representing the current page.
 * Not clickable, marked with `aria-current="page"` for accessibility.
 *
 * @example
 * ```tsx
 * <BreadcrumbItem>
 *   <BreadcrumbPage>Product Details</BreadcrumbPage>
 * </BreadcrumbItem>
 * ```
 */
const BreadcrumbPage = React.forwardRef<HTMLSpanElement, BreadcrumbPageProps>(
  ({ className, testId = 'breadcrumb-page', ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="breadcrumb-page"
        data-testid={testId}
        role="link"
        aria-disabled="true"
        aria-current="page"
        className={cn('text-foreground font-normal', className)}
        {...props}
      />
    );
  }
);
BreadcrumbPage.displayName = 'BreadcrumbPage';

/**
 * BreadcrumbSeparator component props
 *
 * @description Props for visual separators between items.
 */
export type BreadcrumbSeparatorProps = React.ComponentProps<'li'> & {
  /**
   * Custom test ID for testing
   * @default 'breadcrumb-separator'
   */
  testId?: string;
};

/**
 * BreadcrumbSeparator component - Visual separator between items
 *
 * @description
 * Displays a visual separator between breadcrumb items.
 * Uses ChevronRight by default, but can be customized.
 * Hidden from screen readers with aria-hidden.
 *
 * @example
 * ```tsx
 * // Default chevron separator
 * <BreadcrumbSeparator />
 *
 * // Custom separator
 * <BreadcrumbSeparator>/</BreadcrumbSeparator>
 *
 * // Custom icon
 * <BreadcrumbSeparator>
 *   <ArrowRight className="size-3" />
 * </BreadcrumbSeparator>
 * ```
 */
const BreadcrumbSeparator = React.forwardRef<HTMLLIElement, BreadcrumbSeparatorProps>(
  ({ children, className, testId = 'breadcrumb-separator', ...props }, ref) => {
    return (
      <li
        ref={ref}
        data-slot="breadcrumb-separator"
        data-testid={testId}
        role="presentation"
        aria-hidden="true"
        className={cn('[&>svg]:size-3.5', className)}
        {...props}
      >
        {children ?? <ChevronRight />}
      </li>
    );
  }
);
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

/**
 * BreadcrumbEllipsis component props
 *
 * @description Props for collapsed breadcrumb items indicator.
 */
export type BreadcrumbEllipsisProps = React.ComponentProps<'span'> & {
  /**
   * Custom test ID for testing
   * @default 'breadcrumb-ellipsis'
   */
  testId?: string;
};

/**
 * BreadcrumbEllipsis component - Collapsed breadcrumb items indicator
 *
 * @description
 * Shows an ellipsis (...) to indicate that some breadcrumb items
 * have been collapsed. Useful for long breadcrumb trails.
 * Can be combined with a dropdown to show hidden items.
 *
 * @example
 * ```tsx
 * // Basic ellipsis
 * <BreadcrumbItem>
 *   <BreadcrumbEllipsis />
 * </BreadcrumbItem>
 *
 * // Ellipsis with dropdown
 * <BreadcrumbItem>
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild>
 *       <BreadcrumbEllipsis />
 *     </DropdownMenuTrigger>
 *     <DropdownMenuContent>
 *       <DropdownMenuItem>Hidden Item 1</DropdownMenuItem>
 *       <DropdownMenuItem>Hidden Item 2</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 * </BreadcrumbItem>
 * ```
 */
const BreadcrumbEllipsis = React.forwardRef<HTMLSpanElement, BreadcrumbEllipsisProps>(
  ({ className, testId = 'breadcrumb-ellipsis', ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="breadcrumb-ellipsis"
        data-testid={testId}
        role="presentation"
        aria-hidden="true"
        className={cn('flex size-9 items-center justify-center', className)}
        {...props}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">More</span>
      </span>
    );
  }
);
BreadcrumbEllipsis.displayName = 'BreadcrumbEllipsis';

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
