'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';

type TimelineContextValue = {
  activeStep: number;
  setActiveStep: (step: number) => void;
};

const TimelineContext = React.createContext<TimelineContextValue | undefined>(undefined);

const useTimeline = () => {
  const context = React.useContext(TimelineContext);
  if (!context) {
    throw new Error('useTimeline must be used within a Timeline');
  }
  return context;
};

/**
 * Timeline component props
 *
 * @description Props for the Timeline progress component.
 * Supports horizontal and vertical orientations with controlled/uncontrolled states.
 */
export type TimelineProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Default active step (uncontrolled) */
  defaultValue?: number;
  /** Active step value (controlled) */
  value?: number;
  /** Callback when active step changes */
  onValueChange?: (value: number) => void;
  /** Timeline orientation */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Custom test ID for testing
   * @default 'timeline'
   */
  testId?: string;
};

/**
 * Timeline component - Chronological event display
 *
 * @description
 * A component for displaying events or steps in chronological order.
 * Supports both horizontal and vertical layouts with step-based navigation.
 *
 * ## Features
 * - **Dual Orientation**: Horizontal or vertical layout
 * - **Step Navigation**: Track progress through steps
 * - **Controlled/Uncontrolled**: Both modes supported
 * - **Visual Indicators**: Customizable step indicators
 * - **Connectors**: Visual separators between items
 *
 * ## Use Cases
 * - Order tracking / shipping status
 * - Process workflows
 * - Activity feeds
 * - Version history
 * - Step-by-step wizards
 *
 * ## vs Stepper
 * - **Timeline**: Event-focused, chronological display
 * - **Stepper**: Form/wizard navigation, action-oriented
 *
 * ## Accessibility
 * - Semantic heading structure
 * - `aria-hidden` on decorative elements
 * - Keyboard navigable
 *
 * @example
 * ```tsx
 * // Basic timeline
 * <Timeline defaultValue={2}>
 *   <TimelineItem step={1}>
 *     <TimelineIndicator />
 *     <TimelineSeparator />
 *     <TimelineHeader>
 *       <TimelineDate>Jan 1, 2024</TimelineDate>
 *       <TimelineTitle>Order Placed</TimelineTitle>
 *     </TimelineHeader>
 *     <TimelineContent>Your order has been received.</TimelineContent>
 *   </TimelineItem>
 *   <TimelineItem step={2}>
 *     <TimelineIndicator />
 *     <TimelineSeparator />
 *     <TimelineHeader>
 *       <TimelineDate>Jan 2, 2024</TimelineDate>
 *       <TimelineTitle>Processing</TimelineTitle>
 *     </TimelineHeader>
 *     <TimelineContent>Order is being prepared.</TimelineContent>
 *   </TimelineItem>
 * </Timeline>
 *
 * // Horizontal orientation
 * <Timeline orientation="horizontal" defaultValue={1}>
 *   <TimelineItem step={1}>...</TimelineItem>
 *   <TimelineItem step={2}>...</TimelineItem>
 * </Timeline>
 *
 * // Controlled
 * const [step, setStep] = React.useState(1);
 * <Timeline value={step} onValueChange={setStep}>...</Timeline>
 * ```
 *
 * @see https://ui.shadcn.com/docs/components/timeline
 */
const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
  (
    {
      defaultValue = 1,
      value,
      onValueChange,
      orientation = 'vertical',
      className,
      testId = 'timeline',
      ...props
    },
    ref
  ) => {
    const [activeStep, setInternalStep] = React.useState(defaultValue);

    const setActiveStep = React.useCallback(
      (step: number) => {
        if (value === undefined) {
          setInternalStep(step);
        }
        onValueChange?.(step);
      },
      [value, onValueChange]
    );

    const currentStep = value ?? activeStep;

    return (
      <TimelineContext.Provider value={{ activeStep: currentStep, setActiveStep }}>
        <div
          ref={ref}
          data-slot="timeline"
          data-testid={testId}
          className={cn(
            'group/timeline flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col',
            className
          )}
          data-orientation={orientation}
          {...props}
        />
      </TimelineContext.Provider>
    );
  }
);
Timeline.displayName = 'Timeline';

/** TimelineContent component props */
export type TimelineContentProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Custom test ID for testing
   * @default 'timeline-content'
   */
  testId?: string;
};

/** TimelineContent component - content for timeline item */
const TimelineContent = React.forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ className, testId = 'timeline-content', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="timeline-content"
        data-testid={testId}
        className={cn('text-muted-foreground text-sm', className)}
        {...props}
      />
    );
  }
);
TimelineContent.displayName = 'TimelineContent';

/** TimelineDate component props */
export type TimelineDateProps = React.HTMLAttributes<HTMLTimeElement> & {
  /** Render as child element */
  asChild?: boolean;
  /**
   * Custom test ID for testing
   * @default 'timeline-date'
   */
  testId?: string;
};

