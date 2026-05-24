import * as React from 'react';
import { cn } from '@/lib/utils';
import { getShortcutKey } from '../utils';

/** Props for the ShortcutKey component */
export interface ShortcutKeyProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Array of keyboard keys to display */
  keys: string[];
}

/**
 * A component that displays keyboard shortcut keys with proper formatting.
 * Converts key names to platform-appropriate symbols (e.g., Cmd on Mac, Ctrl on Windows).
 */
export const ShortcutKey = React.forwardRef<HTMLSpanElement, ShortcutKeyProps>(
  ({ className, keys, ...props }, ref) => {
    const modifiedKeys = keys.map((key) => getShortcutKey(key));
    const ariaLabel = modifiedKeys.map((shortcut) => shortcut.readable).join(' + ');

    return (
      <span
        data-slot="shortcut-key"
        data-testid="shortcut-key"
        aria-label={ariaLabel}
        className={cn('inline-flex items-center gap-0.5', className)}
        {...props}
        ref={ref}
      >
        {modifiedKeys.map((shortcut, index) => (
          <kbd
            key={`${shortcut.symbol}-${index}`}
            className={cn(
              'inline-block min-w-2.5 text-center align-baseline font-sans text-xs font-medium text-[rgb(156,157,160)] capitalize',

              className
            )}
          >
            {shortcut.symbol}
          </kbd>
        ))}
      </span>
    );
  }
);

ShortcutKey.displayName = 'ShortcutKey';
