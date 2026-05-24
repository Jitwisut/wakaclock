'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';
import { cva, VariantProps } from 'class-variance-authority';

/**
 * Avatar component props
 *
 * @description Props for the Avatar container component.
 * Extends Radix UI Avatar.Root props with additional testing support.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/avatar
 */
export type AvatarProps = React.ComponentProps<typeof AvatarPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'avatar'
   */
  testId?: string;
};

/**
 * Avatar component - Displays user profile images
 *
 * @description
 * A graphical representation of a user, typically showing a profile photo
 * with fallback support for initials or icons when image is unavailable.
 *
 * ## Features
 * - **Image Loading**: Handles image load states gracefully
 * - **Fallback Support**: Shows initials or icon when image fails
 * - **Status Indicators**: Optional status badges (online, away, busy)
 * - **Sizes**: Default 32px, customizable via className
 * - **Rounded**: Circular by default
 *
 * ## Accessibility
 * - Provides alt text via AvatarImage
 * - Fallback content is accessible
 * - Status indicators use aria-hidden
 *
 * @example
 * ```tsx
 * // Basic avatar with image
 * <Avatar>
 *   <AvatarImage src="/user.jpg" alt="User Name" />
 *   <AvatarFallback>UN</AvatarFallback>
 * </Avatar>
 *
 * // Avatar with status indicator
 * <Avatar>
 *   <AvatarImage src="/user.jpg" alt="User Name" />
 *   <AvatarFallback>UN</AvatarFallback>
 *   <AvatarIndicator variant="success" />
 * </Avatar>
 *
 * // Custom sized avatar
 * <Avatar className="size-16">
 *   <AvatarImage src="/user.jpg" alt="Large Avatar" />
 *   <AvatarFallback>LA</AvatarFallback>
 * </Avatar>
 *
 * // Avatar group
 * <div className="flex -space-x-2">
 *   <Avatar className="border-2 border-background">...</Avatar>
 *   <Avatar className="border-2 border-background">...</Avatar>
 * </div>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/avatar
 */
const Avatar = React.forwardRef<React.ComponentRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className, testId = 'avatar', ...props }, ref) => {
    return (
      <AvatarPrimitive.Root
        ref={ref}
        data-slot="avatar"
        data-testid={testId}
        className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
        {...props}
      />
    );
  }
);
Avatar.displayName = 'Avatar';

/**
 * AvatarImage component props
 *
 * @description Props for the avatar image element.
 * Handles image loading and provides callbacks for load events.
 */
export type AvatarImageProps = React.ComponentProps<typeof AvatarPrimitive.Image> & {
  /**
   * Custom test ID for testing
   * @default 'avatar-image'
   */
  testId?: string;
};

/**
 * AvatarImage component - The actual image element
 *
 * @description
 * Renders the user's profile image with automatic aspect ratio
 * and object-cover fitting. Falls back to AvatarFallback on error.
 *
 * @example
 * ```tsx
 * <AvatarImage
 *   src="/profile.jpg"
 *   alt="John Doe"
 *   onLoadingStatusChange={(status) => console.log(status)}
 * />
 * ```
 */
const AvatarImage = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Image>,
  AvatarImageProps
>(({ className, alt, testId = 'avatar-image', ...props }, ref) => {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      alt={alt ?? ''}
      data-slot="avatar-image"
      data-testid={testId}
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
});
AvatarImage.displayName = 'AvatarImage';

/**
 * AvatarFallback component props
 *
 * @description Props for the fallback content when image is unavailable.
 */
export type AvatarFallbackProps = React.ComponentProps<typeof AvatarPrimitive.Fallback> & {
  /**
   * Custom test ID for testing
   * @default 'avatar-fallback'
   */
  testId?: string;
};

/**
 * AvatarFallback component - Fallback content when image fails
 *
 * @description
 * Displayed when the image fails to load or while loading.
 * Typically contains user initials or a placeholder icon.
 *
 * @example
 * ```tsx
 * // Initials fallback
 * <AvatarFallback>JD</AvatarFallback>
 *
 * // Icon fallback
 * <AvatarFallback>
 *   <UserIcon className="size-4" />
 * </AvatarFallback>
 *
 * // With delay (show after 600ms)
 * <AvatarFallback delayMs={600}>JD</AvatarFallback>
 * ```
 */
const AvatarFallback = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, testId = 'avatar-fallback', ...props }, ref) => {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      data-slot="avatar-fallback"
      data-testid={testId}
      className={cn('bg-muted flex size-full items-center justify-center rounded-full', className)}
      {...props}
    />
  );
});
AvatarFallback.displayName = 'AvatarFallback';

/**
 * Indicator variant styles using class-variance-authority
 *
 * @description Defines status indicator colors and positions.
 */
const indicatorVariants = cva('absolute size-2 rounded-full', {
  variants: {
    variant: {
      success: 'bg-green-400',
      danger: 'bg-red-400',
      warning: 'bg-orange-400',
    },
    position: {
      'top-end': 'end-0.5 top-0.5',
      'bottom-end': 'end-0.5 bottom-0.5',
      'bottom-start': 'start-0.5 bottom-0.5',
      'top-start': 'start-0.5 top-0.5',
    },
  },
  defaultVariants: {
    position: 'bottom-end',
  },
});

/**
 * AvatarIndicator component props
 *
 * @description Props for status indicators on avatars.
 * Shows online/offline/busy status visually.
 */
export type AvatarIndicatorProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof indicatorVariants> & {
    /**
     * Status variant determining the indicator color
     * @default undefined (no indicator)
     */
    variant?: 'success' | 'danger' | 'warning' | null;
    /**
     * Position of the indicator relative to avatar
     * @default 'bottom-end'
     */
    position?: 'top-end' | 'bottom-end' | 'bottom-start' | 'top-start' | null;
    /**
     * Custom test ID for testing
     * @default 'avatar-indicator'
     */
    testId?: string;
  };

/**
 * AvatarIndicator component - Status indicator for avatar
 *
 * @description
 * A small colored dot that indicates user status (online, away, busy).
 * Positioned absolutely relative to the Avatar component.
 *
 * ## Variants
 * - **success** (green): Online, available
 * - **warning** (orange): Away, idle
 * - **danger** (red): Busy, do not disturb
 *
 * ## Positions
 * - **bottom-end**: Default, bottom-right corner
 * - **top-end**: Top-right corner
 * - **bottom-start**: Bottom-left corner
 * - **top-start**: Top-left corner
 *
 * @example
 * ```tsx
 * // Online status
 * <Avatar>
 *   <AvatarImage src="/user.jpg" alt="User" />
 *   <AvatarIndicator variant="success" />
 * </Avatar>
 *
 * // Busy status at top
 * <Avatar>
 *   <AvatarImage src="/user.jpg" alt="User" />
 *   <AvatarIndicator variant="danger" position="top-end" />
 * </Avatar>
 * ```
 */
const AvatarIndicator = React.forwardRef<HTMLDivElement, AvatarIndicatorProps>(
  ({ variant, position = 'bottom-end', className, testId = 'avatar-indicator', ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        data-slot="avatar-indicator"
        data-testid={testId}
        data-variant={variant}
        data-position={position}
        className={cn(indicatorVariants({ variant, position, className }))}
        {...props}
      />
    );
  }
);
AvatarIndicator.displayName = 'AvatarIndicator';

export { Avatar, AvatarImage, AvatarFallback, AvatarIndicator, indicatorVariants };
