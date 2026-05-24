'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type VariantProps } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import React, { forwardRef, useEffect, useState, type RefObject } from 'react';

/**
 * PromptScrollButton component props
 *
 * @description Props for the scroll-to-bottom button.
 */
export interface ScrollButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Reference to the element to scroll to */
  scrollRef: RefObject<HTMLElement | null>;
  /** Reference to the scrollable container */
  containerRef: RefObject<HTMLElement | null>;
  /** Scroll threshold before showing button */
  threshold?: number;
  /** Button variant style */
  variant?: VariantProps<typeof buttonVariants>['variant'];
  /** Button size */
  size?: VariantProps<typeof buttonVariants>['size'];
  /**
   * Custom test ID for testing
   * @default 'prompt-scroll-button'
   */
  testId?: string;
}

/**
 * PromptScrollButton component - Scroll-to-bottom button
 *
 * @description
 * A floating button that appears when the user scrolls up in a chat
 * container, allowing them to quickly jump back to the latest messages.
 *
 * ## Features
 * - **Auto-show/hide**: Appears only when scrolled above threshold
 * - **Smooth Animation**: Fade and scale transition
 * - **Smooth Scroll**: Animated scroll to bottom
 * - **Configurable**: Threshold, variant, and size
 *
 * ## Use Cases
 * - Chat applications
 * - Live feed displays
 * - Log viewers
 * - Any scrollable list with new items at bottom
 *
 * ## Accessibility
 * - Default aria-label "Scroll to bottom"
 * - Keyboard accessible
 * - Focus visible styles
 *
 * @example
 * ```tsx
 * const containerRef = useRef(null);
 * const bottomRef = useRef(null);
 *
 * <div ref={containerRef} className="overflow-auto">
 *   {messages}
 *   <div ref={bottomRef} />
 * </div>
 * <PromptScrollButton
 *   containerRef={containerRef}
 *   scrollRef={bottomRef}
 *   threshold={100}
 * />
 * ```
 */
const PromptScrollButton = forwardRef<HTMLButtonElement, ScrollButtonProps>(
  (
    {
      scrollRef,
      containerRef,
      className,
      threshold = 100,
      variant = 'outline',
      size = 'sm',
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      title,
      type = 'button',
      testId = 'prompt-scroll-button',
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
      const handleScroll = () => {
        if (containerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
          setIsVisible(scrollTop + clientHeight < scrollHeight - threshold);
        }
      };

      const container = containerRef.current;

      if (container) {
        container.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
      }

      return () => {
        if (container) {
          container.removeEventListener('scroll', handleScroll);
        }
      };
    }, [containerRef, threshold]);

    const handleScroll = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
        return;
      }

      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    };

    return (
      <Button
        ref={ref}
        data-slot="prompt-scroll-button"
        data-testid={testId}
        type={type}
        aria-label={ariaLabel ?? (ariaLabelledBy || title ? undefined : 'Scroll to bottom')}
        aria-labelledby={ariaLabelledBy}
        title={title}
        variant={variant}
        size={size}
        className={cn(
          'h-8 w-8 rounded-full transition-all duration-150 ease-out',
          isVisible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0',
          className
        )}
        onClick={handleScroll}
        {...props}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    );
  }
);
PromptScrollButton.displayName = 'PromptScrollButton';

export { PromptScrollButton };
