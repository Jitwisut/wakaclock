'use client';

import { cn } from '@/lib/utils';
import React, { forwardRef } from 'react';

/**
 * PromptLoader component props
 *
 * @description Props for the unified loader component with multiple variants.
 */
export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Loader variant style */
  variant?:
    | 'circular'
    | 'classic'
    | 'pulse'
    | 'pulse-dot'
    | 'dots'
    | 'typing'
    | 'wave'
    | 'bars'
    | 'terminal'
    | 'text-blink'
    | 'text-shimmer'
    | 'loading-dots';
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
  /**
   * Custom test ID for testing
   * @default 'prompt-loader'
   */
  testId?: string;
}

/** CircularLoader component props */
export interface CircularLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
}

/** CircularLoader component - spinning border animation loader */
const CircularLoader = forwardRef<HTMLDivElement, CircularLoaderProps>(
  ({ className, size = 'md', text = 'Loading', ...props }, ref) => {
    const sizeClasses = {
      sm: 'size-4',
      md: 'size-5',
      lg: 'size-6',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader"
        data-testid="prompt-loader"
        className={cn(
          'border-primary animate-spin rounded-full border-2 border-t-transparent',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        <span className="sr-only">{text}</span>
      </div>
    );
  }
);
CircularLoader.displayName = 'CircularLoader';

/** ClassicLoader component props */
export interface ClassicLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
}

/** ClassicLoader component - iOS-style spinner with fading bars */
const ClassicLoader = forwardRef<HTMLDivElement, ClassicLoaderProps>(
  ({ className, size = 'md', text = 'Loading', ...props }, ref) => {
    const sizeClasses = {
      sm: 'size-4',
      md: 'size-5',
      lg: 'size-6',
    };

    const barSizes = {
      sm: { height: '6px', width: '1.5px' },
      md: { height: '8px', width: '2px' },
      lg: { height: '10px', width: '2.5px' },
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-classic"
        data-testid="prompt-loader-classic"
        className={cn('relative', sizeClasses[size], className)}
        {...props}
      >
        <div className="absolute h-full w-full">
          {[...Array(12)].map((_, i) => (
            <div
              key={`spinner-bar-${i}`}
              className="bg-primary absolute animate-[spinner-fade_1.2s_linear_infinite] rounded-full"
              style={{
                top: '0',
                left: '50%',
                marginLeft: size === 'sm' ? '-0.75px' : size === 'lg' ? '-1.25px' : '-1px',
                transformOrigin: `${size === 'sm' ? '0.75px' : size === 'lg' ? '1.25px' : '1px'} ${size === 'sm' ? '10px' : size === 'lg' ? '14px' : '12px'}`,
                transform: `rotate(${i * 30}deg)`,
                opacity: 0,
                animationDelay: `${i * 0.1}s`,
                height: barSizes[size].height,
                width: barSizes[size].width,
              }}
            />
          ))}
        </div>
        <span className="sr-only">{text}</span>
      </div>
    );
  }
);
ClassicLoader.displayName = 'ClassicLoader';

/** PulseLoader component props */
export interface PulseLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
}

/** PulseLoader component - pulsing ring animation loader */
const PulseLoader = forwardRef<HTMLDivElement, PulseLoaderProps>(
  ({ className, size = 'md', text = 'Loading', ...props }, ref) => {
    const sizeClasses = {
      sm: 'size-4',
      md: 'size-5',
      lg: 'size-6',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-pulse"
        data-testid="prompt-loader-pulse"
        className={cn('relative', sizeClasses[size], className)}
        {...props}
      >
        <div className="border-primary absolute inset-0 animate-[thin-pulse_1.5s_ease-in-out_infinite] rounded-full border-2" />
        <span className="sr-only">{text}</span>
      </div>
    );
  }
);
PulseLoader.displayName = 'PulseLoader';

/** PulseDotLoader component props */
export interface PulseDotLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
}

