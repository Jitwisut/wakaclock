'use client';

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ComponentProps,
  HTMLAttributes,
  MouseEventHandler,
  ReactNode,
  VideoHTMLAttributes,
} from 'react';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/**
 * Reel item data structure
 * Represents a single video or image in the reel
 */
export type ReelItem = {
  id: string | number;
  type: 'video' | 'image';
  username: string;
  avatar: string;
  src: string;
  duration: number; // Duration in seconds for both video and image
  alt?: string;
  title?: string;
  description?: string;
  isRead: boolean;
};

/** Accessibility labels for reel controls */
export type ReelLabels = {
  previous: string;
  next: string;
  play: string;
  pause: string;
  mute: string;
  unmute: string;
};

type ReelContextType = {
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  data: ReelItem[];
  currentItem: ReelItem;
  isNavigating: boolean;
  setIsNavigating: (navigating: boolean) => void;
  isTransitioning: boolean;
  setIsTransitioning: (transitioning: boolean) => void;
  labels: ReelLabels;
};

const ReelContext = createContext<ReelContextType | undefined>(undefined);

const useReelContext = () => {
  const context = useContext(ReelContext);
  if (!context) {
    throw new Error('useReelContext must be used within a Reel');
  }
  return context;
};

/**
 * Reel component props
 *
 * @description Props for the Reel media carousel component.
 * Supports controllable video/image carousel with autoplay.
 */
export type ReelProps = HTMLAttributes<HTMLDivElement> & {
  /** Array of media items to display */
  data: ReelItem[];
  /** Initial index (uncontrolled) */
  defaultIndex?: number;
  /** Current index (controlled) */
  index?: number;
  /** Callback when index changes */
  onIndexChange?: (index: number) => void;
  /** Initial playing state (uncontrolled) */
  defaultPlaying?: boolean;
  /** Playing state (controlled) */
  playing?: boolean;
  /** Callback when playing state changes */
  onPlayingChange?: (playing: boolean) => void;
  /** Initial muted state (uncontrolled) @default true */
  defaultMuted?: boolean;
  /** Muted state (controlled) */
  muted?: boolean;
  /** Callback when muted state changes */
  onMutedChange?: (muted: boolean) => void;
  /** Auto-start playback @default true */
  autoPlay?: boolean;
  /** Accessibility labels for controls */
  labels?: Partial<ReelLabels>;
  /**
   * Custom test ID for testing
   * @default 'reel'
   */
  testId?: string;
};

const DEFAULT_REEL_LABELS: ReelLabels = {
  previous: 'Previous',
  next: 'Next',
  play: 'Play',
  pause: 'Pause',
  mute: 'Mute',
  unmute: 'Unmute',
};

/**
 * Reel component - TikTok-style vertical media carousel
 *
 * @description
 * A full-screen vertical media carousel for video and image content,
 * similar to TikTok, Instagram Reels, or YouTube Shorts.
 *
 * ## Features
 * - **Video/Image Support**: Plays videos and shows images with timers
 * - **Auto-Advance**: Automatically moves to next item when duration ends
 * - **Progress Indicators**: Visual progress bars for each item
 * - **Tap Navigation**: Tap left/right to navigate
 * - **Play/Pause**: Control playback state
 * - **Mute/Unmute**: Audio control for videos
 * - **Controlled/Uncontrolled**: Both modes supported
 *
 * ## Use Cases
 * - Social media story viewers
 * - Product showcase carousels
 * - Tutorial walkthroughs
 * - Marketing content players
 *
 * ## Sub-components
 * - `ReelContent` - Content render function
 * - `ReelVideo` - Video player component
 * - `ReelImage` - Image display component
 * - `ReelProgress` - Progress indicator bar
 * - `ReelControls` - Control buttons container
 * - `ReelNavigation` - Tap-to-navigate overlay
 *
 * ## Accessibility
 * - Keyboard controls (Space for play/pause)
 * - Customizable aria-labels via labels prop
 * - Video muted by default for autoplay compliance
 *
 * @example
 * ```tsx
 * const reelData = [
 *   { id: 1, type: 'video', src: '/video1.mp4', duration: 15, ... },
 *   { id: 2, type: 'image', src: '/image1.jpg', duration: 5, ... },
 * ];
 *
 * <Reel data={reelData}>
 *   <ReelProgress />
 *   <ReelContent>
 *     {(item) => (
 *       <ReelItem>
 *         {item.type === 'video' ? (
 *           <ReelVideo src={item.src} />
 *         ) : (
 *           <ReelImage src={item.src} alt={item.alt} />
 *         )}
 *       </ReelItem>
 *     )}
 *   </ReelContent>
 *   <ReelNavigation />
 *   <ReelControls>
 *     <ReelPlayButton />
 *     <ReelMuteButton />
 *   </ReelControls>
 * </Reel>
 * ```
 */
