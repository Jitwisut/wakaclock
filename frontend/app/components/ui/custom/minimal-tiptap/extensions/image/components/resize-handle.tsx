import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for the ResizeHandle component
 */
export interface ResizeHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the handle is currently being used for resizing */
  isResizing?: boolean;
}

/**
 * Draggable handle component for resizing images
 * Provides visual feedback during resize operations
 */
export const ResizeHandle = React.forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ className, isResizing = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="resize-handle"
        data-testid="resize-handle"
        role="slider"
        aria-label="Resize image"
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        className={cn(
          'absolute top-1/2 h-10 max-h-full w-1.5 -translate-y-1/2 transform cursor-col-resize rounded border border-solid border-[var(--mt-transparent-foreground)] bg-[var(--mt-bg-secondary)] p-px transition-all',
          'opacity-0 [backdrop-filter:saturate(1.8)_blur(20px)]',
          {
            'opacity-80': isResizing,
            'group-hover/node-image:opacity-80': !isResizing,
          },
          'before:absolute before:inset-y-0 before:-right-1 before:-left-1',
          className
        )}
        {...props}
      />
    );
  }
);

ResizeHandle.displayName = 'ResizeHandle';