/** PulseDotLoader component - pulsing dot animation loader */
const PulseDotLoader = forwardRef<HTMLDivElement, PulseDotLoaderProps>(
  ({ className, size = 'md', text = 'Loading', ...props }, ref) => {
    const sizeClasses = {
      sm: 'size-1',
      md: 'size-2',
      lg: 'size-3',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-pulse-dot"
        data-testid="prompt-loader-pulse-dot"
        className={cn(
          'bg-primary animate-[pulse-dot_1.2s_ease-in-out_infinite] rounded-full',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        <span className="sr-only">{text}</span>
      </div>
    );
  }
);
PulseDotLoader.displayName = 'PulseDotLoader';

/** DotsLoader component props */
export interface DotsLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
}

/** DotsLoader component - bouncing dots animation loader */
const DotsLoader = forwardRef<HTMLDivElement, DotsLoaderProps>(
  ({ className, size = 'md', text = 'Loading', ...props }, ref) => {
    const dotSizes = {
      sm: 'h-1.5 w-1.5',
      md: 'h-2 w-2',
      lg: 'h-2.5 w-2.5',
    };

    const containerSizes = {
      sm: 'h-4',
      md: 'h-5',
      lg: 'h-6',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-dots"
        data-testid="prompt-loader-dots"
        className={cn('flex items-center space-x-1', containerSizes[size], className)}
        {...props}
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={`dot-${i}`}
            className={cn(
              'bg-primary animate-[bounce-dots_1.4s_ease-in-out_infinite] rounded-full',
              dotSizes[size]
            )}
            style={{
              animationDelay: `${i * 160}ms`,
            }}
          />
        ))}
        <span className="sr-only">{text}</span>
      </div>
    );
  }
);
DotsLoader.displayName = 'DotsLoader';

/** TypingLoader component props */
export interface TypingLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
}

/** TypingLoader component - typing indicator animation loader */
const TypingLoader = forwardRef<HTMLDivElement, TypingLoaderProps>(
  ({ className, size = 'md', text = 'Loading', ...props }, ref) => {
    const dotSizes = {
      sm: 'h-1 w-1',
      md: 'h-1.5 w-1.5',
      lg: 'h-2 w-2',
    };

    const containerSizes = {
      sm: 'h-4',
      md: 'h-5',
      lg: 'h-6',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-typing"
        data-testid="prompt-loader-typing"
        className={cn('flex items-center space-x-1', containerSizes[size], className)}
        {...props}
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={`typing-dot-${i}`}
            className={cn('bg-primary animate-[typing_1s_infinite] rounded-full', dotSizes[size])}
            style={{
              animationDelay: `${i * 250}ms`,
            }}
          />
        ))}
        <span className="sr-only">{text}</span>
      </div>
    );
  }
);
TypingLoader.displayName = 'TypingLoader';

/** WaveLoader component props */
export interface WaveLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
}

/** WaveLoader component - audio wave animation loader */
const WaveLoader = forwardRef<HTMLDivElement, WaveLoaderProps>(
  ({ className, size = 'md', text = 'Loading', ...props }, ref) => {
    const barWidths = {
      sm: 'w-0.5',
      md: 'w-0.5',
      lg: 'w-1',
    };

    const containerSizes = {
      sm: 'h-4',
      md: 'h-5',
      lg: 'h-6',
    };

    const heights = {
      sm: ['6px', '9px', '12px', '9px', '6px'],
      md: ['8px', '12px', '16px', '12px', '8px'],
      lg: ['10px', '15px', '20px', '15px', '10px'],
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-wave"
        data-testid="prompt-loader-wave"
        className={cn('flex items-center gap-0.5', containerSizes[size], className)}
        {...props}
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={`wave-bar-${i}`}
            className={cn(
              'bg-primary animate-[wave_1s_ease-in-out_infinite] rounded-full',
              barWidths[size]
            )}
            style={{
              animationDelay: `${i * 100}ms`,
              height: heights[size][i],
            }}
          />
        ))}
        <span className="sr-only">{text}</span>
      </div>
    );
  }
);
WaveLoader.displayName = 'WaveLoader';

/** BarsLoader component props */
export interface BarsLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
}