export const Reel = React.forwardRef<HTMLDivElement, ReelProps>(
  (
    {
      className,
      data,
      defaultIndex = 0,
      index: controlledIndex,
      onIndexChange: controlledOnIndexChange,
      defaultPlaying,
      playing: controlledPlaying,
      onPlayingChange: controlledOnPlayingChange,
      defaultMuted = true,
      muted: controlledMuted,
      onMutedChange: controlledOnMutedChange,
      autoPlay = true,
      labels,
      testId = 'reel',
      ...props
    },
    ref
  ) => {
    const [currentIndex, setCurrentIndexState] = useControllableState({
      defaultProp: defaultIndex,
      prop: controlledIndex,
      onChange: controlledOnIndexChange,
    });

    const [isPlaying, setIsPlaying] = useControllableState({
      defaultProp: defaultPlaying ?? autoPlay,
      prop: controlledPlaying,
      onChange: controlledOnPlayingChange,
    });

    const [isMuted, setIsMuted] = useControllableState({
      defaultProp: defaultMuted,
      prop: controlledMuted,
      onChange: controlledOnMutedChange,
    });

    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const resolvedLabels = { ...DEFAULT_REEL_LABELS, ...(labels ?? {}) };

    const setCurrentIndex = useCallback(
      (index: number) => {
        setIsTransitioning(true);
        setProgress(0); // Reset progress immediately to prevent showing 100% during transition
        setCurrentIndexState(index);
      },
      [setCurrentIndexState]
    );

    const currentItem = data[currentIndex];

    return (
      <ReelContext.Provider
        value={{
          currentIndex,
          setCurrentIndex,
          isPlaying,
          setIsPlaying,
          isMuted,
          setIsMuted,
          progress,
          setProgress,
          duration,
          setDuration,
          data,
          currentItem,
          isNavigating,
          setIsNavigating,
          isTransitioning,
          setIsTransitioning,
          labels: resolvedLabels,
        }}
      >
        <div
          ref={ref}
          data-slot="reel"
          data-testid={testId}
          className={cn(
            'relative isolate h-full w-auto overflow-hidden bg-black',
            'aspect-[9/16]',
            className
          )}
          {...props}
        />
      </ReelContext.Provider>
    );
  }
);
Reel.displayName = 'Reel';

export type ReelContentProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children: (item: ReelItem, index: number) => ReactNode;
};

export const ReelContent = React.forwardRef<HTMLDivElement, ReelContentProps>(
  ({ className, children, ...props }, ref) => {
    const { currentIndex, currentItem, setIsTransitioning } = useReelContext();

    const renderContent = () => {
      if (typeof children === 'function') {
        return children(currentItem, currentIndex);
      }
      const childrenArray = Array.isArray(children) ? children : [children];
      return childrenArray[currentIndex];
    };

    return (
      <div
        ref={ref}
        className={cn('relative size-full', className)}
        data-slot="reel-content"
        data-testid="reel-content"
        {...props}
      >
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1 }}
            className="absolute inset-0"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={currentIndex}
            onAnimationComplete={() => {
              // Mark transition as complete when fade-in completes
              setIsTransitioning(false);
            }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }
);
ReelContent.displayName = 'ReelContent';

export type ReelItemProps = HTMLAttributes<HTMLDivElement>;

export const ReelItem = React.forwardRef<HTMLDivElement, ReelItemProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative size-full overflow-hidden', className)}
      data-slot="reel-item"
      data-testid="reel-item"
      {...props}
    />
  )
);
ReelItem.displayName = 'ReelItem';

export type ReelVideoProps = VideoHTMLAttributes<HTMLVideoElement>;

const MS_TO_SECONDS = 1000;
const PERCENTAGE = 100;

