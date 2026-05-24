import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** Timeline event type */
export type TimelineEventType =
  | 'action'
  | 'alert'
  | 'comment'
  | 'creation'
  | 'deletion'
  | 'milestone'
  | 'update';

/** Timeline event status */
export type TimelineEventStatus = 'cancelled' | 'completed' | 'in_progress' | 'pending';

/** Timeline event priority */
export type TimelinePriority = 'critical' | 'high' | 'low' | 'medium';

/** Timeline orientation */
export type TimelineOrientation = 'horizontal' | 'vertical';

/** Timeline variant */
export type TimelineVariant = 'alternating' | 'centered' | 'default' | 'left' | 'right';

/** Timeline connector style */
export type TimelineConnectorStyle = 'dashed' | 'dotted' | 'none' | 'solid';

/** Timeline icon names */
export type TimelineIcon =
  | 'alert-circle'
  | 'check'
  | 'clock'
  | 'edit'
  | 'message'
  | 'plus'
  | 'star'
  | 'trash'
  | 'user';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

/** User associated with timeline event */
export interface TimelineUser {
  avatar?: string;
  email?: string;
  id: string;
  name: string;
}

/** Timeline event metadata */
export interface TimelineMetadata {
  attachments?: number;
  comments?: number;
  duration?: number;
  priority?: TimelinePriority;
  tags?: string[];
}

/** Single timeline event */
export interface FakeTimelineEvent {
  actions?: Array<{
    icon?: TimelineIcon;
    label: string;
    variant?: 'default' | 'destructive' | 'outline';
  }>;
  children?: FakeTimelineEvent[];
  color?: string;
  createdAt: Date;
  description?: string;
  icon?: TimelineIcon;
  id: string;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  metadata?: TimelineMetadata;
  relativeTime?: string;
  status: TimelineEventStatus;
  timestamp: Date;
  title: string;
  type: TimelineEventType;
  user?: TimelineUser;
}

/** Timeline component configuration */
export interface FakeTimeline {
  animate?: boolean;
  className?: string;
  collapsible?: boolean;
  connectorStyle: TimelineConnectorStyle;
  events: FakeTimelineEvent[];
  id: string;
  loading?: boolean;
  maxEvents?: number;
  orientation: TimelineOrientation;
  showConnectors?: boolean;
  variant: TimelineVariant;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

export const TIMELINE_EVENT_TYPES: TimelineEventType[] = [
  'milestone',
  'update',
  'comment',
  'action',
  'alert',
  'creation',
  'deletion',
];

export const TIMELINE_EVENT_STATUSES: TimelineEventStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
];

export const TIMELINE_PRIORITIES: TimelinePriority[] = ['low', 'medium', 'high', 'critical'];

export const TIMELINE_ORIENTATIONS: TimelineOrientation[] = ['vertical', 'horizontal'];

export const TIMELINE_VARIANTS: TimelineVariant[] = [
  'default',
  'left',
  'right',
  'centered',
  'alternating',
];

export const TIMELINE_CONNECTOR_STYLES: TimelineConnectorStyle[] = [
  'solid',
  'dashed',
  'dotted',
  'none',
];

export const TIMELINE_ICONS: TimelineIcon[] = [
  'check',
  'clock',
  'alert-circle',
  'message',
  'star',
  'user',
  'plus',
  'edit',
  'trash',
];

export const TIMELINE_EVENT_TITLES = [
  i18n.t('factory.timeline.projectStarted', 'Project Started'),
  i18n.t('factory.timeline.milestoneReached', 'Milestone Reached'),
  i18n.t('factory.timeline.codeReviewCompleted', 'Code Review Completed'),
  i18n.t('factory.timeline.featureDeployed', 'Feature Deployed'),
  i18n.t('factory.timeline.bugFixed', 'Bug Fixed'),
  i18n.t('factory.timeline.meetingScheduled', 'Meeting Scheduled'),
  i18n.t('factory.timeline.documentationUpdated', 'Documentation Updated'),
  i18n.t('factory.timeline.securityAuditPassed', 'Security Audit Passed'),
  i18n.t('factory.timeline.performanceOptimized', 'Performance Optimized'),
  i18n.t('factory.timeline.userFeedbackReceived', 'User Feedback Received'),
  i18n.t('factory.timeline.releasePublished', 'Release Published'),
  i18n.t('factory.timeline.teamMemberAdded', 'Team Member Added'),
  i18n.t('factory.timeline.configurationUpdated', 'Configuration Updated'),
  i18n.t('factory.timeline.integrationCompleted', 'Integration Completed'),
  i18n.t('factory.timeline.testingPassed', 'Testing Passed'),
];

export const TIMELINE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--destructive))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--info))',
  'hsl(var(--muted))',
];

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

/** Create a single fake user */
export function createFakeTimelineUser(overrides?: Partial<TimelineUser>): TimelineUser {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    avatar: `/images/avatars/0${faker.number.int({ min: 1, max: 5 })}.png`,
    ...overrides,
  };
}

/** Create fake metadata for timeline event */
export function createFakeTimelineMetadata(
  overrides?: Partial<TimelineMetadata>
): TimelineMetadata {
  return {
    duration: faker.number.int({ min: 1, max: 120 }),
    priority: faker.helpers.arrayElement(TIMELINE_PRIORITIES),
    comments: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 20 }), {
      probability: 0.4,
    }),
    attachments: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 5 }), {
      probability: 0.3,
    }),
    tags: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElements(['urgent', 'review', 'blocked', 'approved'], {
          min: 1,
          max: 3,
        }),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

/** Create a single fake timeline event */
export function createFakeTimelineEvent(overrides?: Partial<FakeTimelineEvent>): FakeTimelineEvent {
  const type = overrides?.type ?? faker.helpers.arrayElement(TIMELINE_EVENT_TYPES);
  const status = overrides?.status ?? faker.helpers.arrayElement(TIMELINE_EVENT_STATUSES);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(TIMELINE_EVENT_TITLES),
    description: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.7 }),
    type,
    status,
    icon: faker.helpers.arrayElement(TIMELINE_ICONS),
    color: faker.helpers.maybe(() => faker.helpers.arrayElement(TIMELINE_COLORS), {
      probability: 0.3,
    }),
    timestamp: faker.date.recent({ days: 30 }),
    createdAt: faker.date.recent({ days: 60 }),
    relativeTime: faker.helpers.arrayElement([
      i18n.t('factory.timeline.justNow', 'Just now'),
      '5 minutes ago',
      '1 hour ago',
      i18n.t('factory.timeline.yesterday', 'Yesterday'),
      '2 days ago',
      i18n.t('factory.timeline.lastWeek', 'Last week'),
    ]),
    user: faker.helpers.maybe(() => createFakeTimelineUser(), { probability: 0.8 }),
    metadata: faker.helpers.maybe(() => createFakeTimelineMetadata(), { probability: 0.5 }),
    isCollapsible: faker.datatype.boolean({ probability: 0.2 }),
    isExpanded: faker.datatype.boolean({ probability: 0.5 }),
    actions: faker.helpers.maybe(
      () => [
        {
          label: i18n.t('factory.timeline.viewDetails', 'View Details'),
          variant: 'outline' as const,
        },
        {
          label: i18n.t('factory.timeline.edit', 'Edit'),
          icon: 'edit' as const,
          variant: 'default' as const,
        },
      ],
      { probability: 0.3 }
    ),
    children: undefined, // Set by specialized factory if needed
    ...overrides,
  };
}

