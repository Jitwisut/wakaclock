/**
 * @fileoverview Factory functions for generating fake Kanban component data
 * @module kanban.factory
 * @description Provides comprehensive test data generation for Kanban board components
 * including boards, columns, cards, assignees, tags, and activities.
 *
 * @example
 * ```typescript
 * import { createFakeKanbanBoard, createFakeKanbanCard } from './_factories/kanban.factory';
 *
 * // Create a full board with columns and cards
 * const board = createFakeKanbanBoard();
 *
 * // Create a single card
 * const card = createFakeKanbanCard();
 * ```
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Kanban card priority levels
 * @description Priority levels for organizing and filtering cards
 */
export type KanbanPriority = 'high' | 'low' | 'medium' | 'urgent';

/**
 * Kanban column status types
 * @description Status values representing workflow stages
 */
export type KanbanStatus = 'done' | 'in-progress' | 'review' | 'todo';

// ============================================================================
// CONSTANTS
// ============================================================================

/** All available priority levels */
export const KANBAN_PRIORITIES: KanbanPriority[] = ['low', 'medium', 'high', 'urgent'];

/** All available status values */
export const KANBAN_STATUSES: KanbanStatus[] = ['todo', 'in-progress', 'review', 'done'];

export interface FakeKanbanAssignee {
  avatar: string;
  email: string;
  id: string;
  name: string;
}

export function createFakeKanbanAssignee(): FakeKanbanAssignee {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    avatar: faker.image.avatar(),
    email: faker.internet.email(),
  };
}

export interface FakeKanbanTag {
  color: string;
  id: string;
  label: string;
}

/** Available tag colors */
export const KANBAN_TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

/** Available tag labels */
export const KANBAN_TAG_LABELS = [
  'bug',
  'feature',
  'docs',
  'urgent',
  'blocked',
  'design',
  'backend',
  'frontend',
  'testing',
];

// Aliases for backward compatibility
const TAG_COLORS = KANBAN_TAG_COLORS;
const TAG_LABELS = KANBAN_TAG_LABELS;

export function createFakeKanbanTag(): FakeKanbanTag {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(TAG_LABELS),
    color: faker.helpers.arrayElement(TAG_COLORS),
  };
}

export interface FakeKanbanCard {
  assignee?: FakeKanbanAssignee;
  assignees?: FakeKanbanAssignee[];
  attachments: number;
  checklist?: {
    completed: number;
    total: number;
  };
  comments: number;
  createdAt: string;
  description: string;
  dueDate?: string;
  id: string;
  priority: KanbanPriority;
  tags: FakeKanbanTag[];
  title: string;
  updatedAt: string;
}

export function createFakeKanbanCard(overrides?: Partial<FakeKanbanCard>): FakeKanbanCard {
  const hasMultipleAssignees = faker.datatype.boolean({ probability: 0.3 });
  const hasChecklist = faker.datatype.boolean({ probability: 0.4 });
  const checklistTotal = hasChecklist ? faker.number.int({ min: 3, max: 10 }) : 0;

  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    description: faker.lorem.paragraph(),
    priority: faker.helpers.arrayElement<KanbanPriority>(['low', 'medium', 'high', 'urgent']),
    assignee:
      !hasMultipleAssignees && faker.datatype.boolean({ probability: 0.7 })
        ? createFakeKanbanAssignee()
        : undefined,
    assignees: hasMultipleAssignees
      ? Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () =>
          createFakeKanbanAssignee()
        )
      : undefined,
    dueDate: faker.datatype.boolean({ probability: 0.6 })
      ? faker.date.soon({ days: 14 }).toISOString()
      : undefined,
    tags: faker.helpers.arrayElements(
      Array.from({ length: 5 }, () => createFakeKanbanTag()),
      { min: 0, max: 3 }
    ),
    comments: faker.number.int({ min: 0, max: 15 }),
    attachments: faker.number.int({ min: 0, max: 5 }),
    checklist: hasChecklist
      ? {
          total: checklistTotal,
          completed: faker.number.int({ min: 0, max: checklistTotal }),
        }
      : undefined,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export interface FakeKanbanColumn {
  cards: FakeKanbanCard[];
  color?: string;
  id: string;
  limit?: number;
  status: KanbanStatus;
  title: string;
}

