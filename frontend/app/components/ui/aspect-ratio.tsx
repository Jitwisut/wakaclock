'use client';

import * as React from 'react';

import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';

/**
 * AspectRatio component props
 *
 * @description Props for the AspectRatio container component.
 * Extends Radix UI AspectRatio.Root props with additional testing support.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/aspect-ratio
 */
export type AspectRatioProps = React.ComponentProps<typeof AspectRatioPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'aspect-ratio'
   */
  testId?: string;
};

/**
 * AspectRatio component - Maintains consistent width/height ratio
 *
 * @description
 * A component that maintains a desired ratio between width and height.
 * Essential for responsive design where media elements need to maintain
 * their proportions across different screen sizes.
 *
 * ## Features
 * - **Responsive**: Maintains ratio at any container width
 * - **CSS-based**: Uses padding-bottom technique for ratio
 * - **Flexible**: Works with images, videos, iframes, and any content
 * - **Zero Layout Shift**: Prevents CLS by reserving space
 *
 * ## Common Ratios
 * - **16/9** (1.77): Widescreen video (YouTube, TV)
 * - **4/3** (1.33): Classic TV, old photos
 * - **1/1** (1.0): Square, social media thumbnails
 * - **3/2** (1.5): 35mm film, digital cameras
 * - **21/9** (2.33): Ultrawide cinema
 *
 * @example
 * ```tsx
 * // 16:9 video container
 * <AspectRatio ratio={16 / 9}>
 *   <video src="/video.mp4" className="size-full object-cover" />
 * </AspectRatio>
 *
 * // Square image
 * <AspectRatio ratio={1}>
 *   <img
 *     src="/photo.jpg"
 *     alt="Photo"
 *     className="size-full object-cover rounded-md"
 *   />
 * </AspectRatio>
 *
 * // Responsive map embed
 * <AspectRatio ratio={16 / 9}>
 *   <iframe
 *     src="https://maps.google.com/..."
 *     className="size-full"
 *     allowFullScreen
 *   />
 * </AspectRatio>
 *
 * // Card with fixed ratio image
 * <Card>
 *   <AspectRatio ratio={3 / 2}>
 *     <img src="/product.jpg" alt="Product" className="size-full object-cover" />
 *   </AspectRatio>
 *   <CardContent>...</CardContent>
 * </Card>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/aspect-ratio
 * @see https://web.dev/cls/ - Cumulative Layout Shift
 */
const AspectRatio = React.forwardRef<
  React.ComponentRef<typeof AspectRatioPrimitive.Root>,
  AspectRatioProps
>(({ testId = 'aspect-ratio', ...props }, ref) => {
  return (
    <AspectRatioPrimitive.Root ref={ref} data-slot="aspect-ratio" data-testid={testId} {...props} />
  );
});
AspectRatio.displayName = 'AspectRatio';

export { AspectRatio };