export const ReelVideo = React.forwardRef<HTMLVideoElement, ReelVideoProps>(
  ({ className, ...props }, ref) => {
    const internalRef = useRef<HTMLVideoElement>(null);
    const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalRef;
    const {
      isPlaying,
      isMuted,
      setDuration,
      setProgress,
      currentIndex,
      setCurrentIndex,
      data,
      progress,
      currentItem,
      isTransitioning,
    } = useReelContext();
    const animationFrameRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number | undefined>(undefined);
    const pausedProgressRef = useRef<number>(0);
    const duration = currentItem.duration;

    // Set duration when component mounts or currentIndex changes
    useEffect(() => {
      setDuration(duration);
      // Don't reset progress here anymore - it's handled in ReelContent after transition
      if (!isTransitioning) {
        pausedProgressRef.current = 0;
      }
    }, [duration, setDuration, isTransitioning]);

    // Handle muting
    useEffect(() => {
      const video = typeof videoRef === 'object' && videoRef !== null ? videoRef.current : null;
      if (!video) {
        return;
      }
      video.muted = isMuted;
    }, [isMuted, videoRef]);

    // Store progress when pausing
    useEffect(() => {
      if (!isPlaying) {
        pausedProgressRef.current = progress;
      }
    }, [isPlaying, progress]);

    // Handle play/pause with duration-based progress
    useEffect(() => {
      const video = typeof videoRef === 'object' && videoRef !== null ? videoRef.current : null;
      if (!video) {
        return;
      }

      if (isPlaying && !isTransitioning) {
        video.play().catch(() => {
          // Ignore autoplay errors
        });

        // Start progress animation only when not transitioning
        const elapsedTime = (pausedProgressRef.current * duration) / PERCENTAGE;
        startTimeRef.current = performance.now() - elapsedTime * MS_TO_SECONDS;

        const updateProgress = (currentTime: number) => {
          const elapsed = (currentTime - (startTimeRef.current || 0)) / MS_TO_SECONDS;
          const newProgress = (elapsed / duration) * PERCENTAGE;

          if (newProgress >= PERCENTAGE) {
            const totalItems = data?.length || 0;
            if (currentIndex < totalItems - 1) {
              setCurrentIndex(currentIndex + 1);
            } else {
              setCurrentIndex(0);
            }
          } else {
            setProgress(newProgress);
            animationFrameRef.current = requestAnimationFrame(updateProgress);
          }
        };

        animationFrameRef.current = requestAnimationFrame(updateProgress);
      } else if (!isTransitioning) {
        video.pause();
      }

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [
      isPlaying,
      duration,
      currentIndex,
      setProgress,
      setCurrentIndex,
      data,
      isTransitioning,
      videoRef,
    ]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: Reset video when index changes
    useEffect(() => {
      const video = typeof videoRef === 'object' && videoRef !== null ? videoRef.current : null;
      if (video) {
        video.currentTime = 0;
      }
    }, [currentIndex]);

    return (
      <video
        ref={videoRef}
        className={cn('absolute inset-0 size-full object-cover', className)}
        data-slot="reel-video"
        data-testid="reel-video"
        loop
        muted={isMuted}
        playsInline
        {...props}
      />
    );
  }
);
ReelVideo.displayName = 'ReelVideo';

export type ReelImageProps = Omit<ComponentProps<'img'>, 'alt'> & {
  alt: string;
  duration?: number;
  width?: number | string;
  height?: number | string;
};

const DEFAULT_IMAGE_DURATION = 5;

export const ReelImage = React.forwardRef<HTMLImageElement, ReelImageProps>(
  ({ className, alt, duration = DEFAULT_IMAGE_DURATION, width, height, ...props }, ref) => {
    const {
      isPlaying,
      setDuration,
      setProgress,
      currentIndex,
      setCurrentIndex,
      data,
      progress,
      isTransitioning,
    } = useReelContext();
    const animationFrameRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number | undefined>(undefined);
    const pausedProgressRef = useRef<number>(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: Reset progress when index changes
    useEffect(() => {
      setDuration(duration);
      // Don't reset progress here anymore - it's handled in ReelContent after transition
      if (!isTransitioning) {
        pausedProgressRef.current = 0;
      }
    }, [currentIndex, duration, setDuration, isTransitioning]);

    // Handle play/pause
    useEffect(() => {
      if (isPlaying && !isTransitioning) {
        const elapsedTime = (pausedProgressRef.current * duration) / PERCENTAGE;
        startTimeRef.current = performance.now() - elapsedTime * MS_TO_SECONDS;

        const updateProgress = (currentTime: number) => {
          const elapsed = (currentTime - (startTimeRef.current || 0)) / MS_TO_SECONDS;
          const newProgress = (elapsed / duration) * PERCENTAGE;

          if (newProgress >= PERCENTAGE) {
            const totalItems = data?.length || 0;

            if (currentIndex < totalItems - 1) {
              setCurrentIndex(currentIndex + 1);
            } else {
              setCurrentIndex(0);
            }
          } else {
            setProgress(newProgress);
            pausedProgressRef.current = newProgress;
            animationFrameRef.current = requestAnimationFrame(updateProgress);
          }
        };

        animationFrameRef.current = requestAnimationFrame(updateProgress);
      } else if (!isTransitioning) {
        pausedProgressRef.current = progress;
      }

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [
      isPlaying,
      duration,
      currentIndex,
      setProgress,
      setCurrentIndex,
      data,
      progress,
      isTransitioning,
    ]);

    return (
      // biome-ignore lint/performance/noImgElement: "Reel is framework-agnostic"
      <img
        ref={ref}
        alt={alt}
        className={cn('absolute inset-0 size-full object-cover', className)}
        data-slot="reel-image"
        data-testid="reel-image"
        height={height}
        width={width}
        {...props}
      />
    );
  }
);
ReelImage.displayName = 'ReelImage';

export type ReelProgressProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: (item: ReelItem, index: number, isActive: boolean, progress: number) => ReactNode;
};

export const ReelProgress = React.forwardRef<HTMLDivElement, ReelProgressProps>(
  ({ className, children, ...props }, ref) => {
    const { progress, currentIndex, data } = useReelContext();
    const FULL_PROGRESS = 100;

    const calculateProgress = (index: number) => {
      if (index < currentIndex) {
        return FULL_PROGRESS;
      }
      if (index === currentIndex) {
        return progress;
      }

      return 0;
    };

    if (typeof children === 'function') {
      return (
        <div
          ref={ref}
          className={cn('absolute top-0 right-0 left-0 z-40 flex gap-1 p-2', className)}
          data-slot="reel-progress"
          data-testid="reel-progress"
          {...props}
        >
          {data.map((item, index) => (
            <div className="relative flex-1" key={`${item.id}-progress`}>
              {children(item, index, index === currentIndex, calculateProgress(index))}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn('absolute top-0 right-0 left-0 z-40 flex gap-1 p-2', className)}
        data-slot="reel-progress"
        data-testid="reel-progress"
        {...props}
      >
        {data.map((item, index) => (
          <Progress
            className="h-0.5 flex-1 bg-white/30 [&>div]:bg-white [&>div]:transition-none"
            key={`${item.id}-progress`}
            value={calculateProgress(index)}
          />
        ))}
      </div>
    );
  }
);
ReelProgress.displayName = 'ReelProgress';

export type ReelControlsProps = HTMLAttributes<HTMLDivElement>;

export const ReelControls = React.forwardRef<HTMLDivElement, ReelControlsProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'absolute right-0 bottom-0 left-0 z-20 flex items-center justify-between p-4',
        'bg-gradient-to-t from-black/60 to-transparent',
        className
      )}
      data-slot="reel-controls"
      data-testid="reel-controls"
      {...props}
    />
  )
);
ReelControls.displayName = 'ReelControls';

export type ReelPreviousButtonProps = ComponentProps<typeof Button>;

export const ReelPreviousButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  ReelPreviousButtonProps
>(({ className, children, ...props }, ref) => {
  const { currentIndex, setCurrentIndex, setIsNavigating, labels } = useReelContext();
  const NAVIGATION_RESET_DELAY = 50;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setIsNavigating(true);
      setCurrentIndex(currentIndex - 1);
      setTimeout(() => setIsNavigating(false), NAVIGATION_RESET_DELAY);
    }
  };

  return (
    <Button
      ref={ref}
      aria-label={labels.previous}
      className={cn('rounded-full text-white hover:bg-white/10 hover:text-white', className)}
      data-slot="reel-previous-button"
      data-testid="reel-previous-button"
      disabled={currentIndex === 0}
      onClick={handlePrevious}
      size="icon"
      type="button"
      variant="ghost"
      {...props}
    >
      {children || <ChevronLeft className="size-4" aria-hidden="true" />}
    </Button>
  );
});
ReelPreviousButton.displayName = 'ReelPreviousButton';

