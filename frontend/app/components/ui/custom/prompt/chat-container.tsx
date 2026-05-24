'use client';

import { cn } from '@/lib/utils';
import React, { Children, forwardRef, useCallback, useEffect, useRef, useState } from 'react';

/** Return type for useAutoScroll hook */
interface UseAutoScrollReturn {
  autoScrollEnabled: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  isScrolling: boolean;
  scrollTriggered: boolean;
  newMessageAdded: boolean;
  setNewMessageAdded: React.Dispatch<React.SetStateAction<boolean>>;
  prevChildrenCountRef: React.MutableRefObject<number>;
}

/**
 * Hook that provides auto-scroll functionality for chat containers
 * @param containerRef - Reference to the scrollable container element
 * @param enabled - Whether auto-scroll is enabled
 */
const useAutoScroll = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean
): UseAutoScrollReturn => {
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const lastScrollTopRef = useRef(0);
  const autoScrollingRef = useRef(false);
  const [newMessageAdded, setNewMessageAdded] = useState(false);
  const prevChildrenCountRef = useRef(0);
  const scrollTriggeredRef = useRef(false);

  const isAtBottom = useCallback((element: HTMLDivElement) => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    return scrollHeight - scrollTop - clientHeight <= 8;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const container = containerRef.current;
      if (!container) return;

      autoScrollingRef.current = true;
      scrollTriggeredRef.current = true;

      const targetScrollTop = container.scrollHeight - container.clientHeight;

      container.scrollTo({
        top: targetScrollTop,
        behavior: behavior,
      });

      const checkScrollEnd = () => {
        if (Math.abs(container.scrollTop - targetScrollTop) < 5) {
          autoScrollingRef.current = false;
          scrollTriggeredRef.current = false;
          return;
        }

        requestAnimationFrame(checkScrollEnd);
      };

      requestAnimationFrame(checkScrollEnd);

      const safetyTimeout = setTimeout(() => {
        autoScrollingRef.current = false;
        scrollTriggeredRef.current = false;
      }, 500);

      try {
        const handleScrollEnd = () => {
          autoScrollingRef.current = false;
          scrollTriggeredRef.current = false;
          clearTimeout(safetyTimeout);
          container.removeEventListener('scrollend', handleScrollEnd);
        };

        container.addEventListener('scrollend', handleScrollEnd, {
          once: true,
        });
      } catch (e) {
        // scrollend event not supported in this browser, fallback to requestAnimationFrame
      }
    },
    [containerRef]
  );

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef?.current;
    if (!container) return;

    lastScrollTopRef.current = container.scrollTop;

    const handleScroll = () => {
      if (autoScrollingRef.current) return;

      const currentScrollTop = container.scrollTop;

      if (currentScrollTop < lastScrollTopRef.current && autoScrollEnabled) {
        setAutoScrollEnabled(false);
      }

      if (isAtBottom(container) && !autoScrollEnabled) {
        setAutoScrollEnabled(true);
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && autoScrollEnabled) {
        setAutoScrollEnabled(false);
      }
    };

    const handleTouchStart = () => {
      lastScrollTopRef.current = container.scrollTop;
    };

    const handleTouchMove = () => {
      if (container.scrollTop < lastScrollTopRef.current && autoScrollEnabled) {
        setAutoScrollEnabled(false);
      }

      lastScrollTopRef.current = container.scrollTop;
    };

    const handleTouchEnd = () => {
      if (isAtBottom(container) && !autoScrollEnabled) {
        setAutoScrollEnabled(true);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, enabled, autoScrollEnabled, isAtBottom]);

  return {
    autoScrollEnabled,
    scrollToBottom,
    isScrolling: autoScrollingRef.current,
    scrollTriggered: scrollTriggeredRef.current,
    newMessageAdded,
    setNewMessageAdded,
    prevChildrenCountRef,
  };
};

/**
 * ChatContainer component props
 *
 * @description Props for the chat container with auto-scroll functionality.
 */
export interface ChatContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Child elements to render inside the container */
  children: React.ReactNode;
  /** Whether to automatically scroll to new messages */
  autoScroll?: boolean;
  /** Reference to element to scroll into view */
  scrollToRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * Custom test ID for testing
   * @default 'chat-container'
   */
  testId?: string;
}

