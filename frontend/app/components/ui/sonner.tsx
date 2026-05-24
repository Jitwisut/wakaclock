'use client';

import * as React from 'react';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, ToasterProps } from 'sonner';

/**
 * Toaster component props - re-exported from sonner
 * @see https://sonner.emilkowal.ski/
 */
export type { ToasterProps };

/** Extended Toaster props with testId */
export type ToasterExtendedProps = ToasterProps & {
  /**
   * Custom test ID for testing
   * @default 'sonner'
   */
  testId?: string;
};

/**
 * Toaster component - Toast notification container
 *
 * @description
 * A toast notification system powered by Sonner that integrates
 * with next-themes for automatic dark mode support.
 *
 * ## Features
 * - **Auto Theme**: Syncs with next-themes automatically
 * - **Stack Notifications**: Multiple toasts stack elegantly
 * - **Rich Content**: Support for titles, descriptions, actions
 * - **Positioning**: Configure position (top-right, bottom-center, etc.)
 * - **Duration Control**: Auto-dismiss with configurable timing
 *
 * ## Toast Types
 * - `toast()` - Default/neutral message
 * - `toast.success()` - Success message with green styling
 * - `toast.error()` - Error message with red styling
 * - `toast.warning()` - Warning message with yellow styling
 * - `toast.loading()` - Loading state with spinner
 * - `toast.promise()` - Async operation with loading/success/error states
 *
 * ## Use Cases
 * - Form submission feedback
 * - Action confirmations
 * - Error notifications
 * - Async operation status
 * - System messages
 *
 * ## Accessibility
 * - aria-live="polite" for screen reader announcements
 * - aria-atomic="true" for complete message reading
 * - Keyboard dismissible
 *
 * @example
 * ```tsx
 * // Add Toaster to layout (once)
 * <Toaster />
 *
 * // Trigger toasts from anywhere
 * import { toast } from 'sonner';
 *
 * // Basic toast
 * toast('Event has been created');
 *
 * // Success toast
 * toast.success('Profile updated successfully');
 *
 * // Error toast
 * toast.error('Something went wrong');
 *
 * // With action button
 * toast('File deleted', {
 *   action: {
 *     label: 'Undo',
 *     onClick: () => undoDelete(),
 *   },
 * });
 *
 * // Promise toast
 * toast.promise(saveData(), {
 *   loading: 'Saving...',
 *   success: 'Data saved!',
 *   error: 'Failed to save',
 * });
 * ```
 *
 * @see https://sonner.emilkowal.ski/
 */
const Toaster = React.forwardRef<React.ComponentRef<typeof Sonner>, ToasterExtendedProps>(
  ({ testId = 'sonner', ...props }, ref) => {
    const { theme = 'system' } = useTheme();

    return (
      <Sonner
        ref={ref}
        data-slot="sonner"
        data-testid={testId}
        aria-live="polite"
        aria-atomic="true"
        theme={theme as ToasterProps['theme']}
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
        {...props}
      />
    );
  }
);
Toaster.displayName = 'Toaster';

export { Toaster };
