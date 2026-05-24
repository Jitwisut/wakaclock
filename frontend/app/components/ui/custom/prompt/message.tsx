import React, { forwardRef } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Markdown } from './markdown';

/**
 * Message component props
 *
 * @description Props for the chat message container.
 */
export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Child elements to render in the message */
  children: React.ReactNode;
  /** Sender name for accessibility */
  sender?: string;
  /**
   * Custom test ID for testing
   * @default 'message'
   */
  testId?: string;
}

/**
 * Message component - Chat message container
 *
 * @description
 * A container for displaying chat messages with avatar and content.
 * Provides semantic structure for chat interfaces.
 *
 * ## Features
 * - **Flex Layout**: Avatar and content side by side
 * - **Semantic HTML**: Uses article role
 * - **Accessibility**: Announces sender via aria-label
 *
 * ## Use Cases
 * - Chat applications
 * - AI assistant interfaces
 * - Comment threads
 * - Support ticket displays
 *
 * ## Composition
 * Use with MessageAvatar, MessageContent, and MessageActions.
 *
 * @example
 * ```tsx
 * <Message sender="Alice">
 *   <MessageAvatar src="/avatar.jpg" alt="Alice" />
 *   <MessageContent>Hello world!</MessageContent>
 * </Message>
 * ```
 */
const Message = forwardRef<HTMLDivElement, MessageProps>(
  ({ children, className, sender, testId = 'message', ...props }, ref) => (
    <div
      ref={ref}
      data-slot="message"
      data-testid={testId}
      className={cn('flex gap-3', className)}
      role="article"
      aria-label={sender ? `Message from ${sender}` : undefined}
      {...props}
    >
      {children}
    </div>
  )
);
Message.displayName = 'Message';

/**
 * MessageAvatar component props
 *
 * @description Props for the message sender avatar.
 */
export interface MessageAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Avatar image source URL */
  src: string;
  /** Alt text for the avatar image */
  alt: string;
  /** Fallback text when image fails to load */
  fallback?: string;
  /** Delay before showing fallback */
  delayMs?: number;
  /**
   * Custom test ID for testing
   * @default 'message-avatar'
   */
  testId?: string;
}

/**
 * MessageAvatar component - Sender avatar display
 *
 * @description
 * Displays the avatar image for the message sender with
 * fallback support for failed image loads.
 *
 * @example
 * ```tsx
 * <MessageAvatar
 *   src="/user-avatar.jpg"
 *   alt="John Doe"
 *   fallback="JD"
 *   delayMs={600}
 * />
 * ```
 */
const MessageAvatar = forwardRef<HTMLDivElement, MessageAvatarProps>(
  ({ src, alt, fallback, delayMs, className, testId = 'message-avatar', ...props }, ref) => {
    return (
      <div ref={ref} data-slot="message-avatar" data-testid={testId} {...props}>
        <Avatar className={cn('h-8 w-8 shrink-0', className)}>
          <AvatarImage src={src} alt={alt} />
          {fallback && <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>}
        </Avatar>
      </div>
    );
  }
);
MessageAvatar.displayName = 'MessageAvatar';

/**
 * MessageContent component props
 *
 * @description Props for the message content display.
 */
export interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Message content to display */
  children: React.ReactNode;
  /** Whether to render content as markdown */
  markdown?: boolean;
  /**
   * Custom test ID for testing
   * @default 'message-content'
   */
  testId?: string;
}

/**
 * MessageContent component - Message body display
 *
 * @description
 * Displays the message content with optional markdown rendering.
 * Uses prose styles for proper typography.
 *
 * ## Features
 * - **Markdown Support**: Optional markdown rendering
 * - **Prose Styles**: Beautiful text formatting
 * - **Word Wrapping**: Handles long content gracefully
 *
 * @example
 * ```tsx
 * // Plain text
 * <MessageContent>Hello world!</MessageContent>
 *
 * // Markdown content
 * <MessageContent markdown>
 *   **Bold** and *italic* text with `code`
 * </MessageContent>
 * ```
 */
const MessageContent = forwardRef<HTMLDivElement, MessageContentProps>(
  ({ children, markdown = false, className, testId = 'message-content', ...props }, ref) => {
    const classNames = cn(
      'text-foreground bg-secondary prose rounded-lg p-4 break-words whitespace-normal',
      className
    );

    return markdown ? (
      <Markdown
        ref={ref}
        data-slot="message-content"
        data-testid={testId}
        className={classNames}
        {...props}
      >
        {children as string}
      </Markdown>
    ) : (
      <div
        ref={ref}
        data-slot="message-content"
        data-testid={testId}
        className={classNames}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MessageContent.displayName = 'MessageContent';

/**
 * MessageActions component props
 *
 * @description Props for the message actions container.
 */
export interface MessageActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Action buttons or controls */
  children: React.ReactNode;
  /**
   * Custom test ID for testing
   * @default 'message-actions'
   */
  testId?: string;
}

/**
 * MessageActions component - Action buttons container
 *
 * @description
 * A container for message action buttons like copy, edit, delete, etc.
 *
 * @example
 * ```tsx
 * <MessageActions>
 *   <MessageAction tooltip="Copy"><CopyIcon /></MessageAction>
 *   <MessageAction tooltip="Delete"><TrashIcon /></MessageAction>
 * </MessageActions>
 * ```
 */
const MessageActions = forwardRef<HTMLDivElement, MessageActionsProps>(
  ({ children, className, testId = 'message-actions', ...props }, ref) => (
    <div
      ref={ref}
      data-slot="message-actions"
      data-testid={testId}
      className={cn('text-muted-foreground flex items-center gap-2', className)}
      {...props}
    >
      {children}
    </div>
  )
);
MessageActions.displayName = 'MessageActions';

/**
 * MessageAction component props
 *
 * @description Props for individual message action buttons.
 */
export interface MessageActionProps extends React.ComponentProps<typeof Tooltip> {
  /** Additional CSS classes */
  className?: string;
  /** Tooltip content */
  tooltip: React.ReactNode;
  /** Action button element */
  children: React.ReactNode;
  /** Tooltip position */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Custom test ID for testing
   * @default 'message-action'
   */
  testId?: string;
}

/**
 * MessageAction component - Action button with tooltip
 *
 * @description
 * Wraps an action button with a tooltip for clear affordance.
 *
 * @example
 * ```tsx
 * <MessageAction tooltip="Copy to clipboard">
 *   <Button size="icon" variant="ghost">
 *     <CopyIcon className="h-4 w-4" />
 *   </Button>
 * </MessageAction>
 * ```
 */
const MessageAction = forwardRef<HTMLDivElement, MessageActionProps>(
  ({ tooltip, children, className, side = 'top', testId = 'message-action', ...props }, ref) => {
    return (
      <div ref={ref} data-slot="message-action" data-testid={testId}>
        <TooltipProvider>
          <Tooltip {...props}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side} className={className}>
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
);
MessageAction.displayName = 'MessageAction';

export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction };
