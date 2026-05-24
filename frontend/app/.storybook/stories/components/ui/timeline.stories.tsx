import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { useTranslation } from 'react-i18next';
import {
  timelineHandlers,
  timelineStatusHandlers,
} from '@/.storybook/stories/_handlers/timeline.handlers';
import { miscStatusHandlers } from '@/.storybook/stories/_handlers/misc.handlers';
import { type FakeTimelineItem } from '@/.storybook/stories/_factories/event.factory';
import {
  createFakeActivityFeed,
  createFakeAlertEvent,
  createFakeAlternatingTimeline,
  createFakeCancelledEvent,
  createFakeCommentEvent,
  createFakeCompletedEvent,
  createFakeConnectorStyleMatrix,
  createFakeEmptyTimeline,
  createFakeHorizontalTimeline,
  createFakeInProgressEvent,
  createFakeLoadingTimeline,
  createFakeMilestoneEvent,
  createFakeNestedTimeline,
  createFakeOrderTrackingTimeline,
  createFakePendingEvent,
  createFakeProjectTimeline,
  createFakeTimeline,
  createFakeTimelineEvent,
  createFakeTimelineEventMatrix,
  createFakeTimelineEvents,
  createFakeTimelineEventsByStatus,
  createFakeTimelineEventsByType,
  createFakeTimelineMatrix,
  createFakeTimelineMetadata,
  createFakeTimelines,
  createFakeTimelineUser,
  type FakeTimeline,
  type FakeTimelineEvent as FakeTimelineEventType,
  TIMELINE_COLORS,
  TIMELINE_CONNECTOR_STYLES,
  TIMELINE_EVENT_STATUSES,
  TIMELINE_EVENT_TITLES,
  TIMELINE_EVENT_TYPES,
  TIMELINE_ICONS,
  TIMELINE_ORIENTATIONS,
  TIMELINE_PRIORITIES,
  TIMELINE_VARIANTS,
  type TimelineConnectorStyle,
  type TimelineEventStatus,
  type TimelineEventType,
  type TimelineIcon,
  type TimelineMetadata,
  type TimelineOrientation,
  type TimelinePriority,
  type TimelineUser,
  type TimelineVariant,
} from '@/.storybook/stories/_factories/timeline.factory';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertCircleIcon,
  CheckIcon,
  CircleIcon,
  ClockIcon,
  EditIcon,
  MessageSquareIcon,
  PlusIcon,
  RefreshCwIcon,
  StarIcon,
  TrashIcon,
  UserIcon,
} from 'lucide-react';
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@/components/ui/timeline';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

function TimelineDemo() {
  const { t } = useTranslation();

  const [step, setStep] = React.useState(2);

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((s) => (
          <Button
            data-timeline-step={s}
            key={s}
            onClick={() => setStep(s)}
            size="sm"
            variant={s === step ? 'default' : 'outline'}
          >
            Step {s}
          </Button>
        ))}
      </div>

      <Timeline onValueChange={setStep} value={step}>
        <TimelineItem step={1}>
          <TimelineIndicator />
          <TimelineSeparator />
          <TimelineHeader>
            <TimelineDate>Jan 10</TimelineDate>
            <TimelineTitle>{t('timeline.story.created', 'Created')}</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>
            {t('timeline.story.projectCreatedAndInitialized', 'Project created and initialized.')}
          </TimelineContent>
        </TimelineItem>
        <TimelineItem step={2}>
          <TimelineIndicator />
          <TimelineSeparator />
          <TimelineHeader>
            <TimelineDate>Jan 12</TimelineDate>
            <TimelineTitle>{t('timeline.story.reviewed', 'Reviewed')}</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>
            {t('timeline.story.peerReviewCompleted', 'Peer review completed.')}
          </TimelineContent>
        </TimelineItem>
        <TimelineItem step={3}>
          <TimelineIndicator />
          <TimelineSeparator />
          <TimelineHeader>
            <TimelineDate>Jan 14</TimelineDate>
            <TimelineTitle>{t('timeline.story.approved', 'Approved')}</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>{t('timeline.story.readyToShip', 'Ready to ship.')}</TimelineContent>
        </TimelineItem>
        <TimelineItem step={4}>
          <TimelineIndicator />
          <TimelineHeader>
            <TimelineDate>Jan 16</TimelineDate>
            <TimelineTitle>{t('timeline.story.deployed', 'Deployed')}</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>
            {t('timeline.story.liveInProduction', 'Live in production.')}
          </TimelineContent>
        </TimelineItem>
      </Timeline>
    </div>
  );
}

function I18nTimelineDemo() {
  const { t } = useTranslation();
  const [step, setStep] = React.useState(2);

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((s) => (
          <Button
            data-timeline-step={s}
            key={s}
            onClick={() => setStep(s)}
            size="sm"
            variant={s === step ? 'default' : 'outline'}
          >
            {t('timeline.stepLabel', { step: s })}
          </Button>
        ))}
      </div>

      <Timeline onValueChange={setStep} value={step}>
        <TimelineItem step={1}>
          <TimelineIndicator />
          <TimelineSeparator />
          <TimelineHeader>
            <TimelineDate>Jan 10</TimelineDate>
            <TimelineTitle>{t('timeline.title.created')}</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>{t('timeline.content.created')}</TimelineContent>
        </TimelineItem>
        <TimelineItem step={2}>
          <TimelineIndicator />
          <TimelineSeparator />
          <TimelineHeader>
            <TimelineDate>Jan 12</TimelineDate>
            <TimelineTitle>{t('timeline.title.reviewed')}</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>{t('timeline.content.reviewed')}</TimelineContent>
        </TimelineItem>
        <TimelineItem step={3}>
          <TimelineIndicator />
          <TimelineSeparator />
          <TimelineHeader>
            <TimelineDate>Jan 14</TimelineDate>
            <TimelineTitle>{t('timeline.title.approved')}</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>{t('timeline.content.approved')}</TimelineContent>
        </TimelineItem>
        <TimelineItem step={4}>
          <TimelineIndicator />
          <TimelineHeader>
            <TimelineDate>Jan 16</TimelineDate>
            <TimelineTitle>{t('timeline.title.deployed')}</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>{t('timeline.content.deployed')}</TimelineContent>
        </TimelineItem>
      </Timeline>
    </div>
  );
}

// Error display component
interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function TimelineErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="timeline-error">
      <AlertCircleIcon className="size-4" />
      <AlertTitle>
        Error {error.status}: {error.code}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {error.message}
        {error.details && (
          <ul className="mt-2 list-disc pl-4 text-sm">
            {Object.entries(error.details).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCwIcon className="mr-2 size-4" />
          Retry
        </Button>
      )}
    </Alert>
  );
}

