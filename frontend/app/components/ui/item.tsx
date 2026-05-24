import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

/** ItemGroup component props */
export type ItemGroupProps = React.ComponentProps<'div'>;

/** ItemGroup component - container for a list of items */
const ItemGroup = React.forwardRef<HTMLDivElement, ItemGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="list"
        data-slot="item-group"
        data-testid="item-group"
        className={cn('group/item-group flex flex-col', className)}
        {...props}
      />
    );
  }
);
ItemGroup.displayName = 'ItemGroup';

/** ItemSeparator component props */
export type ItemSeparatorProps = React.ComponentProps<typeof Separator>;

/** ItemSeparator component - divider between items */
const ItemSeparator = React.forwardRef<React.ComponentRef<typeof Separator>, ItemSeparatorProps>(
  ({ className, ...props }, ref) => {
    return (
      <Separator
        ref={ref}
        data-slot="item-separator"
        data-testid="item-separator"
        orientation="horizontal"
        className={cn('my-0', className)}
        {...props}
      />
    );
  }
);
ItemSeparator.displayName = 'ItemSeparator';

const itemVariants = cva(
  'group/item [a]:hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:ring-[3px] [a]:transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border-border',
        muted: 'bg-muted/50',
      },
      size: {
        default: 'gap-4 p-4',
        sm: 'gap-2.5 px-4 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * Item component props
 *
 * @description Props for the Item list item component.
 */
export type ItemProps = React.ComponentProps<'div'> &
  VariantProps<typeof itemVariants> & {
    /** Render as child element */
    asChild?: boolean;
    /**
     * Custom test ID for testing
     * @default 'item'
     */
    testId?: string;
  };

/**
 * Item component - Flexible list item container
 *
 * @description
 * A versatile list item component with multiple variants and
 * composable subcomponents for building rich list UIs.
 *
 * ## Features
 * - **Variants**: default, outline, muted backgrounds
 * - **Sizes**: default, sm for compact layouts
 * - **Composable**: Media, Content, Title, Description, Actions
 * - **asChild**: Render as custom element via Slot
 *
 * ## Subcomponents
 * - `ItemGroup` - Container with role="list"
 * - `ItemMedia` - Icon/image container
 * - `ItemContent` - Text content area
 * - `ItemTitle` - Title text
 * - `ItemDescription` - Secondary text
 * - `ItemActions` - Action buttons
 * - `ItemHeader` - Top section
 * - `ItemFooter` - Bottom section
 * - `ItemSeparator` - Visual divider
 *
 * @example
 * ```tsx
 * // Basic item list
 * <ItemGroup>
 *   <Item>
 *     <ItemMedia variant="icon">
 *       <UserIcon />
 *     </ItemMedia>
 *     <ItemContent>
 *       <ItemTitle>John Doe</ItemTitle>
 *       <ItemDescription>Software Engineer</ItemDescription>
 *     </ItemContent>
 *     <ItemActions>
 *       <Button size="sm">Edit</Button>
 *     </ItemActions>
 *   </Item>
 *   <ItemSeparator />
 *   <Item variant="muted">
 *     <ItemContent>
 *       <ItemTitle>Jane Smith</ItemTitle>
 *     </ItemContent>
 *   </Item>
 * </ItemGroup>
 *
 * // Compact size
 * <Item size="sm" variant="outline">
 *   <ItemContent>
 *     <ItemTitle>Quick action</ItemTitle>
 *   </ItemContent>
 * </Item>
 * ```
 */
const Item = React.forwardRef<HTMLDivElement, ItemProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      asChild = false,
      testId = 'item',
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        ref={ref}
        data-slot="item"
        data-testid={testId}
        data-variant={variant}
        data-size={size}
        className={cn(itemVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Item.displayName = 'Item';

const itemMediaVariants = cva(
  'flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: "bg-muted size-8 rounded-sm border [&_svg:not([class*='size-'])]:size-4",
        image: 'size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/** ItemMedia component props */
export type ItemMediaProps = React.ComponentProps<'div'> & VariantProps<typeof itemMediaVariants>;

/** ItemMedia component - media container for icons or images */
const ItemMedia = React.forwardRef<HTMLDivElement, ItemMediaProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="item-media"
        data-testid="item-media"
        data-variant={variant}
        className={cn(itemMediaVariants({ variant, className }))}
        {...props}
      />
    );
  }
);
ItemMedia.displayName = 'ItemMedia';

/** ItemContent component props */
export type ItemContentProps = React.ComponentProps<'div'>;

/** ItemContent component - main content area */
const ItemContent = React.forwardRef<HTMLDivElement, ItemContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="item-content"
        data-testid="item-content"
        className={cn(
          'flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none',
          className
        )}
        {...props}
      />
    );
  }
);
ItemContent.displayName = 'ItemContent';

/** ItemTitle component props */
export type ItemTitleProps = React.ComponentProps<'div'>;

/** ItemTitle component - title text */
const ItemTitle = React.forwardRef<HTMLDivElement, ItemTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="item-title"
        data-testid="item-title"
        className={cn('flex w-fit items-center gap-2 text-sm leading-snug font-medium', className)}
        {...props}
      />
    );
  }
);
ItemTitle.displayName = 'ItemTitle';

/** ItemDescription component props */
export type ItemDescriptionProps = React.ComponentProps<'p'>;

/** ItemDescription component - description text */
const ItemDescription = React.forwardRef<HTMLParagraphElement, ItemDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        data-slot="item-description"
        data-testid="item-description"
        className={cn(
          'text-muted-foreground line-clamp-2 text-sm leading-normal font-normal text-balance',
          '[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
          className
        )}
        {...props}
      />
    );
  }
);
ItemDescription.displayName = 'ItemDescription';

/** ItemActions component props */
export type ItemActionsProps = React.ComponentProps<'div'>;

/** ItemActions component - container for action buttons */
const ItemActions = React.forwardRef<HTMLDivElement, ItemActionsProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="item-actions"
        data-testid="item-actions"
        className={cn('flex items-center gap-2', className)}
        {...props}
      />
    );
  }
);
ItemActions.displayName = 'ItemActions';

/** ItemHeader component props */
export type ItemHeaderProps = React.ComponentProps<'div'>;

/** ItemHeader component - header section */
const ItemHeader = React.forwardRef<HTMLDivElement, ItemHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="item-header"
        data-testid="item-header"
        className={cn('flex basis-full items-center justify-between gap-2', className)}
        {...props}
      />
    );
  }
);
ItemHeader.displayName = 'ItemHeader';

/** ItemFooter component props */
export type ItemFooterProps = React.ComponentProps<'div'>;

/** ItemFooter component - footer section */
const ItemFooter = React.forwardRef<HTMLDivElement, ItemFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="item-footer"
        data-testid="item-footer"
        className={cn('flex basis-full items-center justify-between gap-2', className)}
        {...props}
      />
    );
  }
);
ItemFooter.displayName = 'ItemFooter';

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
  itemVariants,
  itemMediaVariants,
};