/** BarsLoader component - vertical bars animation loader */
const BarsLoader = forwardRef<HTMLDivElement, BarsLoaderProps>(
  ({ className, size = 'md', text = 'Loading', ...props }, ref) => {
    const barWidths = {
      sm: 'w-1',
      md: 'w-1.5',
      lg: 'w-2',
    };

    const containerSizes = {
      sm: 'h-4 gap-1',
      md: 'h-5 gap-1.5',
      lg: 'h-6 gap-2',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-bars"
        data-testid="prompt-loader-bars"
        className={cn('flex', containerSizes[size], className)}
        {...props}
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={`bars-item-${i}`}
            className={cn(
              'bg-primary h-full animate-[wave-bars_1.2s_ease-in-out_infinite]',
              barWidths[size]
            )}
            style={{
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
        <span className="sr-only">{text}</span>
      </div>
    );
  }
);
BarsLoader.displayName = 'BarsLoader';

/** TerminalLoader component props */
export interface TerminalLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible text for screen readers */
  text?: string;
}

/** TerminalLoader component - terminal cursor blink animation loader */
const TerminalLoader = forwardRef<HTMLDivElement, TerminalLoaderProps>(
  ({ className, size = 'md', text = 'Loading', ...props }, ref) => {
    const cursorSizes = {
      sm: 'h-3 w-1.5',
      md: 'h-4 w-2',
      lg: 'h-5 w-2.5',
    };

    const textSizes = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };

    const containerSizes = {
      sm: 'h-4',
      md: 'h-5',
      lg: 'h-6',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-terminal"
        data-testid="prompt-loader-terminal"
        className={cn('flex items-center space-x-1', containerSizes[size], className)}
        {...props}
      >
        <span className={cn('text-primary font-mono', textSizes[size])}>{'>'}</span>
        <div className={cn('bg-primary animate-[blink_1s_step-end_infinite]', cursorSizes[size])} />
        <span className="sr-only">{text}</span>
      </div>
    );
  }
);
TerminalLoader.displayName = 'TerminalLoader';

/** TextBlinkLoader component props */
export interface TextBlinkLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Text to display */
  text?: string;
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
}

/** TextBlinkLoader component - blinking text animation loader */
const TextBlinkLoader = forwardRef<HTMLDivElement, TextBlinkLoaderProps>(
  ({ text = 'Thinking', className, size = 'md', ...props }, ref) => {
    const textSizes = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-text-blink"
        data-testid="prompt-loader-text-blink"
        className={cn(
          'animate-[text-blink_2s_ease-in-out_infinite] font-medium',
          textSizes[size],
          className
        )}
        {...props}
      >
        {text}
      </div>
    );
  }
);
TextBlinkLoader.displayName = 'TextBlinkLoader';

/** TextShimmerLoader component props */
export interface TextShimmerLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Text to display */
  text?: string;
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
}

/** TextShimmerLoader component - shimmer gradient text animation loader */
const TextShimmerLoader = forwardRef<HTMLDivElement, TextShimmerLoaderProps>(
  ({ text = 'Thinking', className, size = 'md', ...props }, ref) => {
    const textSizes = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-text-shimmer"
        data-testid="prompt-loader-text-shimmer"
        className={cn(
          'bg-[linear-gradient(to_right,var(--muted-foreground)_40%,var(--foreground)_60%,var(--muted-foreground)_80%)]',
          'bg-[200%_auto] bg-clip-text font-medium text-transparent',
          'animate-[shimmer_4s_infinite_linear]',
          textSizes[size],
          className
        )}
        {...props}
      >
        {text}
      </div>
    );
  }
);
TextShimmerLoader.displayName = 'TextShimmerLoader';

/** TextDotsLoader component props */
export interface TextDotsLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Text to display before the dots */
  text?: string;
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg';
}