const COLUMN_CONFIGS: Array<{ color: string; status: KanbanStatus; title: string }> = [
  { title: i18n.t('factory.kanban.toDo', 'To Do'), status: 'todo', color: '#6b7280' },
  {
    title: i18n.t('factory.kanban.inProgress', 'In Progress'),
    status: 'in-progress',
    color: '#3b82f6',
  },
  { title: i18n.t('factory.kanban.review', 'Review'), status: 'review', color: '#f59e0b' },
  { title: i18n.t('factory.kanban.done', 'Done'), status: 'done', color: '#22c55e' },
];

export function createFakeKanbanColumn(
  config: (typeof COLUMN_CONFIGS)[0],
  cardCount?: number
): FakeKanbanColumn {
  return {
    id: faker.string.uuid(),
    title: config.title,
    status: config.status,
    cards: Array.from({ length: cardCount ?? faker.number.int({ min: 1, max: 6 }) }, () =>
      createFakeKanbanCard()
    ),
    limit: faker.datatype.boolean({ probability: 0.3 })
      ? faker.number.int({ min: 5, max: 10 })
      : undefined,
    color: config.color,
  };
}

export function createFakeKanbanBoard(): FakeKanbanColumn[] {
  return COLUMN_CONFIGS.map((config) => createFakeKanbanColumn(config));
}

export interface FakeKanbanBoardResponse {
  columns: FakeKanbanColumn[];
  createdAt: string;
  id: string;
  members: FakeKanbanAssignee[];
  name: string;
  updatedAt: string;
}

export function createFakeKanbanBoardResponse(): FakeKanbanBoardResponse {
  return {
    id: faker.string.uuid(),
    name: faker.company.catchPhrase(),
    columns: createFakeKanbanBoard(),
    members: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () =>
      createFakeKanbanAssignee()
    ),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
  };
}

export interface FakeKanbanActivity {
  action: string;
  id: string;
  target: string;
  timestamp: string;
  user: FakeKanbanAssignee;
}

export function createFakeKanbanActivity(): FakeKanbanActivity {
  const actions = [
    i18n.t('factory.kanban.createdCard', 'created card'),
    i18n.t('factory.kanban.movedCard', 'moved card'),
    i18n.t('factory.kanban.commentedOn', 'commented on'),
    i18n.t('factory.kanban.assigned', 'assigned'),
    i18n.t('factory.kanban.changedPriorityOf', 'changed priority of'),
    i18n.t('factory.kanban.addedTagTo', 'added tag to'),
    i18n.t('factory.kanban.completedChecklistItemIn', 'completed checklist item in'),
    i18n.t('factory.kanban.attachedFileTo', 'attached file to'),
  ];

  return {
    id: faker.string.uuid(),
    user: createFakeKanbanAssignee(),
    action: faker.helpers.arrayElement(actions),
    target: faker.lorem.sentence({ min: 3, max: 6 }),
    timestamp: faker.date.recent().toISOString(),
  };
}

export function createFakeKanbanActivities(count: number): FakeKanbanActivity[] {
  return Array.from({ length: count }, () => createFakeKanbanActivity());
}

export interface FakeKanbanFilter {
  assignees: string[];
  dueDate?: 'month' | 'overdue' | 'today' | 'week';
  priorities: KanbanPriority[];
  search?: string;
  tags: string[];
}