/**
 * ChatContainer component - Scrollable chat message container
 *
 * @description
 * A specialized container for displaying chat messages with intelligent
 * auto-scrolling behavior. Automatically scrolls to new messages while
 * allowing users to scroll up to view history.
 *
 * ## Features
 * - **Auto-Scroll**: Automatically scrolls to new messages
 * - **Smart Detection**: Disables auto-scroll when user scrolls up
 * - **Re-engagement**: Re-enables auto-scroll when user scrolls to bottom
 * - **Touch Support**: Works with touch gestures on mobile
 *
 * ## Use Cases
 * - Chat applications
 * - Live feed displays
 * - Log viewers
 * - Real-time notification lists
 * - AI assistant interfaces
 *
 * ## Accessibility
 * - Uses role="log" for screen readers
 * - aria-live="polite" for new message announcements
 * - Keyboard navigable scroll container
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ChatContainer>
 *   {messages.map(msg => <Message key={msg.id}>{msg.content}</Message>)}
 * </ChatContainer>
 *
 * // With auto-scroll disabled
 * <ChatContainer autoScroll={false}>
 *   {messages.map(msg => <Message key={msg.id}>{msg.content}</Message>)}
 * </ChatContainer>
 *
 * // With custom scroll target
 * const bottomRef = useRef(null);
 * <ChatContainer scrollToRef={bottomRef}>
 *   {messages}
 *   <div ref={bottomRef} />
 * </ChatContainer>
 * ```
 */
const ChatContainer = forwardRef<HTMLDivElement, ChatContainerProps>(
  (
    { className, children, autoScroll = true, scrollToRef, testId = 'chat-container', ...props },
    forwardedRef
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const localBottomRef = useRef<HTMLDivElement>(null);
    const bottomRef = scrollToRef || localBottomRef;
    const prevChildrenRef = useRef<React.ReactNode>(null);
    const contentChangedWithoutNewMessageRef = useRef(false);

    const setChatContainerRef = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef]
    );

    const {
      autoScrollEnabled,
      scrollToBottom,
      isScrolling,
      scrollTriggered,
      newMessageAdded,
      setNewMessageAdded,
      prevChildrenCountRef,
    } = useAutoScroll(containerRef, autoScroll);

    useEffect(() => {
      const childrenArray = Children.toArray(children);
      const currentChildrenCount = childrenArray.length;

      if (currentChildrenCount > prevChildrenCountRef.current) {
        setNewMessageAdded(true);
      } else if (prevChildrenRef.current !== children) {
        contentChangedWithoutNewMessageRef.current = true;
      }

      prevChildrenCountRef.current = currentChildrenCount;
      prevChildrenRef.current = children;
    }, [children, setNewMessageAdded]);

    useEffect(() => {
      if (!autoScroll) return;

      const scrollHandler = () => {
        if (newMessageAdded) {
          scrollToBottom('smooth');
          setNewMessageAdded(false);
          contentChangedWithoutNewMessageRef.current = false;
        } else if (
          contentChangedWithoutNewMessageRef.current &&
          autoScrollEnabled &&
          !isScrolling &&
          !scrollTriggered
        ) {
          scrollToBottom('smooth');
          contentChangedWithoutNewMessageRef.current = false;
        }
      };

      requestAnimationFrame(scrollHandler);
    }, [
      children,
      autoScroll,
      autoScrollEnabled,
      isScrolling,
      scrollTriggered,
      scrollToBottom,
      newMessageAdded,
      setNewMessageAdded,
    ]);

    return (
      <div
        ref={setChatContainerRef}
        data-slot="chat-container"
        data-testid={testId}
        className={cn('flex flex-col overflow-y-auto', className)}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        {...props}
      >
        {children}
        <div
          ref={bottomRef}
          className="h-[1px] w-full flex-shrink-0 scroll-mt-4"
          aria-hidden="true"
        />
      </div>
    );
  }
);
ChatContainer.displayName = 'ChatContainer';

export { ChatContainer };