/** TextDotsLoader component - text with animated trailing dots */
const TextDotsLoader = forwardRef<HTMLDivElement, TextDotsLoaderProps>(
  ({ className, text = 'Thinking', size = 'md', ...props }, ref) => {
    const textSizes = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };

    return (
      <div
        ref={ref}
        data-slot="prompt-loader-text-dots"
        data-testid="prompt-loader-text-dots"
        className={cn('inline-flex items-center', className)}
        {...props}
      >
        <span className={cn('text-primary font-medium', textSizes[size])}>{text}</span>
        <span className="inline-flex">
          <span className="text-primary animate-[loading-dots_1.4s_infinite_0.2s]">.</span>
          <span className="text-primary animate-[loading-dots_1.4s_infinite_0.4s]">.</span>
          <span className="text-primary animate-[loading-dots_1.4s_infinite_0.6s]">.</span>
        </span>
      </div>
    );
  }
);
TextDotsLoader.displayName = 'TextDotsLoader';

/**
 * PromptLoader component - Unified loader with multiple variants
 *
 * @description
 * A comprehensive loader component with 12 different animation styles.
 * Choose the variant that best matches your application's design.
 *
 * ## Variants
 * - **circular**: Spinning border (default)
 * - **classic**: iOS-style spinner with bars
 * - **pulse**: Pulsing ring
 * - **pulse-dot**: Pulsing single dot
 * - **dots**: Bouncing dots
 * - **typing**: Chat typing indicator
 * - **wave**: Audio wave bars
 * - **bars**: Vertical bar animation
 * - **terminal**: Blinking cursor
 * - **text-blink**: Blinking text
 * - **text-shimmer**: Gradient shimmer text
 * - **loading-dots**: Text with animated dots
 *
 * ## Use Cases
 * - Chat "AI is typing" indicators
 * - Form submission loading
 * - Content loading states
 * - Processing indicators
 *
 * ## Accessibility
 * - Screen reader text via `text` prop
 * - sr-only spans for all variants
 *
 * @example
 * ```tsx
 * // Default circular spinner
 * <PromptLoader />
 *
 * // Typing indicator
 * <PromptLoader variant="typing" size="sm" />
 *
 * // Text with shimmer
 * <PromptLoader variant="text-shimmer" text="Thinking" />
 *
 * // Large wave animation
 * <PromptLoader variant="wave" size="lg" />
 * ```
 */
const PromptLoader = forwardRef<HTMLDivElement, LoaderProps>(
  (
    { variant = 'circular', size = 'md', text, className, testId = 'prompt-loader', ...props },
    ref
  ) => {
    switch (variant) {
      case 'circular':
        return (
          <CircularLoader ref={ref} size={size} className={className} text={text} {...props} />
        );
      case 'classic':
        return <ClassicLoader ref={ref} size={size} className={className} text={text} {...props} />;
      case 'pulse':
        return <PulseLoader ref={ref} size={size} className={className} text={text} {...props} />;
      case 'pulse-dot':
        return (
          <PulseDotLoader ref={ref} size={size} className={className} text={text} {...props} />
        );
      case 'dots':
        return <DotsLoader ref={ref} size={size} className={className} text={text} {...props} />;
      case 'typing':
        return <TypingLoader ref={ref} size={size} className={className} text={text} {...props} />;
      case 'wave':
        return <WaveLoader ref={ref} size={size} className={className} text={text} {...props} />;
      case 'bars':
        return <BarsLoader ref={ref} size={size} className={className} text={text} {...props} />;
      case 'terminal':
        return (
          <TerminalLoader ref={ref} size={size} className={className} text={text} {...props} />
        );
      case 'text-blink':
        return (
          <TextBlinkLoader ref={ref} text={text} size={size} className={className} {...props} />
        );
      case 'text-shimmer':
        return (
          <TextShimmerLoader ref={ref} text={text} size={size} className={className} {...props} />
        );
      case 'loading-dots':
        return (
          <TextDotsLoader ref={ref} text={text} size={size} className={className} {...props} />
        );
      default:
        return (
          <CircularLoader ref={ref} size={size} className={className} text={text} {...props} />
        );
    }
  }
);
PromptLoader.displayName = 'PromptLoader';

export {
  PromptLoader,
  CircularLoader,
  ClassicLoader,
  PulseLoader,
  PulseDotLoader,
  DotsLoader,
  TypingLoader,
  WaveLoader,
  BarsLoader,
  TerminalLoader,
  TextBlinkLoader,
  TextShimmerLoader,
  TextDotsLoader,
};
