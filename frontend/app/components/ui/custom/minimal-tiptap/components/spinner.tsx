import * as React from 'react';
import { cn } from '@/lib/utils';

/** Props for the Spinner component */
export type SpinnerProps = React.SVGProps<SVGSVGElement>;

/**
 * A loading spinner component for the TipTap editor.
 * Displays an animated circular spinner to indicate loading state.
 */
const SpinnerComponent = React.forwardRef<SVGSVGElement, SpinnerProps>(function Spinner(
  { className, ...props },
  ref
) {
  return (
    <svg
      ref={ref}
      data-slot="tiptap-spinner"
      data-testid="tiptap-spinner"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      role="status"
      aria-label="Loading"
      viewBox="0 0 24 24"
      className={cn('animate-spin', className)}
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
});

SpinnerComponent.displayName = 'Spinner';

export const Spinner = React.memo(SpinnerComponent);