/** TimelineDate component - date display for timeline item */
const TimelineDate = React.forwardRef<HTMLTimeElement, TimelineDateProps>(
  ({ asChild = false, className, testId = 'timeline-date', ...props }, ref) => {
    const Comp = asChild ? Slot : 'time';

    return (
      <Comp
        ref={ref}
        data-slot="timeline-date"
        data-testid={testId}
        className={cn(
          'text-muted-foreground mb-1 block text-xs font-medium group-data-[orientation=vertical]/timeline:max-sm:h-4',
          className
        )}
        {...props}
      />
    );
  }
);
TimelineDate.displayName = 'TimelineDate';

/** TimelineHeader component props */
export type TimelineHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Custom test ID for testing
   * @default 'timeline-header'
   */
  testId?: string;
};

/** TimelineHeader component - header container for timeline item */
const TimelineHeader = React.forwardRef<HTMLDivElement, TimelineHeaderProps>(
  ({ className, testId = 'timeline-header', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="timeline-header"
        data-testid={testId}
        className={cn(className)}
        {...props}
      />
    );
  }
);
TimelineHeader.displayName = 'TimelineHeader';

/** TimelineIndicator component props */
export type TimelineIndicatorProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Render as child element */
  asChild?: boolean;
  /**
   * Custom test ID for testing
   * @default 'timeline-indicator'
   */
  testId?: string;
};

/** TimelineIndicator component - visual indicator for timeline item */
const TimelineIndicator = React.forwardRef<HTMLDivElement, TimelineIndicatorProps>(
  ({ asChild = false, className, children, testId = 'timeline-indicator', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="timeline-indicator"
        data-testid={testId}
        className={cn(
          'border-primary/20 group-data-completed/timeline-item:border-primary/30 absolute size-3 rounded-full border-1 group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=horizontal]/timeline:left-0 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-[orientation=vertical]/timeline:top-0 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:-translate-x-1/2',
          className
        )}
        aria-hidden="true"
        {...props}
      >
        {children}
      </div>
    );
  }
);
TimelineIndicator.displayName = 'TimelineIndicator';

/** TimelineItem component props */
export type TimelineItemProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Step number for this item */
  step: number;
  /**
   * Custom test ID for testing
   * @default 'timeline-item'
   */
  testId?: string;
};

/** TimelineItem component - individual timeline entry */
const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ step, className, testId = 'timeline-item', ...props }, ref) => {
    const { activeStep } = useTimeline();

    return (
      <div
        ref={ref}
        data-slot="timeline-item"
        data-testid={testId}
        className={cn(
          'group/timeline-item has-[+[data-completed]]:[&_[data-slot=timeline-separator]]:bg-primary/20 relative flex flex-1 flex-col gap-0.5 group-data-[orientation=horizontal]/timeline:mt-8 group-data-[orientation=horizontal]/timeline:not-last:pe-8 group-data-[orientation=vertical]/timeline:ms-8 group-data-[orientation=vertical]/timeline:not-last:pb-12',
          className
        )}
        data-completed={step <= activeStep || undefined}
        {...props}
      />
    );
  }
);
TimelineItem.displayName = 'TimelineItem';

/** TimelineSeparator component props */
export type TimelineSeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Custom test ID for testing
   * @default 'timeline-separator'
   */
  testId?: string;
};

/** TimelineSeparator component - connector between timeline items */
const TimelineSeparator = React.forwardRef<HTMLDivElement, TimelineSeparatorProps>(
  ({ className, testId = 'timeline-separator', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="timeline-separator"
        data-testid={testId}
        className={cn(
          'bg-primary/10 absolute self-start group-last/timeline-item:hidden group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=horizontal]/timeline:h-0.5 group-data-[orientation=horizontal]/timeline:w-[calc(100%-1rem-0.25rem)] group-data-[orientation=horizontal]/timeline:translate-x-4.5 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:h-[calc(100%-1rem-0.25rem)] group-data-[orientation=vertical]/timeline:w-0.5 group-data-[orientation=vertical]/timeline:-translate-x-1/2 group-data-[orientation=vertical]/timeline:translate-y-4.5',
          className
        )}
        aria-hidden="true"
        {...props}
      />
    );
  }
);
TimelineSeparator.displayName = 'TimelineSeparator';

/** TimelineTitle component props */
export type TimelineTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  /**
   * Custom test ID for testing
   * @default 'timeline-title'
   */
  testId?: string;
};

/** TimelineTitle component - title for timeline item */
const TimelineTitle = React.forwardRef<HTMLHeadingElement, TimelineTitleProps>(
  ({ className, testId = 'timeline-title', ...props }, ref) => {
    return (
      <h3
        ref={ref}
        data-slot="timeline-title"
        data-testid={testId}
        className={cn('text-sm font-medium', className)}
        {...props}
      />
    );
  }
);
TimelineTitle.displayName = 'TimelineTitle';

export {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
};
