import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Direction of resize operation
 * @remarks Used to determine which handle is being dragged
 */
export type ResizeDirection = 'left' | 'right';

/**
 * Dimensions of an element with width and height
 */
export type ElementDimensions = {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
};

/**
 * Configuration options for the useDragResize hook
 */
export interface UseDragResizeOptions {
  /** Initial width of the element */
  initialWidth?: number;
  /** Initial height of the element */
  initialHeight?: number;
  /** Natural content width */
  contentWidth?: number;
  /** Natural content height */
  contentHeight?: number;
  /** Grid snapping interval (0-100 as percentage) */
  gridInterval: number;
  /** Minimum allowed width */
  minWidth: number;
  /** Minimum allowed height */
  minHeight: number;
  /** Maximum allowed width */
  maxWidth: number;
  /** Callback when dimensions change */
  onDimensionsChange?: (dimensions: ElementDimensions) => void;
}

/**
 * Return type for the useDragResize hook
 */
export interface UseDragResizeReturn {
  /** Function to start a resize operation */
  initiateResize: (
    direction: ResizeDirection
  ) => (event: React.PointerEvent<HTMLDivElement>) => void;
  /** Whether a resize is currently in progress */
  isResizing: boolean;
  /** Function to update dimensions programmatically */
  updateDimensions: React.Dispatch<React.SetStateAction<ElementDimensions>>;
  /** Current width of the element */
  currentWidth: number;
  /** Current height of the element */
  currentHeight: number;
}

/**
 * Hook for handling drag-to-resize functionality
 * Supports aspect ratio preservation and grid snapping
 * @param options - Configuration options for the resize behavior
 * @returns Object with resize state and control functions
 */
export function useDragResize({
  initialWidth,
  initialHeight,
  contentWidth,
  contentHeight,
  gridInterval,
  minWidth,
  minHeight,
  maxWidth,
  onDimensionsChange,
}: UseDragResizeOptions): UseDragResizeReturn {
  const [dimensions, updateDimensions] = useState<ElementDimensions>({
    width: Math.max(initialWidth ?? minWidth, minWidth),
    height: Math.max(initialHeight ?? minHeight, minHeight),
  });
  const [boundaryWidth, setBoundaryWidth] = useState(Infinity);
  const [resizeOrigin, setResizeOrigin] = useState(0);
  const [initialDimensions, setInitialDimensions] = useState(dimensions);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection | undefined>();

  const widthConstraint = useCallback(
    (proposedWidth: number, maxAllowedWidth: number) => {
      const effectiveMinWidth = Math.max(
        minWidth,
        Math.min(contentWidth ?? minWidth, (gridInterval / 100) * maxAllowedWidth)
      );
      return Math.min(maxAllowedWidth, Math.max(proposedWidth, effectiveMinWidth));
    },
    [gridInterval, contentWidth, minWidth]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      event.preventDefault();
      const movementDelta =
        (resizeDirection === 'left' ? resizeOrigin - event.pageX : event.pageX - resizeOrigin) * 2;
      const gridUnitWidth = (gridInterval / 100) * boundaryWidth;
      const proposedWidth = initialDimensions.width + movementDelta;
      const alignedWidth = Math.round(proposedWidth / gridUnitWidth) * gridUnitWidth;
      const finalWidth = widthConstraint(alignedWidth, boundaryWidth);
      const aspectRatio = contentHeight && contentWidth ? contentHeight / contentWidth : 1;

      updateDimensions({
        width: Math.max(finalWidth, minWidth),
        height: Math.max(
          contentWidth ? finalWidth * aspectRatio : (contentHeight ?? minHeight),
          minHeight
        ),
      });
    },
    [
      widthConstraint,
      resizeDirection,
      boundaryWidth,
      resizeOrigin,
      gridInterval,
      contentHeight,
      contentWidth,
      initialDimensions.width,
      minWidth,
      minHeight,
    ]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();

      setResizeOrigin(0);
      setResizeDirection(undefined);
      onDimensionsChange?.(dimensions);
    },
    [onDimensionsChange, dimensions]
  );

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        updateDimensions({
          width: Math.max(initialDimensions.width, minWidth),
          height: Math.max(initialDimensions.height, minHeight),
        });
        setResizeDirection(undefined);
      }
    },
    [initialDimensions, minWidth, minHeight]
  );

  const initiateResize = useCallback(
    (direction: ResizeDirection) => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      setBoundaryWidth(maxWidth);
      setInitialDimensions({
        width: Math.max(widthConstraint(dimensions.width, maxWidth), minWidth),
        height: Math.max(dimensions.height, minHeight),
      });
      setResizeOrigin(event.pageX);
      setResizeDirection(direction);
    },
    [maxWidth, widthConstraint, dimensions.width, dimensions.height, minWidth, minHeight]
  );

  useEffect(() => {
    if (resizeDirection) {
      document.addEventListener('keydown', handleKeydown);
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);

      return () => {
        document.removeEventListener('keydown', handleKeydown);
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };
    }
    return undefined;
  }, [resizeDirection, handleKeydown, handlePointerMove, handlePointerUp]);

  return {
    initiateResize,
    isResizing: !!resizeDirection,
    updateDimensions,
    currentWidth: Math.max(dimensions.width, minWidth),
    currentHeight: Math.max(dimensions.height, minHeight),
  };
}