export type ReelNextButtonProps = ComponentProps<typeof Button>;

export const ReelNextButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  ReelNextButtonProps
>(({ className, children, ...props }, ref) => {
  const { currentIndex, setCurrentIndex, data, setIsNavigating, labels } = useReelContext();
  const totalItems = data?.length || 0;
  const NAVIGATION_RESET_DELAY = 50;

  const handleNext = () => {
    if (currentIndex < totalItems - 1) {
      setIsNavigating(true);
      setCurrentIndex(currentIndex + 1);
      setTimeout(() => setIsNavigating(false), NAVIGATION_RESET_DELAY);
    }
  };

  return (
    <Button
      ref={ref}
      aria-label={labels.next}
      className={cn('rounded-full text-white hover:bg-white/10 hover:text-white', className)}
      data-slot="reel-next-button"
      data-testid="reel-next-button"
      disabled={currentIndex === totalItems - 1}
      onClick={handleNext}
      size="icon"
      type="button"
      variant="ghost"
      {...props}
    >
      {children || <ChevronRight className="size-4" aria-hidden="true" />}
    </Button>
  );
});
ReelNextButton.displayName = 'ReelNextButton';

export type ReelPlayButtonProps = ComponentProps<typeof Button>;

export const ReelPlayButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  ReelPlayButtonProps
>(({ className, children, ...props }, ref) => {
  const { isPlaying, setIsPlaying, labels } = useReelContext();

  return (
    <Button
      ref={ref}
      aria-label={isPlaying ? labels.pause : labels.play}
      className={cn('rounded-full text-white hover:bg-white/10 hover:text-white', className)}
      data-slot="reel-play-button"
      data-testid="reel-play-button"
      onClick={() => setIsPlaying(!isPlaying)}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ||
        (isPlaying ? (
          <Pause className="size-4" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        ))}
    </Button>
  );
});
ReelPlayButton.displayName = 'ReelPlayButton';