/** Create a single fake timeline configuration */
export function createFakeTimeline(overrides?: Partial<FakeTimeline>): FakeTimeline {
  return {
    id: faker.string.uuid(),
    orientation: faker.helpers.arrayElement(TIMELINE_ORIENTATIONS),
    variant: faker.helpers.arrayElement(TIMELINE_VARIANTS),
    connectorStyle: faker.helpers.arrayElement(TIMELINE_CONNECTOR_STYLES),
    showConnectors: faker.datatype.boolean({ probability: 0.9 }),
    collapsible: faker.datatype.boolean({ probability: 0.3 }),
    animate: faker.datatype.boolean({ probability: 0.5 }),
    loading: false,
    events: createFakeTimelineEvents(faker.number.int({ min: 3, max: 8 })),
    maxEvents: faker.helpers.maybe(() => faker.number.int({ min: 5, max: 20 }), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

/** Create multiple fake timeline events */
export function createFakeTimelineEvents(
  count: number,
  overrides?: Partial<FakeTimelineEvent>
): FakeTimelineEvent[] {
  return Array.from({ length: count }, () => createFakeTimelineEvent(overrides));
}

/** Create multiple fake timelines */
export function createFakeTimelines(
  count: number,
  overrides?: Partial<FakeTimeline>
): FakeTimeline[] {
  return Array.from({ length: count }, () => createFakeTimeline(overrides));
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/** Create a milestone event */
export function createFakeMilestoneEvent(): FakeTimelineEvent {
  return createFakeTimelineEvent({
    type: 'milestone',
    status: 'completed',
    icon: 'star',
    title: i18n.t('factory.timeline.milestoneAchieved', 'Milestone Achieved'),
    description: i18n.t(
      'factory.timeline.anImportantProjectMilestoneHas',
      'An important project milestone has been reached.'
    ),
  });
}

/** Create a pending event */
export function createFakePendingEvent(): FakeTimelineEvent {
  return createFakeTimelineEvent({
    type: 'action',
    status: 'pending',
    icon: 'clock',
    title: i18n.t('factory.timeline.pendingReview', 'Pending Review'),
  });
}

/** Create an in-progress event */
export function createFakeInProgressEvent(): FakeTimelineEvent {
  return createFakeTimelineEvent({
    type: 'update',
    status: 'in_progress',
    icon: 'clock',
    title: i18n.t('factory.timeline.workInProgress', 'Work in Progress'),
  });
}

/** Create a completed event */
export function createFakeCompletedEvent(): FakeTimelineEvent {
  return createFakeTimelineEvent({
    type: 'action',
    status: 'completed',
    icon: 'check',
    title: i18n.t('factory.timeline.taskCompleted', 'Task Completed'),
  });
}

/** Create a cancelled event */
export function createFakeCancelledEvent(): FakeTimelineEvent {
  return createFakeTimelineEvent({
    type: 'action',
    status: 'cancelled',
    icon: 'trash',
    title: i18n.t('factory.timeline.taskCancelled', 'Task Cancelled'),
  });
}

/** Create an alert event */
export function createFakeAlertEvent(): FakeTimelineEvent {
  return createFakeTimelineEvent({
    type: 'alert',
    status: 'pending',
    icon: 'alert-circle',
    title: i18n.t('factory.timeline.attentionRequired', 'Attention Required'),
    description: i18n.t(
      'factory.timeline.thisItemRequiresImmediateAttention',
      'This item requires immediate attention.'
    ),
    color: 'hsl(var(--destructive))',
  });
}

/** Create a comment event */
export function createFakeCommentEvent(): FakeTimelineEvent {
  return createFakeTimelineEvent({
    type: 'comment',
    status: 'completed',
    icon: 'message',
    title: i18n.t('factory.timeline.newComment', 'New Comment'),
    description: faker.lorem.sentence(),
    user: createFakeTimelineUser(),
  });
}

/** Create events for all statuses */
export function createFakeTimelineEventsByStatus(): FakeTimelineEvent[] {
  return TIMELINE_EVENT_STATUSES.map((status) => createFakeTimelineEvent({ status }));
}

/** Create events for all types */
export function createFakeTimelineEventsByType(): FakeTimelineEvent[] {
  return TIMELINE_EVENT_TYPES.map((type) => createFakeTimelineEvent({ type }));
}

/** Create a timeline with nested events */
export function createFakeNestedTimeline(): FakeTimeline {
  const parentEvent = createFakeTimelineEvent({
    title: i18n.t('factory.timeline.projectPhase', 'Project Phase'),
    type: 'milestone',
    isCollapsible: true,
    isExpanded: true,
  });

  parentEvent.children = createFakeTimelineEvents(3).map((event) => ({
    ...event,
    title: i18n.t('factory.timeline.subTaskTitle', 'Sub-task: {{title}}', { title: event.title }),
  }));

  return createFakeTimeline({
    events: [parentEvent, ...createFakeTimelineEvents(2)],
    collapsible: true,
  });
}

/** Create an alternating timeline */
export function createFakeAlternatingTimeline(): FakeTimeline {
  return createFakeTimeline({
    variant: 'alternating',
    events: createFakeTimelineEvents(6),
  });
}

/** Create a horizontal timeline */
export function createFakeHorizontalTimeline(): FakeTimeline {
  return createFakeTimeline({
    orientation: 'horizontal',
    events: createFakeTimelineEvents(5),
  });
}

/** Create a loading timeline */
export function createFakeLoadingTimeline(): FakeTimeline {
  return createFakeTimeline({
    loading: true,
    events: [],
  });
}

/** Create an empty timeline */
export function createFakeEmptyTimeline(): FakeTimeline {
  return createFakeTimeline({
    events: [],
  });
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/** Create variant × orientation matrix for visual testing */
export function createFakeTimelineMatrix(): FakeTimeline[][] {
  return TIMELINE_VARIANTS.map((variant) =>
    TIMELINE_ORIENTATIONS.map((orientation) =>
      createFakeTimeline({ variant, orientation, events: createFakeTimelineEvents(3) })
    )
  );
}

/** Create status × type matrix for visual testing */
export function createFakeTimelineEventMatrix(): FakeTimelineEvent[][] {
  return TIMELINE_EVENT_STATUSES.map((status) =>
    TIMELINE_EVENT_TYPES.map((type) => createFakeTimelineEvent({ status, type }))
  );
}

/** Create connector style matrix */
export function createFakeConnectorStyleMatrix(): FakeTimeline[] {
  return TIMELINE_CONNECTOR_STYLES.map((connectorStyle) =>
    createFakeTimeline({ connectorStyle, events: createFakeTimelineEvents(3) })
  );
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY FEED FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create an activity feed timeline (common use case) */
export function createFakeActivityFeed(count = 10): FakeTimeline {
  const events = Array.from({ length: count }, (_, index) => {
    const daysAgo = Math.floor(index / 2);
    return createFakeTimelineEvent({
      timestamp: faker.date.recent({ days: daysAgo + 1 }),
      user: createFakeTimelineUser(),
    });
  });

  return createFakeTimeline({
    variant: 'left',
    orientation: 'vertical',
    events,
  });
}

/** Create a project timeline (milestones and updates) */
export function createFakeProjectTimeline(): FakeTimeline {
  const events: FakeTimelineEvent[] = [
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.projectKickoff', 'Project Kickoff'),
      type: 'milestone',
      status: 'completed',
      icon: 'star',
    }),
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.designPhase', 'Design Phase'),
      type: 'update',
      status: 'completed',
      icon: 'check',
    }),
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.developmentSprint1', 'Development Sprint 1'),
      type: 'update',
      status: 'completed',
      icon: 'check',
    }),
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.codeReview', 'Code Review'),
      type: 'action',
      status: 'in_progress',
      icon: 'clock',
    }),
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.qaTesting', 'QA Testing'),
      type: 'action',
      status: 'pending',
      icon: 'clock',
    }),
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.productionRelease', 'Production Release'),
      type: 'milestone',
      status: 'pending',
      icon: 'star',
    }),
  ];

  return createFakeTimeline({
    variant: 'default',
    orientation: 'vertical',
    events,
  });
}

