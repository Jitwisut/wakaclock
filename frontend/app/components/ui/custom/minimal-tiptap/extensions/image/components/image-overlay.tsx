import * as React from 'react';
import { Spinner } from '../../../components/spinner';
import { cn } from '@/lib/utils';

/**
 * Labels for the image overlay component
 */
export type ImageOverlayLabels = {
  /** Label shown during image upload */
  uploading: string;
};

/** Default labels for the image overlay */
const DEFAULT_LABELS: ImageOverlayLabels = {
  uploading: 'Uploading image',
};

/**
 * Props for the ImageOverlay component
 */
export interface ImageOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Custom labels for the overlay */
  labels?: Partial<ImageOverlayLabels>;
}

/**
 * Overlay component displayed during image upload
 * Shows a spinner and accessible loading status
 */
export const ImageOverlay = React.memo(
  React.forwardRef<HTMLDivElement, ImageOverlayProps>(({ labels, className, ...props }, ref) => {
    const mergedLabels = React.useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);

    return (
      <div
        ref={ref}
        data-slot="image-overlay"
        data-testid="image-overlay"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={mergedLabels.uploading}
        className={cn(
          'flex flex-row items-center justify-center',
          'absolute inset-0 rounded bg-[var(--mt-overlay)] opacity-100 transition-opacity',
          className
        )}
        {...props}
      >
        <Spinner className="size-7" aria-hidden="true" />
      </div>
    );
  })
);

ImageOverlay.displayName = 'ImageOverlay';