export function createFakeKanbanFilter(): FakeKanbanFilter {
  return {
    assignees: faker.datatype.boolean({ probability: 0.5 })
      ? Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => faker.string.uuid())
      : [],
    priorities: faker.datatype.boolean({ probability: 0.3 })
      ? faker.helpers.arrayElements<KanbanPriority>(['low', 'medium', 'high', 'urgent'], {
          min: 1,
          max: 2,
        })
      : [],
    tags: faker.datatype.boolean({ probability: 0.3 })
      ? faker.helpers.arrayElements(TAG_LABELS, { min: 1, max: 3 })
      : [],
    dueDate: faker.datatype.boolean({ probability: 0.3 })
      ? faker.helpers.arrayElement(['overdue', 'today', 'week', 'month'] as const)
      : undefined,
    search: faker.datatype.boolean({ probability: 0.2 }) ? faker.lorem.word() : undefined,
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of cards by priority
 * @returns Array of cards, one for each priority level
 */
export function createFakeKanbanCardPriorityMatrix(): FakeKanbanCard[] {
  return KANBAN_PRIORITIES.map((priority) =>
    createFakeKanbanCard({
      priority,
      title: i18n.t('factory.kanban.priorityTitle', 'Priority: {{priority}}', { priority }),
    })
  );
}

/**
 * Creates a matrix of columns by status
 * @returns Array of columns, one for each status
 */
export function createFakeKanbanColumnStatusMatrix(): FakeKanbanColumn[] {
  return COLUMN_CONFIGS.map((config) => createFakeKanbanColumn(config, 2));
}

/**
 * Creates a matrix of cards with different tag counts
 * @returns Array of cards with varying tag counts
 */
export function createFakeKanbanCardTagMatrix(): FakeKanbanCard[] {
  return [0, 1, 2, 3].map((tagCount) =>
    createFakeKanbanCard({
      title: i18n.t('factory.kanban.cardWithTags', 'Card with {{count}} tag(s)', {
        count: tagCount,
      }),
      tags: Array.from({ length: tagCount }, () => createFakeKanbanTag()),
    })
  );
}

/**
 * Creates a matrix of cards with different assignee configurations
 * @returns Array of cards with varying assignee setups
 */
export function createFakeKanbanCardAssigneeMatrix(): FakeKanbanCard[] {
  return [
    createFakeKanbanCard({
      title: i18n.t('factory.kanban.noAssignee', 'No assignee'),
      assignee: undefined,
      assignees: undefined,
    }),
    createFakeKanbanCard({
      title: i18n.t('factory.kanban.singleAssignee', 'Single assignee'),
      assignee: createFakeKanbanAssignee(),
      assignees: undefined,
    }),
    createFakeKanbanCard({
      title: i18n.t('factory.kanban.multipleAssignees2', 'Multiple assignees (2)'),
      assignee: undefined,
      assignees: [createFakeKanbanAssignee(), createFakeKanbanAssignee()],
    }),
    createFakeKanbanCard({
      title: i18n.t('factory.kanban.multipleAssignees4', 'Multiple assignees (4)'),
      assignee: undefined,
      assignees: Array.from({ length: 4 }, () => createFakeKanbanAssignee()),
    }),
  ];
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all Kanban configurations
 * @returns Record of categorized Kanban configurations
 */
export function createFakeKanbanShowcase(): Record<string, unknown> {
  return {
    // Basic elements
    card: createFakeKanbanCard(),
    column: createFakeKanbanColumn(COLUMN_CONFIGS[0]),
    board: createFakeKanbanBoard(),
    boardResponse: createFakeKanbanBoardResponse(),

    // Card variations
    cardLowPriority: createFakeKanbanCard({ priority: 'low' }),
    cardMediumPriority: createFakeKanbanCard({ priority: 'medium' }),
    cardHighPriority: createFakeKanbanCard({ priority: 'high' }),
    cardUrgentPriority: createFakeKanbanCard({ priority: 'urgent' }),

    // Card with/without features
    cardWithChecklist: createFakeKanbanCard({
      checklist: { total: 5, completed: 3 },
    }),
    cardWithDueDate: createFakeKanbanCard({
      dueDate: faker.date.soon({ days: 7 }).toISOString(),
    }),
    cardWithComments: createFakeKanbanCard({
      comments: 10,
    }),
    cardWithAttachments: createFakeKanbanCard({
      attachments: 5,
    }),

    // Other elements
    assignee: createFakeKanbanAssignee(),
    tag: createFakeKanbanTag(),
    activity: createFakeKanbanActivity(),
    filter: createFakeKanbanFilter(),

    // Matrices
    priorityMatrix: createFakeKanbanCardPriorityMatrix(),
    statusMatrix: createFakeKanbanColumnStatusMatrix(),
    tagMatrix: createFakeKanbanCardTagMatrix(),
    assigneeMatrix: createFakeKanbanCardAssigneeMatrix(),
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple kanban cards
 * @param count - Number of cards to create
 * @returns Array of fake kanban cards
 */
export function createFakeKanbanCards(count: number): FakeKanbanCard[] {
  return Array.from({ length: count }, () => createFakeKanbanCard());
}

/**
 * Creates multiple kanban assignees
 * @param count - Number of assignees to create
 * @returns Array of fake kanban assignees
 */
export function createFakeKanbanAssignees(count: number): FakeKanbanAssignee[] {
  return Array.from({ length: count }, () => createFakeKanbanAssignee());
}

/**
 * Creates multiple kanban tags
 * @param count - Number of tags to create
 * @returns Array of fake kanban tags
 */
export function createFakeKanbanTags(count: number): FakeKanbanTag[] {
  return Array.from({ length: count }, () => createFakeKanbanTag());
}