// Loading skeleton
function TimelineLoadingSkeleton() {
  return (
    <div className="w-full max-w-3xl" data-state="loading" data-testid="timeline-loading">
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`timeline-skeleton-${String(i)}`} className="flex gap-4">
            <Skeleton className="size-3 rounded-full" />

            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Empty state
function TimelineEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="timeline-empty"
    >
      <p className="text-muted-foreground">
        {i18n.t('timeline.story.noTimelineItemsFound', 'No timeline items found')}
      </p>
    </div>
  );
}

// Get status icon based on timeline item status
function getStatusIcon(status: FakeTimelineItem['status']) {
  switch (status) {
    case 'completed': {
      return <CheckIcon className="size-3 text-green-500" />;
    }
    case 'current': {
      return <ClockIcon className="size-3 text-blue-500" />;
    }
    case 'upcoming': {
      return <CircleIcon className="size-3 text-gray-400" />;
    }
    default: {
      return null;
    }
  }
}

// Timeline with async data fetching
function TimelineWithAsyncData() {
  const [items, setItems] = React.useState<FakeTimelineItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [activeStep, setActiveStep] = React.useState(1);

  const fetchTimeline = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/timeline')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ items: FakeTimelineItem[] }>;
      })
      .then((json) => {
        setItems(json.items);
        const currentIndex = json.items.findIndex((item) => item.status === 'current');
        setActiveStep(currentIndex >= 0 ? currentIndex + 1 : 1);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  if (loading) {
    return <TimelineLoadingSkeleton />;
  }

  if (error) {
    return <TimelineErrorDisplay error={error} onRetry={fetchTimeline} />;
  }

  if (items.length === 0) {
    return <TimelineEmptyState />;
  }

  return (
    <div className="w-full max-w-3xl" data-state="success" data-testid="timeline-success">
      <Timeline value={activeStep} onValueChange={setActiveStep}>
        {items.map((item, index) => (
          <TimelineItem key={item.id} step={index + 1}>
            <TimelineIndicator>{getStatusIcon(item.status)}</TimelineIndicator>
            {index < items.length - 1 && <TimelineSeparator />}
            <TimelineHeader>
              <TimelineDate>
                {new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </TimelineDate>
              <TimelineTitle>{item.title}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>{item.description}</TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
}

// Static demo with Faker data (no API) - uses timeline.factory
function TimelineWithFakerData() {
  const events = React.useMemo(() => createFakeTimelineEvents(5), []);
  const [activeStep, setActiveStep] = React.useState(1);

  React.useEffect(() => {
    const currentIndex = events.findIndex((e) => e.status === 'in_progress');
    setActiveStep(currentIndex >= 0 ? currentIndex + 1 : 1);
  }, [events]);

  return (
    <div className="w-full max-w-3xl">
      <Timeline value={activeStep} onValueChange={setActiveStep}>
        {events.map((event, index) => (
          <TimelineItem key={event.id} step={index + 1}>
            <TimelineIndicator>
              {(() => {
                if (event.status === 'completed') {
                  return <CheckIcon className="size-3 text-green-500" />;
                }
                if (event.status === 'in_progress') {
                  return <ClockIcon className="size-3 text-blue-500" />;
                }
                return <CircleIcon className="size-3 text-gray-400" />;
              })()}
            </TimelineIndicator>
            {index < events.length - 1 && <TimelineSeparator />}
            <TimelineHeader>
              <TimelineDate>
                {event.timestamp.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </TimelineDate>
              <TimelineTitle>{event.title}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>{event.description ?? ''}</TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Timeline',
  component: TimelineDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  parameters: {
    msw: {
      handlers: timelineHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('timeline.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('timeline.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('timeline.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('timeline.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('timeline.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('timeline.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('timeline.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // Timeline Props Reference:
    // - value: Current active step (number)
    // - onValueChange: Called when step changes ((step: number) => void)
    // - className: Additional CSS classes (string)
    // - children: TimelineItem elements (ReactNode)
    //
    // TimelineItem Props Reference:
    // - step: Step number for this item (number, required)
    // - className: Additional CSS classes (string)
    // - children: Item content (ReactNode)
    // - data-completed: Auto-applied when step <= current value
    //
    // TimelineIndicator Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Custom indicator content (ReactNode)
    //
    // TimelineSeparator Props Reference:
    // - className: Additional CSS classes (string)
    // Note: Omit for the last item in the timeline
    //
    // TimelineHeader Props Reference:
    // - className: Additional CSS classes (string)
    // - children: TimelineDate and TimelineTitle (ReactNode)
    //
    // TimelineDate Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Date text (ReactNode)
    //
    // TimelineTitle Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Title text (ReactNode)
    //
    // TimelineContent Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Content description (ReactNode)
    //
    // Usage Notes:
    // - Steps are marked complete when step number <= current value
    // - Use data-completed attribute for styling completed steps
    // - TimelineSeparator connects items visually
  },
} satisfies Meta<typeof TimelineDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const getItems = () => [
      ...canvasElement.querySelectorAll<HTMLElement>('[data-slot="timeline-item"]'),
    ];

    const assertCompletedSteps = (completedSteps: number[]) => {
      const items = getItems();
      expect(items).toHaveLength(4);

      for (const [index, item] of items.entries()) {
        const step = index + 1;
        if (completedSteps.includes(step)) {
          expect(item).toHaveAttribute('data-completed');
        } else {
          expect(item).not.toHaveAttribute('data-completed');
        }
      }
    };

    expect(canvasElement.querySelectorAll('[data-slot="timeline-item"]')).toHaveLength(4);
    expect(canvasElement.querySelectorAll('[data-slot="timeline-indicator"]')).toHaveLength(4);
    expect(canvasElement.querySelectorAll('[data-slot="timeline-separator"]')).toHaveLength(3);

    // Default step is 2, so steps 1-2 are marked complete.
    assertCompletedSteps([1, 2]);

    const step4 = canvasElement.querySelector('[data-timeline-step="4"]');
    if (!(step4 instanceof HTMLButtonElement)) throw new Error('Step 4 button was not found.');

    await userEvent.click(step4);
    await waitFor(() => assertCompletedSteps([1, 2, 3, 4]));

    const step1 = canvasElement.querySelector('[data-timeline-step="1"]');
    if (!(step1 instanceof HTMLButtonElement)) throw new Error('Step 1 button was not found.');

    await userEvent.click(step1);
    await waitFor(() => assertCompletedSteps([1]));
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const timeline = canvasElement.querySelector('[data-slot="timeline"]');
    expect(timeline).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(4);
    const indicators = canvasElement.querySelectorAll('[data-slot="timeline-indicator"]');
    expect(indicators).toHaveLength(4);
  },
};

function VariantsDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('timeline.variants.basic')}</p>
        <Timeline value={2}>
          <TimelineItem step={1}>
            <TimelineIndicator />
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineTitle>{i18n.t('timeline.story.stepOne', 'Step One')}</TimelineTitle>
            </TimelineHeader>
          </TimelineItem>
          <TimelineItem step={2}>
            <TimelineIndicator />
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineTitle>{i18n.t('timeline.story.stepTwo', 'Step Two')}</TimelineTitle>
            </TimelineHeader>
          </TimelineItem>
          <TimelineItem step={3}>
            <TimelineIndicator />
            <TimelineHeader>
              <TimelineTitle>{i18n.t('timeline.story.stepThree', 'Step Three')}</TimelineTitle>
            </TimelineHeader>
          </TimelineItem>
        </Timeline>
      </div>
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('timeline.variants.withIcons')}</p>
        <Timeline value={2}>
          <TimelineItem step={1}>
            <TimelineIndicator>
              <CheckIcon className="size-3 text-green-500" />
            </TimelineIndicator>
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineTitle>{i18n.t('timeline.story.completed', 'Completed')}</TimelineTitle>
            </TimelineHeader>
          </TimelineItem>
          <TimelineItem step={2}>
            <TimelineIndicator>
              <ClockIcon className="size-3 text-blue-500" />
            </TimelineIndicator>
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineTitle>{i18n.t('timeline.story.inProgress', 'In Progress')}</TimelineTitle>
            </TimelineHeader>
          </TimelineItem>
          <TimelineItem step={3}>
            <TimelineIndicator>
              <CircleIcon className="size-3 text-gray-400" />
            </TimelineIndicator>
            <TimelineHeader>
              <TimelineTitle>{i18n.t('timeline.story.pending', 'Pending')}</TimelineTitle>
            </TimelineHeader>
          </TimelineItem>
        </Timeline>
      </div>
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('timeline.variants.withContent')}</p>
        <Timeline value={2}>
          <TimelineItem step={1}>
            <TimelineIndicator />
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineDate>Jan 10</TimelineDate>
              <TimelineTitle>{i18n.t('timeline.story.orderPlaced', 'Order Placed')}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              {i18n.t(
                'timeline.story.yourOrderHasBeenConfirmedAndIsBeingProce',
                'Your order has been confirmed and is being processed.'
              )}
            </TimelineContent>
          </TimelineItem>
          <TimelineItem step={2}>
            <TimelineIndicator />
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineDate>Jan 12</TimelineDate>
              <TimelineTitle>{i18n.t('timeline.story.shipped', 'Shipped')}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              Your package is on its way. Track your shipment for updates.
            </TimelineContent>
          </TimelineItem>
          <TimelineItem step={3}>
            <TimelineIndicator />
            <TimelineHeader>
              <TimelineDate>Jan 14</TimelineDate>
              <TimelineTitle>{i18n.t('timeline.story.delivered', 'Delivered')}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              {i18n.t(
                'timeline.story.packageWillBeDeliveredToYourAddress',
                'Package will be delivered to your address.'
              )}
            </TimelineContent>
          </TimelineItem>
        </Timeline>
      </div>
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('timeline.variants.alternating')}</p>
        <Timeline value={2}>
          <TimelineItem step={1}>
            <TimelineIndicator>
              <CheckIcon className="size-3 text-green-500" />
            </TimelineIndicator>
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineDate>Week 1</TimelineDate>
              <TimelineTitle>
                {i18n.t('timeline.story.planningPhase', 'Planning Phase')}
              </TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-sm">
                  Requirements gathering and project scope definition completed.
                </p>
              </div>
            </TimelineContent>
          </TimelineItem>
          <TimelineItem step={2}>
            <TimelineIndicator>
              <ClockIcon className="size-3 text-blue-500" />
            </TimelineIndicator>
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineDate>Week 2-3</TimelineDate>
              <TimelineTitle>
                {i18n.t('timeline.story.developmentPhase', 'Development Phase')}
              </TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-sm">
                  {i18n.t(
                    'timeline.story.coreFeaturesImplementationInProgress',
                    'Core features implementation in progress.'
                  )}
                </p>
              </div>
            </TimelineContent>
          </TimelineItem>
          <TimelineItem step={3}>
            <TimelineIndicator>
              <CircleIcon className="size-3 text-gray-400" />
            </TimelineIndicator>
            <TimelineHeader>
              <TimelineDate>Week 4</TimelineDate>
              <TimelineTitle>{i18n.t('timeline.story.launchPhase', 'Launch Phase')}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-sm">
                  {i18n.t(
                    'timeline.story.finalTestingAndDeploymentScheduled',
                    'Final testing and deployment scheduled.'
                  )}
                </p>
              </div>
            </TimelineContent>
          </TimelineItem>
        </Timeline>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const timelines = canvasElement.querySelectorAll('[data-slot="timeline"]');
    expect(timelines.length).toBe(4);
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items.length).toBeGreaterThan(0);
  },
};

function SizesDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('timeline.sizes.compact')}</p>
        <Timeline value={2} className="gap-2">
          <TimelineItem step={1}>
            <TimelineIndicator className="size-2" />
            <TimelineSeparator />
            <TimelineHeader className="py-0">
              <TimelineTitle className="text-xs">Step 1</TimelineTitle>
            </TimelineHeader>
          </TimelineItem>
          <TimelineItem step={2}>
            <TimelineIndicator className="size-2" />
            <TimelineSeparator />
            <TimelineHeader className="py-0">
              <TimelineTitle className="text-xs">Step 2</TimelineTitle>
            </TimelineHeader>
          </TimelineItem>
          <TimelineItem step={3}>
            <TimelineIndicator className="size-2" />
            <TimelineHeader className="py-0">
              <TimelineTitle className="text-xs">Step 3</TimelineTitle>
            </TimelineHeader>
          </TimelineItem>
        </Timeline>
      </div>
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('timeline.sizes.default')}</p>
        <Timeline value={2}>
          <TimelineItem step={1}>
            <TimelineIndicator />
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineDate>Jan 10</TimelineDate>
              <TimelineTitle>{i18n.t('timeline.story.stepOne', 'Step One')}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              {i18n.t('timeline.story.descriptionForStepOne', 'Description for step one.')}
            </TimelineContent>
          </TimelineItem>
          <TimelineItem step={2}>
            <TimelineIndicator />
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineDate>Jan 12</TimelineDate>
              <TimelineTitle>{i18n.t('timeline.story.stepTwo', 'Step Two')}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              {i18n.t('timeline.story.descriptionForStepTwo', 'Description for step two.')}
            </TimelineContent>
          </TimelineItem>
          <TimelineItem step={3}>
            <TimelineIndicator />
            <TimelineHeader>
              <TimelineDate>Jan 14</TimelineDate>
              <TimelineTitle>{i18n.t('timeline.story.stepThree', 'Step Three')}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              {i18n.t('timeline.story.descriptionForStepThree', 'Description for step three.')}
            </TimelineContent>
          </TimelineItem>
        </Timeline>
      </div>
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('timeline.sizes.detailed')}</p>
        <Timeline value={2} className="gap-8">
          <TimelineItem step={1}>
            <TimelineIndicator className="size-6">
              <CheckIcon className="size-4 text-green-500" />
            </TimelineIndicator>
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineDate className="text-base">January 10, 2025</TimelineDate>
              <TimelineTitle className="text-lg">
                {i18n.t('timeline.story.projectKickoff', 'Project Kickoff')}
              </TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              <div className="space-y-2">
                <p>
                  {i18n.t(
                    'timeline.story.initialProjectMeetingWithAllStakeholders',
                    'Initial project meeting with all stakeholders.'
                  )}
                </p>
                <ul className="text-muted-foreground list-disc pl-4 text-sm">
                  <li>
                    {i18n.t(
                      'timeline.story.definedProjectScopeAndObjectives',
                      'Defined project scope and objectives'
                    )}
                  </li>
                  <li>
                    {i18n.t(
                      'timeline.story.assignedTeamRolesAndResponsibilities',
                      'Assigned team roles and responsibilities'
                    )}
                  </li>
                  <li>
                    {i18n.t(
                      'timeline.story.setUpCommunicationChannels',
                      'Set up communication channels'
                    )}
                  </li>
                </ul>
              </div>
            </TimelineContent>
          </TimelineItem>
          <TimelineItem step={2}>
            <TimelineIndicator className="size-6">
              <ClockIcon className="size-4 text-blue-500" />
            </TimelineIndicator>
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineDate className="text-base">January 15, 2025</TimelineDate>
              <TimelineTitle className="text-lg">Development Sprint 1</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              <div className="space-y-2">
                <p>
                  {i18n.t(
                    'timeline.story.firstDevelopmentSprintInProgress',
                    'First development sprint in progress.'
                  )}
                </p>
                <ul className="text-muted-foreground list-disc pl-4 text-sm">
                  <li>
                    {i18n.t('timeline.story.coreInfrastructureSetup', 'Core infrastructure setup')}
                  </li>
                  <li>{i18n.t('timeline.story.databaseSchemaDesign', 'Database schema design')}</li>
                  <li>
                    {i18n.t(
                      'timeline.story.apiEndpointsImplementation',
                      'API endpoints implementation'
                    )}
                  </li>
                </ul>
              </div>
            </TimelineContent>
          </TimelineItem>
          <TimelineItem step={3}>
            <TimelineIndicator className="size-6">
              <CircleIcon className="size-4 text-gray-400" />
            </TimelineIndicator>
            <TimelineHeader>
              <TimelineDate className="text-base">January 25, 2025</TimelineDate>
              <TimelineTitle className="text-lg">
                {i18n.t('timeline.story.betaRelease', 'Beta Release')}
              </TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              <div className="space-y-2">
                <p>
                  {i18n.t(
                    'timeline.story.plannedBetaReleaseWithCoreFeatures',
                    'Planned beta release with core features.'
                  )}
                </p>
                <ul className="text-muted-foreground list-disc pl-4 text-sm">
                  <li>
                    {i18n.t('timeline.story.userAcceptanceTesting', 'User acceptance testing')}
                  </li>
                  <li>
                    {i18n.t('timeline.story.performanceOptimization', 'Performance optimization')}
                  </li>
                  <li>{i18n.t('timeline.story.bugFixesAndPolish', 'Bug fixes and polish')}</li>
                </ul>
              </div>
            </TimelineContent>
          </TimelineItem>
        </Timeline>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const timelines = canvasElement.querySelectorAll('[data-slot="timeline"]');
    expect(timelines.length).toBe(3);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const timeline = canvasElement.querySelector('[data-slot="timeline"]');
    expect(timeline).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(4);
    // Verify completed state is present (default step is 2)
    const completedItems = canvasElement.querySelectorAll(
      '[data-slot="timeline-item"][data-completed]'
    );
    expect(completedItems.length).toBeGreaterThan(0);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const timeline = canvasElement.querySelector('[data-slot="timeline"]');
    expect(timeline).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(4);
    const separators = canvasElement.querySelectorAll('[data-slot="timeline-separator"]');
    expect(separators).toHaveLength(3);
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: () => <I18nTimelineDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    await Default.play?.(context);

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('作成')).toBeInTheDocument();
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('timeline.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <TimelineWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="timeline"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items.length).toBe(5);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: timelineHandlers },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="timeline-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="timeline-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify timeline rendered with items
    expect(canvasElement.querySelector('[data-slot="timeline"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: timelineStatusHandlers.loading },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="timeline-loading"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: timelineStatusHandlers.empty },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="timeline-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('timeline.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: timelineStatusHandlers.badRequest },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('timeline.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: timelineStatusHandlers.unauthorized },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('timeline.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: timelineStatusHandlers.forbidden },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('timeline.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: timelineStatusHandlers.tooManyRequests },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: timelineStatusHandlers.unprocessableEntity },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'timeline.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: timelineStatusHandlers.internalServerError },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('timeline.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: timelineStatusHandlers.badGateway },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('timeline.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: timelineStatusHandlers.serviceUnavailable },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('timeline.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: timelineStatusHandlers.gatewayTimeout },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('timeline.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: timelineStatusHandlers.slowResponse },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="timeline-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="timeline-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('timeline.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: timelineStatusHandlers.networkError },
  },
  render: () => <TimelineWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="timeline-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: timelineHandlers },
  },
  play: async ({ canvasElement }) => {
    const timeline = canvasElement.querySelector('[data-slot="timeline"]');
    expect(timeline).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(4);
    const headers = canvasElement.querySelectorAll('[data-slot="timeline-header"]');
    expect(headers).toHaveLength(4);
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('timeline.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify timeline container exists
    const timeline = canvasElement.querySelector('[data-slot="timeline"]');
    expect(timeline).toBeInTheDocument();

    // Verify timeline items exist
    const timelineItems = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(timelineItems.length).not.toBe(0);

    // Verify timeline indicators exist
    const indicators = canvasElement.querySelectorAll('[data-slot="timeline-indicator"]');
    expect(indicators.length).not.toBe(0);

    // Verify timeline has proper semantic structure
    const headers = canvasElement.querySelectorAll('[data-slot="timeline-header"]');
    expect(headers.length).not.toBe(0);

    // Verify completed state is properly indicated
    const completedItems = canvasElement.querySelectorAll(
      '[data-slot="timeline-item"][data-completed]'
    );
    expect(completedItems.length).not.toBe(0);

    // Test keyboard navigation on step buttons
    const stepButtons = canvasElement.querySelectorAll('[data-timeline-step]');
    if (stepButtons.length > 0) {
      const firstButton = stepButtons[0];
      if (firstButton instanceof HTMLButtonElement) {
        firstButton.focus();
        expect(document.activeElement).toBe(firstButton);

        // Tab to next button
        await userEvent.tab();

        // Activate step via keyboard
        if (document.activeElement instanceof HTMLButtonElement) {
          await userEvent.keyboard('{Enter}');
        }
      }
    }

    // Verify timeline content is accessible
    const contents = canvasElement.querySelectorAll('[data-slot="timeline-content"]');
    expect(contents.length).not.toBe(0);

    // Verify separators exist (visual connection between items)
    const separators = canvasElement.querySelectorAll('[data-slot="timeline-separator"]');
    expect(separators.length).not.toBe(0);
  },
};

// ============ FACTORY WIRING: ICON HELPER ============

/** Map timeline icon name to a Lucide React component */
function getTimelineIcon(icon?: TimelineIcon) {
  switch (icon) {
    case 'check': {
      return <CheckIcon className="size-3" />;
    }
    case 'clock': {
      return <ClockIcon className="size-3" />;
    }
    case 'alert-circle': {
      return <AlertCircleIcon className="size-3" />;
    }
    case 'message': {
      return <MessageSquareIcon className="size-3" />;
    }
    case 'star': {
      return <StarIcon className="size-3" />;
    }
    case 'user': {
      return <UserIcon className="size-3" />;
    }
    case 'plus': {
      return <PlusIcon className="size-3" />;
    }
    case 'edit': {
      return <EditIcon className="size-3" />;
    }
    case 'trash': {
      return <TrashIcon className="size-3" />;
    }
    default: {
      return <CircleIcon className="size-3" />;
    }
  }
}

/** Render a list of FakeTimelineEventType items as a Timeline */
function renderFactoryEvents(events: FakeTimelineEventType[], activeStep = 1) {
  return (
    <Timeline value={activeStep}>
      {events.map((event, index) => (
        <TimelineItem key={event.id} step={index + 1}>
          <TimelineIndicator>{getTimelineIcon(event.icon)}</TimelineIndicator>
          {index < events.length - 1 && <TimelineSeparator />}
          <TimelineHeader>
            <TimelineDate>
              {event.relativeTime ?? i18n.t('timeline.story.recently', 'Recently')}
            </TimelineDate>
            <TimelineTitle>{event.title}</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>
            <div className="space-y-1">
              {event.description && <p className="text-sm">{event.description}</p>}
              {event.user && <p className="text-muted-foreground text-xs">By {event.user.name}</p>}
              {event.metadata?.priority && (
                <Badge variant="outline" className="text-xs">
                  {event.metadata.priority}
                </Badge>
              )}
              {event.metadata?.tags?.map((tag) => (
                <Badge key={tag} variant="secondary" className="mr-1 text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
}

/** Render a FakeTimeline config as a full Timeline */
function renderFactoryTimeline(config: FakeTimeline) {
  return (
    <div
      className="w-full max-w-3xl"
      data-orientation={config.orientation}
      data-testid="factory-timeline"
      data-variant={config.variant}
    >
      {config.loading && <TimelineLoadingSkeleton />}
      {!config.loading && config.events.length === 0 && <TimelineEmptyState />}
      {!config.loading && config.events.length > 0 && renderFactoryEvents(config.events)}
    </div>
  );
}

// ============ FACTORY: SINGLE ITEM FACTORIES ============

function SingleTimelineEventDemo() {
  const { t } = useTranslation();
  const event = React.useMemo(() => createFakeTimelineEvent(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="single-event-demo">
      <p className="mb-4 text-sm font-medium">{t('timeline.story.description')}</p>
      {renderFactoryEvents([event])}
    </div>
  );
}

export const SingleTimelineEvent: Story = {
  name: i18n.t('timeline.storyName.singleTimelineEvent', 'Factory: Single Event'),
  render: () => <SingleTimelineEventDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-event-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(1);
    const title = canvasElement.querySelector('[data-slot="timeline-title"]');
    expect(title).toBeInTheDocument();
    expect(title?.textContent?.length).toBeGreaterThan(0);
  },
};

function SingleTimelineConfigDemo() {
  const config = React.useMemo(() => createFakeTimeline(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="single-config-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.content')}</p>
      {renderFactoryTimeline(config)}
    </div>
  );
}

export const SingleTimelineConfig: Story = {
  name: i18n.t('timeline.storyName.singleTimelineConfig', 'Factory: Single Timeline Config'),
  render: () => <SingleTimelineConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-config-demo')).toBeInTheDocument();
    const factoryTimeline = canvasElement.querySelector('[data-testid="factory-timeline"]');
    expect(factoryTimeline).toBeInTheDocument();
  },
};

function TimelineUserDemo() {
  const user: TimelineUser = React.useMemo(() => createFakeTimelineUser(), []);
  const event = React.useMemo(
    () => createFakeTimelineEvent({ user, title: 'User Activity' }),
    [user]
  );
  return (
    <div className="w-full max-w-3xl" data-testid="user-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.a11y.label')}</p>
      {renderFactoryEvents([event])}
      <div className="mt-4 rounded border p-3 text-sm" data-testid="user-details">
        <p>
          <strong>Name:</strong> {user.name}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>ID:</strong> {user.id}
        </p>
      </div>
    </div>
  );
}

export const WithTimelineUser: Story = {
  name: i18n.t('timeline.storyName.withTimelineUser', 'Factory: Timeline User'),
  render: () => <TimelineUserDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('user-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('user-details')).toBeInTheDocument();
    expect(canvas.getByText(/Name:/)).toBeInTheDocument();
    expect(canvas.getByText(/Email:/)).toBeInTheDocument();
  },
};

function TimelineMetadataDemo() {
  const metadata: TimelineMetadata = React.useMemo(() => createFakeTimelineMetadata(), []);
  const event = React.useMemo(
    () => createFakeTimelineEvent({ metadata, title: 'Event with Metadata' }),
    [metadata]
  );
  return (
    <div className="w-full max-w-3xl" data-testid="metadata-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.content')}</p>
      {renderFactoryEvents([event])}
      <div className="mt-4 rounded border p-3 text-sm" data-testid="metadata-details">
        <p>
          <strong>Priority:</strong> {metadata.priority}
        </p>
        <p>
          <strong>Duration:</strong> {metadata.duration} min
        </p>
        {metadata.comments !== undefined && (
          <p>
            <strong>Comments:</strong> {metadata.comments}
          </p>
        )}
        {metadata.attachments !== undefined && (
          <p>
            <strong>Attachments:</strong> {metadata.attachments}
          </p>
        )}
        {metadata.tags && (
          <p>
            <strong>Tags:</strong>{' '}
            {metadata.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="mr-1">
                {tag}
              </Badge>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

export const WithTimelineMetadata: Story = {
  name: i18n.t('timeline.storyName.withTimelineMetadata', 'Factory: Timeline Metadata'),
  render: () => <TimelineMetadataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('metadata-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('metadata-details')).toBeInTheDocument();
    expect(canvas.getByText(/Priority:/)).toBeInTheDocument();
    expect(canvas.getByText(/Duration:/)).toBeInTheDocument();
  },
};

// ============ FACTORY: BULK FACTORIES ============

function BulkTimelinesDemo() {
  const timelines = React.useMemo(() => createFakeTimelines(3), []);
  return (
    <div className="w-full max-w-3xl space-y-8" data-testid="bulk-timelines-demo">
      <p className="text-sm font-medium">{i18n.t('timeline.section.variants')}</p>
      {timelines.map((config, index) => (
        <div key={config.id} className="space-y-2" data-testid={`bulk-timeline-${String(index)}`}>
          <p className="text-muted-foreground text-xs">
            Timeline {index + 1} &mdash; {config.variant} / {config.orientation}
          </p>
          {renderFactoryTimeline(config)}
        </div>
      ))}
    </div>
  );
}

export const BulkTimelines: Story = {
  name: i18n.t('timeline.storyName.bulkTimelines', 'Factory: Bulk Timelines'),
  render: () => <BulkTimelinesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('bulk-timelines-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('bulk-timeline-0')).toBeInTheDocument();
    expect(canvas.getByTestId('bulk-timeline-1')).toBeInTheDocument();
    expect(canvas.getByTestId('bulk-timeline-2')).toBeInTheDocument();
  },
};

// ============ FACTORY: SPECIALIZED EVENT FACTORIES ============

function MilestoneEventDemo() {
  const event = React.useMemo(() => createFakeMilestoneEvent(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="milestone-event-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {renderFactoryEvents([event])}
    </div>
  );
}

export const MilestoneEvent: Story = {
  name: i18n.t('timeline.storyName.milestoneEvent', 'Factory: Milestone Event'),
  render: () => <MilestoneEventDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('milestone-event-demo')).toBeInTheDocument();
    expect(canvas.getByText('Milestone Achieved')).toBeInTheDocument();
  },
};

function PendingEventDemo() {
  const event = React.useMemo(() => createFakePendingEvent(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="pending-event-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {renderFactoryEvents([event])}
    </div>
  );
}

export const PendingEvent: Story = {
  name: i18n.t('timeline.storyName.pendingEvent', 'Factory: Pending Event'),
  render: () => <PendingEventDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('pending-event-demo')).toBeInTheDocument();
    expect(canvas.getByText('Pending Review')).toBeInTheDocument();
  },
};

function InProgressEventDemo() {
  const event = React.useMemo(() => createFakeInProgressEvent(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="in-progress-event-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {renderFactoryEvents([event])}
    </div>
  );
}

export const InProgressEvent: Story = {
  name: i18n.t('timeline.storyName.inProgressEvent', 'Factory: In Progress Event'),
  render: () => <InProgressEventDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('in-progress-event-demo')).toBeInTheDocument();
    expect(canvas.getByText('Work in Progress')).toBeInTheDocument();
  },
};

function CompletedEventDemo() {
  const event = React.useMemo(() => createFakeCompletedEvent(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="completed-event-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {renderFactoryEvents([event])}
    </div>
  );
}

export const CompletedEvent: Story = {
  name: i18n.t('timeline.storyName.completedEvent', 'Factory: Completed Event'),
  render: () => <CompletedEventDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('completed-event-demo')).toBeInTheDocument();
    expect(canvas.getByText('Task Completed')).toBeInTheDocument();
  },
};

function CancelledEventDemo() {
  const event = React.useMemo(() => createFakeCancelledEvent(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="cancelled-event-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {renderFactoryEvents([event])}
    </div>
  );
}

export const CancelledEvent: Story = {
  name: i18n.t('timeline.storyName.cancelledEvent', 'Factory: Cancelled Event'),
  render: () => <CancelledEventDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('cancelled-event-demo')).toBeInTheDocument();
    expect(canvas.getByText('Task Cancelled')).toBeInTheDocument();
  },
};

function AlertEventDemo() {
  const event = React.useMemo(() => createFakeAlertEvent(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="alert-event-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {renderFactoryEvents([event])}
    </div>
  );
}

export const AlertEvent: Story = {
  name: i18n.t('timeline.storyName.alertEvent', 'Factory: Alert Event'),
  render: () => <AlertEventDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('alert-event-demo')).toBeInTheDocument();
    expect(canvas.getByText('Attention Required')).toBeInTheDocument();
  },
};

function CommentEventDemo() {
  const event = React.useMemo(() => createFakeCommentEvent(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="comment-event-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.content')}</p>
      {renderFactoryEvents([event])}
    </div>
  );
}

export const CommentEvent: Story = {
  name: i18n.t('timeline.storyName.commentEvent', 'Factory: Comment Event'),
  render: () => <CommentEventDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('comment-event-demo')).toBeInTheDocument();
    expect(canvas.getByText('New Comment')).toBeInTheDocument();
  },
};

// ============ FACTORY: EVENTS BY STATUS & TYPE ============

function EventsByStatusDemo() {
  const events = React.useMemo(() => createFakeTimelineEventsByStatus(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="events-by-status-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {renderFactoryEvents(events)}
    </div>
  );
}

export const EventsByStatus: Story = {
  name: i18n.t('timeline.storyName.eventsByStatus', 'Factory: Events by Status'),
  render: () => <EventsByStatusDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('events-by-status-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    // 4 statuses: pending, in_progress, completed, cancelled
    expect(items).toHaveLength(4);
  },
};

function EventsByTypeDemo() {
  const events = React.useMemo(() => createFakeTimelineEventsByType(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="events-by-type-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.content')}</p>
      {renderFactoryEvents(events)}
    </div>
  );
}

export const EventsByType: Story = {
  name: i18n.t('timeline.storyName.eventsByType', 'Factory: Events by Type'),
  render: () => <EventsByTypeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('events-by-type-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    // 7 types: milestone, update, comment, action, alert, creation, deletion
    expect(items).toHaveLength(7);
  },
};

// ============ FACTORY: SPECIALIZED TIMELINE CONFIGS ============

function NestedTimelineDemo() {
  const config = React.useMemo(() => createFakeNestedTimeline(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="nested-timeline-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.variants')}</p>
      {renderFactoryTimeline(config)}
      {/* Also render children of first event to show nesting */}
      {config.events[0]?.children && config.events[0].children.length > 0 && (
        <div className="mt-4 ml-8 border-l-2 pl-4" data-testid="nested-children">
          <p className="text-muted-foreground mb-2 text-xs">
            {i18n.t('timeline.story.nestedSubtasks', 'Nested sub-tasks:')}
          </p>
          {renderFactoryEvents(config.events[0].children)}
        </div>
      )}
    </div>
  );
}

export const NestedTimeline: Story = {
  name: i18n.t('timeline.storyName.nestedTimeline', 'Factory: Nested Timeline'),
  render: () => <NestedTimelineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('nested-timeline-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-timeline')).toBeInTheDocument();
    expect(canvas.getByTestId('nested-children')).toBeInTheDocument();
  },
};

function AlternatingTimelineDemo() {
  const config = React.useMemo(() => createFakeAlternatingTimeline(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="alternating-timeline-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.variants.alternating')}</p>
      {renderFactoryTimeline(config)}
    </div>
  );
}

export const AlternatingTimeline: Story = {
  name: i18n.t('timeline.storyName.alternatingTimeline', 'Factory: Alternating Timeline'),
  render: () => <AlternatingTimelineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('alternating-timeline-demo')).toBeInTheDocument();
    const ft = canvas.getByTestId('factory-timeline');
    expect(ft).toHaveAttribute('data-variant', 'alternating');
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(6);
  },
};

function HorizontalTimelineDemo() {
  const config = React.useMemo(() => createFakeHorizontalTimeline(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="horizontal-timeline-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.orientations')}</p>
      {renderFactoryTimeline(config)}
    </div>
  );
}

export const HorizontalTimeline: Story = {
  name: i18n.t('timeline.storyName.horizontalTimeline', 'Factory: Horizontal Timeline'),
  render: () => <HorizontalTimelineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('horizontal-timeline-demo')).toBeInTheDocument();
    const ft = canvas.getByTestId('factory-timeline');
    expect(ft).toHaveAttribute('data-orientation', 'horizontal');
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(5);
  },
};

function LoadingTimelineDemo() {
  const config = React.useMemo(() => createFakeLoadingTimeline(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="loading-timeline-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {renderFactoryTimeline(config)}
    </div>
  );
}

export const LoadingTimeline: Story = {
  name: i18n.t('timeline.storyName.loadingTimeline', 'Factory: Loading Timeline'),
  render: () => <LoadingTimelineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('loading-timeline-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('timeline-loading')).toBeInTheDocument();
  },
};

function EmptyTimelineDemo() {
  const config = React.useMemo(() => createFakeEmptyTimeline(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="empty-timeline-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {renderFactoryTimeline(config)}
    </div>
  );
}

export const EmptyTimeline: Story = {
  name: i18n.t('timeline.storyName.emptyTimeline', 'Factory: Empty Timeline'),
  render: () => <EmptyTimelineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('empty-timeline-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('timeline-empty')).toBeInTheDocument();
  },
};

// ============ FACTORY: MATRIX FACTORIES ============

function TimelineMatrixDemo() {
  const matrix = React.useMemo(() => createFakeTimelineMatrix(), []);
  return (
    <div className="w-full space-y-8" data-testid="timeline-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('timeline.section.variants')}</p>
      {matrix.map((row, rowIndex) => (
        <div key={`matrix-row-${String(rowIndex)}`} className="space-y-4">
          <p className="text-muted-foreground text-xs font-medium">
            Variant: {(TIMELINE_VARIANTS as readonly TimelineVariant[])[rowIndex]}
          </p>
          <div className="flex flex-wrap gap-6">
            {row.map((config, colIndex) => (
              <div
                key={config.id}
                className="min-w-[280px] flex-1 rounded border p-3"
                data-testid={`matrix-cell-${String(rowIndex)}-${String(colIndex)}`}
              >
                <p className="text-muted-foreground mb-2 text-xs">
                  {(TIMELINE_ORIENTATIONS as readonly TimelineOrientation[])[colIndex]}
                </p>
                {renderFactoryTimeline(config)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const TimelineMatrix: Story = {
  name: i18n.t('timeline.storyName.timelineMatrix', 'Factory: Variant x Orientation Matrix'),
  render: () => <TimelineMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('timeline-matrix-demo')).toBeInTheDocument();
    // 5 variants x 2 orientations = 10 cells
    expect(canvas.getByTestId('matrix-cell-0-0')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-cell-4-1')).toBeInTheDocument();
  },
};

function EventMatrixDemo() {
  const matrix = React.useMemo(() => createFakeTimelineEventMatrix(), []);
  return (
    <div className="w-full space-y-8" data-testid="event-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('timeline.section.states')}</p>
      {matrix.map((row, rowIndex) => (
        <div key={`event-row-${String(rowIndex)}`} className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">
            Status: {(TIMELINE_EVENT_STATUSES as readonly TimelineEventStatus[])[rowIndex]}
          </p>
          <div className="flex flex-wrap gap-3">
            {row.map((event, colIndex) => (
              <div
                key={event.id}
                className="min-w-[180px] rounded border p-2"
                data-testid={`event-cell-${String(rowIndex)}-${String(colIndex)}`}
              >
                <p className="text-xs font-medium">{event.title}</p>
                <p className="text-muted-foreground text-xs">
                  {(TIMELINE_EVENT_TYPES as readonly TimelineEventType[])[colIndex]}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const EventMatrix: Story = {
  name: i18n.t('timeline.storyName.eventMatrix', 'Factory: Status x Type Matrix'),
  render: () => <EventMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('event-matrix-demo')).toBeInTheDocument();
    // 4 statuses x 7 types = 28 cells
    expect(canvas.getByTestId('event-cell-0-0')).toBeInTheDocument();
    expect(canvas.getByTestId('event-cell-3-6')).toBeInTheDocument();
  },
};

function ConnectorStyleMatrixDemo() {
  const timelines = React.useMemo(() => createFakeConnectorStyleMatrix(), []);
  return (
    <div className="w-full max-w-3xl space-y-8" data-testid="connector-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('timeline.section.variants')}</p>
      {timelines.map((config, index) => (
        <div
          key={config.id}
          className="space-y-2"
          data-testid={`connector-style-${(TIMELINE_CONNECTOR_STYLES as readonly TimelineConnectorStyle[])[index]}`}
        >
          <p className="text-muted-foreground text-xs font-medium">
            Connector: {(TIMELINE_CONNECTOR_STYLES as readonly TimelineConnectorStyle[])[index]}
          </p>
          {renderFactoryTimeline(config)}
        </div>
      ))}
    </div>
  );
}

export const ConnectorStyleMatrix: Story = {
  name: i18n.t('timeline.storyName.connectorStyleMatrix', 'Factory: Connector Style Matrix'),
  render: () => <ConnectorStyleMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('connector-matrix-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('connector-style-solid')).toBeInTheDocument();
    expect(canvas.getByTestId('connector-style-dashed')).toBeInTheDocument();
    expect(canvas.getByTestId('connector-style-dotted')).toBeInTheDocument();
    expect(canvas.getByTestId('connector-style-none')).toBeInTheDocument();
  },
};

// ============ FACTORY: ACTIVITY FEED & PROJECT TIMELINES ============

function ActivityFeedDemo() {
  const { t } = useTranslation();
  const config = React.useMemo(() => createFakeActivityFeed(8), []);
  return (
    <div className="w-full max-w-3xl" data-testid="activity-feed-demo">
      <p className="mb-4 text-sm font-medium">{t('timeline.section.content')}</p>
      {renderFactoryTimeline(config)}
    </div>
  );
}

export const ActivityFeed: Story = {
  name: i18n.t('timeline.storyName.activityFeed', 'Factory: Activity Feed'),
  render: () => <ActivityFeedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('activity-feed-demo')).toBeInTheDocument();
    const ft = canvas.getByTestId('factory-timeline');
    expect(ft).toHaveAttribute('data-variant', 'left');
    expect(ft).toHaveAttribute('data-orientation', 'vertical');
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(8);
  },
};

function ProjectTimelineDemo() {
  const config = React.useMemo(() => createFakeProjectTimeline(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="project-timeline-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.content')}</p>
      {renderFactoryTimeline(config)}
    </div>
  );
}

export const ProjectTimeline: Story = {
  name: i18n.t('timeline.storyName.projectTimeline', 'Factory: Project Timeline'),
  render: () => <ProjectTimelineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('project-timeline-demo')).toBeInTheDocument();
    expect(canvas.getByText('Project Kickoff')).toBeInTheDocument();
    expect(canvas.getByText('Design Phase')).toBeInTheDocument();
    expect(canvas.getByText('Production Release')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(6);
  },
};

function OrderTrackingTimelineDemo() {
  const config = React.useMemo(() => createFakeOrderTrackingTimeline(), []);
  return (
    <div className="w-full max-w-3xl" data-testid="order-tracking-demo">
      <p className="mb-4 text-sm font-medium">{i18n.t('timeline.section.content')}</p>
      {renderFactoryTimeline(config)}
    </div>
  );
}

export const OrderTrackingTimeline: Story = {
  name: i18n.t('timeline.storyName.orderTrackingTimeline', 'Factory: Order Tracking Timeline'),
  render: () => <OrderTrackingTimelineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('order-tracking-demo')).toBeInTheDocument();
    expect(canvas.getByText('Order Placed')).toBeInTheDocument();
    expect(canvas.getByText('Shipped')).toBeInTheDocument();
    expect(canvas.getByText('Delivered')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="timeline-item"]');
    expect(items).toHaveLength(5);
  },
};

// ============ FACTORY: CONSTANTS SHOWCASE ============

function ConstantsShowcaseDemo() {
  return (
    <div className="w-full max-w-4xl space-y-6" data-testid="constants-showcase">
      <p className="text-sm font-medium">{i18n.t('timeline.story.description')}</p>

      <div className="space-y-3" data-testid="event-types-section">
        <p className="text-xs font-medium">Event Types ({TIMELINE_EVENT_TYPES.length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_EVENT_TYPES.map((type: TimelineEventType) => (
            <Badge key={type} variant="outline">
              {type}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3" data-testid="event-statuses-section">
        <p className="text-xs font-medium">Event Statuses ({TIMELINE_EVENT_STATUSES.length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_EVENT_STATUSES.map((status: TimelineEventStatus) => (
            <Badge key={status} variant="secondary">
              {status}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3" data-testid="priorities-section">
        <p className="text-xs font-medium">Priorities ({TIMELINE_PRIORITIES.length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_PRIORITIES.map((priority: TimelinePriority) => (
            <Badge key={priority} variant="outline">
              {priority}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3" data-testid="orientations-section">
        <p className="text-xs font-medium">Orientations ({TIMELINE_ORIENTATIONS.length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_ORIENTATIONS.map((o: TimelineOrientation) => (
            <Badge key={o} variant="secondary">
              {o}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3" data-testid="variants-section">
        <p className="text-xs font-medium">Variants ({TIMELINE_VARIANTS.length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_VARIANTS.map((v: TimelineVariant) => (
            <Badge key={v} variant="outline">
              {v}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3" data-testid="connector-styles-section">
        <p className="text-xs font-medium">Connector Styles ({TIMELINE_CONNECTOR_STYLES.length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_CONNECTOR_STYLES.map((style: TimelineConnectorStyle) => (
            <Badge key={style} variant="secondary">
              {style}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3" data-testid="icons-section">
        <p className="text-xs font-medium">Icons ({TIMELINE_ICONS.length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_ICONS.map((icon: TimelineIcon) => (
            <div key={icon} className="flex items-center gap-1 rounded border px-2 py-1 text-xs">
              {getTimelineIcon(icon)}
              <span>{icon}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3" data-testid="event-titles-section">
        <p className="text-xs font-medium">Event Titles ({TIMELINE_EVENT_TITLES.length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_EVENT_TITLES.map((title: string) => (
            <Badge key={title} variant="outline">
              {title}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3" data-testid="colors-section">
        <p className="text-xs font-medium">Colors ({TIMELINE_COLORS.length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_COLORS.map((color: string) => (
            <div key={color} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
              <div className="size-3 rounded-full" style={{ backgroundColor: color }} />
              <span>{color}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const ConstantsShowcase: Story = {
  name: i18n.t('timeline.storyName.constantsShowcase', 'Factory: Constants Showcase'),
  render: () => <ConstantsShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constants-showcase')).toBeInTheDocument();
    expect(canvas.getByTestId('event-types-section')).toBeInTheDocument();
    expect(canvas.getByTestId('event-statuses-section')).toBeInTheDocument();
    expect(canvas.getByTestId('priorities-section')).toBeInTheDocument();
    expect(canvas.getByTestId('orientations-section')).toBeInTheDocument();
    expect(canvas.getByTestId('variants-section')).toBeInTheDocument();
    expect(canvas.getByTestId('connector-styles-section')).toBeInTheDocument();
    expect(canvas.getByTestId('icons-section')).toBeInTheDocument();
    expect(canvas.getByTestId('event-titles-section')).toBeInTheDocument();
    expect(canvas.getByTestId('colors-section')).toBeInTheDocument();
    // Verify counts
    expect(canvas.getByText(/Event Types \(7\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Event Statuses \(4\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Priorities \(4\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Orientations \(2\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Variants \(5\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Connector Styles \(4\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Icons \(9\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Event Titles \(15\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Colors \(7\)/)).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// MISC STATUS HANDLER STORIES
// ============================================================================

export const MiscError400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscError401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscError403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscError404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscError422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscError429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscError500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscError502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscError503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscError504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscLoading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscSlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscNetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MiscEmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: miscStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: timelineStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: timelineStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: timelineStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: timelineStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerMiscSuccess: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.handlerMiscSuccess', 'Handler: Misc Success'),
  parameters: { msw: { handlers: miscStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerMiscEmptyTimeline: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.handlerMiscEmptyTimeline', 'Handler: Misc Empty Timeline'),
  parameters: { msw: { handlers: miscStatusHandlers.emptyTimeline } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerMiscEmptyReel: Story = {
  ...Default,
  name: i18n.t('timeline.storyName.handlerMiscEmptyReel', 'Handler: Misc Empty Reel'),
  parameters: { msw: { handlers: miscStatusHandlers.emptyReel } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
