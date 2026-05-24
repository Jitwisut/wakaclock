import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Card component props
 *
 * @description Props for the Card container component.
 * Extends native div props with semantic role.
 */
export type CardProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'card'
   */
  testId?: string;
};

/**
 * Card component - Container for related content
 *
 * @description
 * A container component that provides visual boundaries for grouping
 * related content. Cards are versatile and can contain headers,
 * content, actions, and footers.
 *
 * ## Features
 * - **Semantic HTML**: Uses `role="article"` for accessibility
 * - **Flexible Layout**: Flexbox with gap for consistent spacing
 * - **Rounded Borders**: Modern rounded corner design
 * - **Theme Support**: Uses theme colors for background/text
 *
 * ## Composition
 * - **CardHeader**: Top section with title and description
 * - **CardTitle**: Main heading text
 * - **CardDescription**: Supporting description text
 * - **CardAction**: Action buttons in header
 * - **CardContent**: Main content area
 * - **CardFooter**: Bottom section for actions
 *
 * @example
 * ```tsx
 * // Basic card
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Notifications</CardTitle>
 *     <CardDescription>You have 3 unread messages</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Your notifications will appear here.</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>View All</Button>
 *   </CardFooter>
 * </Card>
 *
 * // Card with action
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Settings</CardTitle>
 *     <CardDescription>Manage your preferences</CardDescription>
 *     <CardAction>
 *       <Button variant="outline" size="sm">Edit</Button>
 *     </CardAction>
 *   </CardHeader>
 *   <CardContent>...</CardContent>
 * </Card>
 *
 * // Interactive card
 * <Card className="cursor-pointer hover:border-primary transition-colors">
 *   <CardHeader>
 *     <CardTitle>Click me</CardTitle>
 *   </CardHeader>
 * </Card>
 * ```
 *
 * @see https://ui.shadcn.com/docs/components/card
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, testId = 'card', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="article"
        data-slot="card"
        data-testid={testId}
        className={cn(
          'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6',
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

/**
 * CardHeader component props
 *
 * @description Props for the card header section.
 */
export type CardHeaderProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'card-header'
   */
  testId?: string;
};

/**
 * CardHeader component - Header section of card
 *
 * @description
 * Container for the card's title, description, and optional action.
 * Uses CSS Grid for automatic layout with action support.
 *
 * @example
 * ```tsx
 * <CardHeader>
 *   <CardTitle>Card Title</CardTitle>
 *   <CardDescription>Card description here</CardDescription>
 * </CardHeader>
 * ```
 */
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, testId = 'card-header', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="card-header"
        data-testid={testId}
        className={cn(
          '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-[data-slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
          className
        )}
        {...props}
      />
    );
  }
);
CardHeader.displayName = 'CardHeader';

/**
 * CardTitle component props
 *
 * @description Props for the card title element.
 */
export type CardTitleProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'card-title'
   */
  testId?: string;
};

/**
 * CardTitle component - Title of card
 *
 * @description
 * The main heading for the card. Automatically generates a unique ID
 * for accessibility linking with aria-labelledby.
 *
 * @example
 * ```tsx
 * <CardTitle>Settings</CardTitle>
 * <CardTitle className="text-2xl">Large Title</CardTitle>
 * ```
 */
const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ className, id, testId = 'card-title', ...props }, ref) => {
    const generatedId = React.useId();
    return (
      <div
        ref={ref}
        id={id ?? generatedId}
        data-slot="card-title"
        data-testid={testId}
        className={cn('leading-none font-semibold', className)}
        {...props}
      />
    );
  }
);
CardTitle.displayName = 'CardTitle';

/**
 * CardDescription component props
 *
 * @description Props for the card description element.
 */
export type CardDescriptionProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'card-description'
   */
  testId?: string;
};

/**
 * CardDescription component - Description text of card
 *
 * @description
 * Supporting text that provides additional context for the card.
 * Styled with muted color and smaller font size.
 *
 * @example
 * ```tsx
 * <CardDescription>
 *   Manage your account settings and preferences.
 * </CardDescription>
 * ```
 */
const CardDescription = React.forwardRef<HTMLDivElement, CardDescriptionProps>(
  ({ className, testId = 'card-description', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="card-description"
        data-testid={testId}
        className={cn('text-muted-foreground text-sm', className)}
        {...props}
      />
    );
  }
);
CardDescription.displayName = 'CardDescription';

/**
 * CardAction component props
 *
 * @description Props for the card action area.
 */
export type CardActionProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'card-action'
   */
  testId?: string;
};

/**
 * CardAction component - Action area of card header
 *
 * @description
 * Container for action buttons placed in the top-right of the card header.
 * Automatically positioned via CSS Grid when present.
 *
 * @example
 * ```tsx
 * <CardHeader>
 *   <CardTitle>Settings</CardTitle>
 *   <CardAction>
 *     <Button variant="ghost" size="icon">
 *       <MoreHorizontal className="size-4" />
 *     </Button>
 *   </CardAction>
 * </CardHeader>
 * ```
 */
const CardAction = React.forwardRef<HTMLDivElement, CardActionProps>(
  ({ className, testId = 'card-action', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="card-action"
        data-testid={testId}
        className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
        {...props}
      />
    );
  }
);
CardAction.displayName = 'CardAction';

/**
 * CardContent component props
 *
 * @description Props for the main card content area.
 */
export type CardContentProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'card-content'
   */
  testId?: string;
};

/**
 * CardContent component - Main content area of card
 *
 * @description
 * The primary content area for the card. Contains the main
 * information, forms, or any other content.
 *
 * @example
 * ```tsx
 * <CardContent>
 *   <form className="space-y-4">
 *     <Input placeholder="Name" />
 *     <Input placeholder="Email" />
 *   </form>
 * </CardContent>
 * ```
 */
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, testId = 'card-content', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="card-content"
        data-testid={testId}
        className={cn('px-6', className)}
        {...props}
      />
    );
  }
);
CardContent.displayName = 'CardContent';

/**
 * CardFooter component props
 *
 * @description Props for the card footer section.
 */
export type CardFooterProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'card-footer'
   */
  testId?: string;
};

/**
 * CardFooter component - Footer section of card
 *
 * @description
 * The bottom section of the card, typically containing
 * action buttons or additional information.
 *
 * @example
 * ```tsx
 * <CardFooter className="justify-between">
 *   <Button variant="outline">Cancel</Button>
 *   <Button>Save</Button>
 * </CardFooter>
 * ```
 */
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, testId = 'card-footer', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="card-footer"
        data-testid={testId}
        className={cn('flex items-center px-6 [.border-t]:pt-6', className)}
        {...props}
      />
    );
  }
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