/** Create an order tracking timeline */
export function createFakeOrderTrackingTimeline(): FakeTimeline {
  const events: FakeTimelineEvent[] = [
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.orderPlaced', 'Order Placed'),
      type: 'creation',
      status: 'completed',
      icon: 'check',
      description: i18n.t(
        'factory.timeline.yourOrderHasBeenConfirmed',
        'Your order has been confirmed.'
      ),
    }),
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.paymentProcessed', 'Payment Processed'),
      type: 'action',
      status: 'completed',
      icon: 'check',
      description: i18n.t('factory.timeline.paymentOf9999Received', 'Payment of $99.99 received.'),
    }),
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.shipped', 'Shipped'),
      type: 'update',
      status: 'completed',
      icon: 'check',
      description: i18n.t('factory.timeline.packageHandedToCarrier', 'Package handed to carrier.'),
    }),
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.outForDelivery', 'Out for Delivery'),
      type: 'update',
      status: 'in_progress',
      icon: 'clock',
      description: i18n.t('factory.timeline.packageIsOnItsWay', 'Package is on its way to you.'),
    }),
    createFakeTimelineEvent({
      title: i18n.t('factory.timeline.delivered', 'Delivered'),
      type: 'milestone',
      status: 'pending',
      icon: 'star',
      description: i18n.t('factory.timeline.expectedDeliveryToday', 'Expected delivery today.'),
    }),
  ];

  return createFakeTimeline({
    variant: 'left',
    orientation: 'vertical',
    events,
    showConnectors: true,
  });
}
