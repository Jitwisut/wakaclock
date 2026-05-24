'use client';

import * as React from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

/**
 * Carousel component props
 *
 * @description Props for configuring the Carousel component.
 * Built on Embla Carousel for smooth touch-friendly sliding.
 *
 * @see https://www.embla-carousel.com/
 */
export type CarouselProps = {
  /**
   * Custom test ID for testing
   * @default 'carousel'
   */
  testId?: string;
  /** Embla carousel options */
  opts?: CarouselOptions;
  /** Embla carousel plugins */
  plugins?: CarouselPlugin;
  /** Carousel orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Callback to receive carousel API */
  setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error('useCarousel must be used within a <Carousel />');
  }

  return context;
}

/** CarouselComponentProps - full props for Carousel including div props */
export type CarouselComponentProps = React.ComponentProps<'div'> & CarouselProps;

/**
 * Carousel component - Sliding content gallery
 *
 * @description
 * A touch-friendly carousel component for displaying slideable content.
 * Built on Embla Carousel with full keyboard and swipe support.
 *
 * ## Features
 * - **Touch Support**: Native swipe gestures on mobile
 * - **Keyboard Navigation**: Arrow keys to navigate
 * - **Orientation**: Horizontal or vertical sliding
 * - **Plugins**: Supports Embla plugins (autoplay, etc.)
 * - **API Access**: Expose Embla API via setApi callback
 *
 * ## Accessibility
 * - `role="region"` with `aria-roledescription="carousel"`
 * - Items have `role="group"` with `aria-roledescription="slide"`
 * - Navigation buttons have proper aria-labels
 *
 * @example
 * ```tsx
 * // Basic carousel
 * <Carousel>
 *   <CarouselContent>
 *     <CarouselItem>Slide 1</CarouselItem>
 *     <CarouselItem>Slide 2</CarouselItem>
 *     <CarouselItem>Slide 3</CarouselItem>
 *   </CarouselContent>
 *   <CarouselPrevious />
 *   <CarouselNext />
 * </Carousel>
 *
 * // With options
 * <Carousel opts={{ loop: true, align: 'center' }}>
 *   <CarouselContent>...</CarouselContent>
 * </Carousel>
 *
 * // Vertical carousel
 * <Carousel orientation="vertical" className="h-[400px]">
 *   <CarouselContent>...</CarouselContent>
 * </Carousel>
 *
 * // With autoplay plugin
 * import Autoplay from 'embla-carousel-autoplay'
 * <Carousel plugins={[Autoplay({ delay: 3000 })]}>
 *   <CarouselContent>...</CarouselContent>
 * </Carousel>
 * ```
 *
 * @see https://www.embla-carousel.com/
 */
const Carousel = React.forwardRef<HTMLDivElement, CarouselComponentProps>(
  (
    {
      orientation = 'horizontal',
      opts,
      setApi,
      plugins,
      className,
      children,
      testId = 'carousel',
      ...props
    },
    ref
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === 'horizontal' ? 'x' : 'y',
      },
      plugins
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) return;
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    }, []);

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev();
    }, [api]);

    const scrollNext = React.useCallback(() => {
      api?.scrollNext();
    }, [api]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext]
    );

    React.useEffect(() => {
      if (!api || !setApi) return;
      setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) return;
      onSelect(api);
      api.on('reInit', onSelect);
      api.on('select', onSelect);

      return () => {
        api?.off('select', onSelect);
      };
    }, [api, onSelect]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation: orientation || (opts?.axis === 'y' ? 'vertical' : 'horizontal'),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn('relative', className)}
          role="region"
          aria-roledescription="carousel"
          data-slot="carousel"
          data-testid={testId}
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  }
);
Carousel.displayName = 'Carousel';

/** CarouselContent component props */
export type CarouselContentProps = React.ComponentProps<'div'>;

/** CarouselContent component - container for carousel items */
const CarouselContent = React.forwardRef<HTMLDivElement, CarouselContentProps>(
  ({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();

    return (
      <div
        ref={carouselRef}
        className="overflow-hidden"
        data-slot="carousel-content"
        data-testid="carousel-content"
      >
        <div
          ref={ref}
          className={cn(
            'flex',
            orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
CarouselContent.displayName = 'CarouselContent';

/** CarouselItem component props */
export type CarouselItemProps = React.ComponentProps<'div'>;

/** CarouselItem component - individual slide in carousel */
const CarouselItem = React.forwardRef<HTMLDivElement, CarouselItemProps>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarousel();

    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        data-slot="carousel-item"
        data-testid="carousel-item"
        className={cn(
          'min-w-0 shrink-0 grow-0 basis-full',
          orientation === 'horizontal' ? 'pl-4' : 'pt-4',
          className
        )}
        {...props}
      />
    );
  }
);
CarouselItem.displayName = 'CarouselItem';

/** CarouselPrevious component props */
export type CarouselPreviousProps = React.ComponentProps<typeof Button>;

/** CarouselPrevious component - button to go to previous slide */
const CarouselPrevious = React.forwardRef<React.ComponentRef<typeof Button>, CarouselPreviousProps>(
  ({ className, variant = 'outline', size = 'icon', ...props }, ref) => {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();

    return (
      <Button
        ref={ref}
        data-slot="carousel-previous"
        data-testid="carousel-previous"
        variant={variant}
        size={size}
        className={cn(
          'absolute size-8 rounded-full',
          orientation === 'horizontal'
            ? 'top-1/2 -left-12 -translate-y-1/2'
            : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
          className
        )}
        disabled={!canScrollPrev}
        onClick={scrollPrev}
        aria-label="Previous slide"
        {...props}
      >
        <ArrowLeft aria-hidden="true" />
        <span className="sr-only">Previous slide</span>
      </Button>
    );
  }
);
CarouselPrevious.displayName = 'CarouselPrevious';

/** CarouselNext component props */
export type CarouselNextProps = React.ComponentProps<typeof Button>;

/** CarouselNext component - button to go to next slide */
const CarouselNext = React.forwardRef<React.ComponentRef<typeof Button>, CarouselNextProps>(
  ({ className, variant = 'outline', size = 'icon', ...props }, ref) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();

    return (
      <Button
        ref={ref}
        data-slot="carousel-next"
        data-testid="carousel-next"
        variant={variant}
        size={size}
        className={cn(
          'absolute size-8 rounded-full',
          orientation === 'horizontal'
            ? 'top-1/2 -right-12 -translate-y-1/2'
            : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
          className
        )}
        disabled={!canScrollNext}
        onClick={scrollNext}
        aria-label="Next slide"
        {...props}
      >
        <ArrowRight aria-hidden="true" />
        <span className="sr-only">Next slide</span>
      </Button>
    );
  }
);
CarouselNext.displayName = 'CarouselNext';

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
};