export type ReelMuteButtonProps = ComponentProps<typeof Button>;

export const ReelMuteButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  ReelMuteButtonProps
>(({ className, children, ...props }, ref) => {
  const { isMuted, setIsMuted, labels } = useReelContext();

  return (
    <Button
      ref={ref}
      aria-label={isMuted ? labels.unmute : labels.mute}
      className={cn('rounded-full text-white hover:bg-white/10 hover:text-white', className)}
      data-slot="reel-mute-button"
      data-testid="reel-mute-button"
      onClick={() => setIsMuted(!isMuted)}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ||
        (isMuted ? (
          <VolumeX className="size-4" aria-hidden="true" />
        ) : (
          <Volume2 className="size-4" aria-hidden="true" />
        ))}
    </Button>
  );
});
ReelMuteButton.displayName = 'ReelMuteButton';

export type ReelNavigationProps = HTMLAttributes<HTMLButtonElement>;

export const ReelNavigation = React.forwardRef<HTMLButtonElement, ReelNavigationProps>(
  ({ className, ...props }, ref) => {
    const { setCurrentIndex, currentIndex, data, setIsNavigating } = useReelContext();
    const totalItems = data?.length || 0;
    const NAVIGATION_RESET_DELAY = 50;
    const HALF_WIDTH_DIVISOR = 2;

    const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      if (x < width / HALF_WIDTH_DIVISOR) {
        if (currentIndex > 0) {
          setIsNavigating(true);
          setCurrentIndex(currentIndex - 1);
          setTimeout(() => setIsNavigating(false), NAVIGATION_RESET_DELAY);
        }
      } else if (currentIndex < totalItems - 1) {
        setIsNavigating(true);
        setCurrentIndex(currentIndex + 1);
        setTimeout(() => setIsNavigating(false), NAVIGATION_RESET_DELAY);
      }
    };

    return (
      <button
        ref={ref}
        className={cn('absolute inset-0 z-10 flex', className)}
        data-slot="reel-navigation"
        data-testid="reel-navigation"
        onClick={handleClick}
        type="button"
        {...props}
      >
        <div className="flex-1 cursor-pointer" />
        <div className="flex-1 cursor-pointer" />
      </button>
    );
  }
);
ReelNavigation.displayName = 'ReelNavigation';

export type ReelOverlayProps = HTMLAttributes<HTMLDivElement>;

export const ReelOverlay = React.forwardRef<HTMLDivElement, ReelOverlayProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('pointer-events-none absolute inset-0 z-30', className)}
      data-slot="reel-overlay"
      data-testid="reel-overlay"
      {...props}
    />
  )
);
ReelOverlay.displayName = 'ReelOverlay';

export type ReelHeaderProps = HTMLAttributes<HTMLDivElement>;

export const ReelHeader = React.forwardRef<HTMLDivElement, ReelHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'absolute top-0 right-0 left-0 z-20 p-4 pt-6',
        'bg-gradient-to-b from-black/60 to-transparent',
        className
      )}
      data-slot="reel-header"
      data-testid="reel-header"
      {...props}
    />
  )
);
ReelHeader.displayName = 'ReelHeader';

export type ReelFooterProps = HTMLAttributes<HTMLDivElement>;

export const ReelFooter = React.forwardRef<HTMLDivElement, ReelFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'absolute right-0 bottom-0 left-0 z-20 p-4',
        'bg-gradient-to-t from-black/60 to-transparent',
        className
      )}
      data-slot="reel-footer"
      data-testid="reel-footer"
      {...props}
    />
  )
);
ReelFooter.displayName = 'ReelFooter';
