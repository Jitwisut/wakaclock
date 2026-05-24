import * as React from 'react';
import type { TooltipContentProps } from '@radix-ui/react-tooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

/** Props for the ToolbarButton component */
export interface ToolbarButtonProps extends React.ComponentPropsWithoutRef<typeof Toggle> {
  /** Whether the button is in an active state */
  isActive?: boolean;
  /** Tooltip text to display on hover */
  tooltip?: string;
  /** Additional options for the tooltip content */
  tooltipOptions?: TooltipContentProps;
}

/**
 * A toggle button component for the TipTap editor toolbar.
 * Supports active state indication and optional tooltip on hover.
 */
export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ isActive, children, tooltip, className, tooltipOptions, ...props }, ref) => {
    const toggleButton = (
      <Toggle
        data-slot="toolbar-button"
        data-testid="toolbar-button"
        size="sm"
        ref={ref}
        aria-pressed={isActive ?? false}
        aria-label={props['aria-label'] ?? tooltip}
        className={cn('size-8 p-0', { 'bg-accent': isActive }, className)}
        {...props}
      >
        {children}
      </Toggle>
    );

    if (!tooltip) {
      return toggleButton;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
        <TooltipContent {...tooltipOptions}>
          <div className="flex flex-col items-center text-center">{tooltip}</div>
        </TooltipContent>
      </Tooltip>
    );
  }
);

ToolbarButton.displayName = 'ToolbarButton';

export default ToolbarButton;
