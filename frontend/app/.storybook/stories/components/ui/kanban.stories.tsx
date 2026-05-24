import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  kanbanHandlers,
  kanbanStatusHandlers,
} from '@/.storybook/stories/_handlers/kanban.handlers';
import {
  createFakeKanbanActivities,
  createFakeKanbanActivity,
  createFakeKanbanAssignee,
  createFakeKanbanAssignees,
  createFakeKanbanBoard,
  createFakeKanbanBoardResponse,
  createFakeKanbanCard,
  createFakeKanbanCardAssigneeMatrix,
  createFakeKanbanCardPriorityMatrix,
  createFakeKanbanCards,
  createFakeKanbanCardTagMatrix,
  createFakeKanbanColumn,
  createFakeKanbanColumnStatusMatrix,
  createFakeKanbanFilter,
  createFakeKanbanShowcase,
  createFakeKanbanTag,
  createFakeKanbanTags,
  type FakeKanbanActivity,
  type FakeKanbanAssignee,
  type FakeKanbanBoardResponse,
  type FakeKanbanCard,
  type FakeKanbanColumn,
  type FakeKanbanFilter,
  type FakeKanbanTag,
  KANBAN_PRIORITIES,
  KANBAN_STATUSES,
  KANBAN_TAG_COLORS,
  KANBAN_TAG_LABELS,
  type KanbanPriority,
  type KanbanStatus,
} from '@/.storybook/stories/_factories/kanban.factory';

import { AlertCircleIcon, GripVerticalIcon, RefreshCwIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanItem,
  KanbanOverlay,
} from '@/components/ui/kanban';

import i18n from 'i18next';

type Task = {
  id: string;
  titleKey: string;
};

const initialColumns: Record<string, Task[]> = {
  todo: [
    { id: 't-1', titleKey: 'kanban.task.writeDocs' },
    { id: 't-2', titleKey: 'kanban.task.addStories' },
  ],
  doing: [{ id: 't-3', titleKey: 'kanban.task.reviewA11y' }],
  done: [{ id: 't-4', titleKey: 'kanban.task.ship' }],
};

// Seed faker for deterministic test data
seedFaker();

// ============ API TYPES ============
interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

interface KanbanBoardResponse {
  columns: FakeKanbanColumn[];
  id: string;
  name: string;
}

// ============ ASYNC DEMO COMPONENTS ============

function KanbanLoadingSkeleton() {
  return (
    <div className="p-6" data-state="loading" data-testid="kanban-loading">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 3 }).map((_, colIndex) => (
          <div key={`kanban-col-${String(colIndex)}`} className="w-[280px] min-w-[280px]">
            <div className="flex items-center justify-between pb-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-8" />
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: colIndex === 1 ? 2 : 3 }).map((_, cardIndex) => (
                <Card
                  key={`kanban-card-${String(colIndex)}-${String(cardIndex)}`}
                  className="border"
                >
                  <CardContent className="space-y-2 p-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <div className="flex gap-1 pt-1">
                      <Skeleton className="h-5 w-12 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className="p-6">
      <Alert variant="destructive" data-error-status={error.status} data-testid="kanban-error">
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
    </div>
  );
}

function KanbanEmptyState() {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="kanban-empty"
    >
      <p className="text-muted-foreground">
        {t('kanban.story.noCardsOnThisBoardYet', 'No cards on this board yet')}
      </p>
      <Button variant="outline" className="mt-4">
        Add your first card
      </Button>
    </div>
  );
}

function KanbanCardWithData({ card }: { card: FakeKanbanCard }) {
  const priorityColors: Record<string, string> = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };

  return (
    <Card className="border" data-testid="kanban-card" data-card-id={card.id}>
      <CardContent className="space-y-2 p-4">
        <div className="text-sm font-medium" data-slot="kanban-card-title">
          {card.title}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className={priorityColors[card.priority]}>
            {card.priority}
          </Badge>
          {card.tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              {tag.label}
            </Badge>
          ))}
        </div>
        {card.assignee && (
          <div className="flex items-center gap-2 pt-1">
            <Avatar className="size-6">
              <AvatarImage src={card.assignee.avatar} alt={card.assignee.name} />
              <AvatarFallback>{card.assignee.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs">{card.assignee.name}</span>
          </div>
        )}
        <div className="text-muted-foreground flex items-center gap-3 pt-1 text-xs">
          {card.comments > 0 && <span>💬 {card.comments}</span>}
          {card.attachments > 0 && <span>📎 {card.attachments}</span>}
          {card.checklist && (
            <span>
              ✓ {card.checklist.completed}/{card.checklist.total}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanWithAsyncData() {
  const [data, setData] = React.useState<FakeKanbanColumn[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/kanban/board')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<KanbanBoardResponse>;
      })
      .then((json) => {
        setData(json.columns);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <KanbanLoadingSkeleton />;
  }

  if (error) {
    return <KanbanErrorDisplay error={error} onRetry={fetchData} />;
  }

  const totalCards = data.reduce((sum, col) => sum + col.cards.length, 0);
  if (totalCards === 0) {
    return <KanbanEmptyState />;
  }

  return (
    <div className="p-6" data-state="success" data-testid="kanban-success">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {data.map((column) => (
          <div key={column.id} className="w-[280px] min-w-[280px]" data-column-id={column.id}>
            <div className="flex items-center justify-between pb-2">
              <div className="text-sm font-semibold" style={{ color: column.color }}>
                {column.title}
                <Badge variant="secondary" className="ml-2">
                  {column.cards.length}
                </Badge>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={i18n.t('kanban.story.dragColumn', 'Drag column')}
              >
                <GripVerticalIcon className="size-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {column.cards.map((card) => (
                <KanbanCardWithData key={card.id} card={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Demo with static Faker data (no API call)
function KanbanWithFakerData() {
  const columns = React.useMemo(() => createFakeKanbanBoard(), []);

  return (
    <div className="p-6" data-testid="kanban-faker">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div key={column.id} className="w-[280px] min-w-[280px]" data-column-id={column.id}>
            <div className="flex items-center justify-between pb-2">
              <div className="text-sm font-semibold" style={{ color: column.color }}>
                {column.title}
                <Badge variant="secondary" className="ml-2">
                  {column.cards.length}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {column.cards.map((card) => (
                <KanbanCardWithData key={card.id} card={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ ORIGINAL DEMO COMPONENT ============

function KanbanDemo() {
  const { t } = useTranslation();
  const [columns, setColumns] = React.useState<Record<string, Task[]>>(initialColumns);

  const findTaskTitle = React.useCallback(
    (id: string) => {
      for (const tasks of Object.values(columns)) {
        const task = tasks.find((t) => t.id === id);
        if (task) return t(task.titleKey);
      }
      return id;
    },
    [columns, t]
  );

  return (
    <div className="p-6" data-testid="kanban-demo">
      <div className="text-muted-foreground mb-3 text-sm" data-slot="kanban-demo-instructions">
        {t('kanban.instructions')}
      </div>

      <Kanban getItemValue={(item) => item.id} onValueChange={setColumns} value={columns}>
        <KanbanBoard className="flex w-full gap-4 overflow-x-auto pb-4">
          {Object.entries(columns).map(([columnId, tasks]) => (
            <KanbanColumn
              className="w-[280px] min-w-[280px]"
              data-column-id={columnId}
              key={columnId}
              value={columnId}
            >
              <div className="flex items-center justify-between pb-2">
                <div
                  className="text-sm font-semibold capitalize"
                  data-slot="kanban-demo-column-label"
                >
                  {t(`kanban.column.${columnId}`)}
                </div>
                <KanbanColumnHandle asChild>
                  <Button
                    aria-label={t('kanban.columnHandle.ariaLabel')}
                    size="icon"
                    variant="ghost"
                  >
                    <GripVerticalIcon className="size-4" />
                  </Button>
                </KanbanColumnHandle>
              </div>
              <div className="flex flex-col gap-2 p-0.5">
                {tasks.map((task) => (
                  <KanbanItem asChild asHandle data-task-id={task.id} key={task.id} value={task.id}>
                    <Card className="border-0">
                      <CardContent className="p-4">
                        <div className="text-sm font-medium" data-slot="kanban-demo-task-title">
                          {t(task.titleKey)}
                        </div>
                      </CardContent>
                    </Card>
                  </KanbanItem>
                ))}
              </div>
            </KanbanColumn>
          ))}
        </KanbanBoard>

        <KanbanOverlay>
          {({ value, variant }) => (
            <div
              className="bg-card text-card-foreground w-[260px] rounded-md border p-3 text-sm shadow-lg"
              data-slot="kanban-demo-overlay"
            >
              {variant === 'column'
                ? t('kanban.overlay.column', {
                    column: t(`kanban.column.${String(value)}`),
                  })
                : findTaskTitle(String(value))}
            </div>
          )}
        </KanbanOverlay>
      </Kanban>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Kanban',
  component: KanbanDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onDragEnd: fn(),
  },
  parameters: {
    msw: {
      handlers: kanbanHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('kanban.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('kanban.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('kanban.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('kanban.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('kanban.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('kanban.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('kanban.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onDragEnd: {
      action: 'onDragEnd',
      description: i18n.t(
        'kanban.argType.calledWhenDragOperationEnds',
        'Called when drag operation ends'
      ),
      table: { category: 'Events' },
    },
    // Kanban Props Reference (dnd-kit based):
    // - value: Column data (Record<string, Item[]>)
    // - onValueChange: Called when items are moved ((value: Record<string, Item[]>) => void)
    // - getItemValue: Extract item ID from item ((item: Item) => string)
    // - orientation: Board orientation ('horizontal' | 'vertical', default: 'horizontal')
    // - className: Additional CSS classes (string)
    //
    // KanbanBoard Props Reference:
    // - className: Additional CSS classes (string)
    // - children: KanbanColumn elements (ReactNode)
    // Note: Container for all columns
    //
    // KanbanColumn Props Reference:
    // - value: Column ID (string, required)
    // - className: Additional CSS classes (string)
    // - children: Column header and KanbanItem elements (ReactNode)
    //
    // KanbanColumnHandle Props Reference:
    // - asChild: Render as child element (boolean)
    // - aria-label: Accessible label (string, required)
    // Note: Drag handle for reordering columns
    //
    // KanbanItem Props Reference:
    // - value: Item ID (string, required)
    // - asChild: Render as child element (boolean)
    // - asHandle: Use entire item as drag handle (boolean)
    // - disabled: Disable dragging (boolean)
    // - className: Additional CSS classes (string)
    //
    // KanbanOverlay Props Reference:
    // - children: Render function for drag overlay ((props: { value: string, variant: 'column' | 'item' }) => ReactNode)
    // Note: Visual feedback during drag operations
    //
    // Keyboard Navigation:
    // - Space/Enter: Pick up/drop item
    // - Arrow keys: Move item between columns
    // - Escape: Cancel drag operation
  },
} satisfies Meta<typeof KanbanDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const instructions = canvasElement.querySelector('[data-slot="kanban-demo-instructions"]');
    if (!(instructions instanceof HTMLElement)) {
      throw new Error('Kanban instructions element was not found.');
    }
    expect(instructions.textContent?.trim()).not.toBe('');

    const board = canvasElement.querySelector('[data-slot="kanban-board"]');
    if (!(board instanceof HTMLElement)) {
      throw new Error('Kanban board was not found.');
    }

    expect(board.getAttribute('data-orientation')).toBe('horizontal');

    const columns = canvasElement.querySelectorAll('[data-slot="kanban-column"]');
    expect(columns.length).toBe(3);
    expect([...columns].map((col) => col.getAttribute('data-column-id'))).toEqual(
      expect.arrayContaining(['todo', 'doing', 'done'])
    );

    const items = canvasElement.querySelectorAll('[data-slot="kanban-item"]');
    expect(items.length).toBe(4);

    expect([...items].map((item) => item.getAttribute('data-task-id'))).toEqual(
      expect.arrayContaining(['t-1', 't-2', 't-3', 't-4'])
    );

    for (const item of items) {
      const title = item.querySelector('[data-slot="kanban-demo-task-title"]');
      if (!(title instanceof HTMLElement)) {
        throw new Error('Kanban task title element was not found.');
      }
      expect(title.textContent?.trim()).not.toBe('');
    }

    const todoColumn = canvasElement.querySelector(
      '[data-slot="kanban-column"][data-column-id="todo"]'
    );
    if (!(todoColumn instanceof HTMLElement)) {
      throw new Error('Todo column was not found.');
    }

    const todoHandle = todoColumn.querySelector('[data-slot="kanban-column-handle"]');
    if (!(todoHandle instanceof HTMLButtonElement)) {
      throw new Error('Todo column handle was not found.');
    }
    expect(todoHandle.getAttribute('aria-label')?.trim()).not.toBe('');

    await userEvent.click(todoHandle);
    expect(doc.activeElement).toBe(todoHandle);

    await userEvent.keyboard('{Space}');

    await waitFor(() => {
      const overlay = doc.body.querySelector('[data-slot="kanban-demo-overlay"]');
      if (!(overlay instanceof HTMLElement)) {
        throw new Error('Kanban overlay was not found.');
      }
      expect(overlay.textContent?.trim()).not.toBe('');
    });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      const overlay = doc.body.querySelector('[data-slot="kanban-demo-overlay"]');
      if (overlay) {
        throw new Error('Kanban overlay was not dismissed.');
      }
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async (context) => {
    const { canvasElement } = context;
    expect(canvasElement.querySelector('[data-slot="kanban-board"]')).toBeInTheDocument();
    const columns = canvasElement.querySelectorAll('[data-slot="kanban-column"]');
    expect(columns.length).toBe(3);
    const items = canvasElement.querySelectorAll('[data-slot="kanban-item"]');
    expect(items.length).toBe(4);
    await Default.play?.(context);
  },
};

export const Variants: Story = {
  render: () => {
    // Basic Kanban
    function BasicKanban() {
      const [columns, setColumns] = React.useState<Record<string, { id: string; title: string }[]>>(
        {
          backlog: [
            { id: '1', title: 'Task 1' },
            { id: '2', title: 'Task 2' },
          ],
          doing: [{ id: '3', title: 'Task 3' }],
          done: [{ id: '4', title: 'Task 4' }],
        }
      );

      return (
        <Kanban value={columns} onValueChange={setColumns} getItemValue={(item) => item.id}>
          <KanbanBoard className="flex gap-3">
            {Object.entries(columns).map(([columnId, tasks]) => (
              <KanbanColumn key={columnId} value={columnId} className="w-[200px] min-w-[200px]">
                <div className="pb-2 text-sm font-semibold capitalize">{columnId}</div>
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <KanbanItem key={task.id} value={task.id} asChild asHandle>
                      <Card className="border-0">
                        <CardContent className="p-3">
                          <div className="text-sm">{task.title}</div>
                        </CardContent>
                      </Card>
                    </KanbanItem>
                  ))}
                </div>
              </KanbanColumn>
            ))}
          </KanbanBoard>
        </Kanban>
      );
    }

    // Kanban with Categories
    function CategoryKanban() {
      const categories = {
        bug: { color: '#ef4444', label: 'Bug' },
        feature: { color: '#22c55e', label: 'Feature' },
        docs: { color: '#3b82f6', label: 'Docs' },
      };
      type KanbanItem = { category: keyof typeof categories; id: string; title: string };
      const [columns, setColumns] = React.useState<Record<string, KanbanItem[]>>({
        todo: [
          { id: '1', title: 'Fix login issue', category: 'bug' },
          { id: '2', title: 'Add dark mode', category: 'feature' },
        ],
        progress: [{ id: '3', title: 'Update API docs', category: 'docs' }],
        done: [{ id: '4', title: 'Setup CI/CD', category: 'feature' }],
      });

      return (
        <Kanban value={columns} onValueChange={setColumns} getItemValue={(item) => item.id}>
          <KanbanBoard className="flex gap-3">
            {Object.entries(columns).map(([columnId, tasks]) => (
              <KanbanColumn key={columnId} value={columnId} className="w-[220px] min-w-[220px]">
                <div className="pb-2 text-sm font-semibold capitalize">{columnId}</div>
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <KanbanItem key={task.id} value={task.id} asChild asHandle>
                      <Card className="border-0">
                        <CardContent className="space-y-2 p-3">
                          <div className="text-sm">{task.title}</div>
                          <Badge
                            style={{
                              backgroundColor: categories[task.category].color,
                              color: 'white',
                            }}
                          >
                            {categories[task.category].label}
                          </Badge>
                        </CardContent>
                      </Card>
                    </KanbanItem>
                  ))}
                </div>
              </KanbanColumn>
            ))}
          </KanbanBoard>
        </Kanban>
      );
    }

    // Kanban with Drag Handle
    function DragHandleKanban() {
      const [columns, setColumns] = React.useState<Record<string, { id: string; title: string }[]>>(
        {
          new: [
            { id: '1', title: 'Review PR #42' },
            { id: '2', title: 'Deploy staging' },
          ],
          active: [{ id: '3', title: 'Write tests' }],
          closed: [{ id: '4', title: 'Merge feature branch' }],
        }
      );

      return (
        <Kanban value={columns} onValueChange={setColumns} getItemValue={(item) => item.id}>
          <KanbanBoard className="flex gap-3">
            {Object.entries(columns).map(([columnId, tasks]) => (
              <KanbanColumn key={columnId} value={columnId} className="w-[220px] min-w-[220px]">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-semibold capitalize">{columnId}</span>
                  <KanbanColumnHandle asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={i18n.t('kanban.story.dragColumn', 'Drag column')}
                    >
                      <GripVerticalIcon className="size-4" />
                    </Button>
                  </KanbanColumnHandle>
                </div>
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <KanbanItem key={task.id} value={task.id} asChild asHandle>
                      <Card className="border-0">
                        <CardContent className="flex items-center gap-2 p-3">
                          <GripVerticalIcon className="text-muted-foreground size-4" />
                          <div className="text-sm">{task.title}</div>
                        </CardContent>
                      </Card>
                    </KanbanItem>
                  ))}
                </div>
              </KanbanColumn>
            ))}
          </KanbanBoard>
        </Kanban>
      );
    }

    // Kanban with WIP Limits
    function WipLimitKanban() {
      const limits: Record<string, number> = { todo: 5, inProgress: 3, review: 2, done: 10 };
      const [columns, setColumns] = React.useState<Record<string, { id: string; title: string }[]>>(
        {
          todo: [
            { id: '1', title: 'Task A' },
            { id: '2', title: 'Task B' },
          ],
          inProgress: [
            { id: '3', title: 'Task C' },
            { id: '4', title: 'Task D' },
            { id: '5', title: 'Task E' },
          ],
          review: [
            { id: '6', title: 'Task F' },
            { id: '7', title: 'Task G' },
          ],
          done: [{ id: '8', title: 'Task H' }],
        }
      );

      return (
        <Kanban value={columns} onValueChange={setColumns} getItemValue={(item) => item.id}>
          <KanbanBoard className="flex gap-3">
            {Object.entries(columns).map(([columnId, tasks]) => {
              const limit = limits[columnId] || 10;
              const atLimit = tasks.length >= limit;
              return (
                <KanbanColumn key={columnId} value={columnId} className="w-[200px] min-w-[200px]">
                  <div className="flex items-center gap-2 pb-2">
                    <span className="text-sm font-semibold capitalize">
                      {columnId.replaceAll(/([A-Z])/g, ' $1')}
                    </span>
                    <Badge variant={atLimit ? 'destructive' : 'secondary'} className="text-xs">
                      {tasks.length}/{limit}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {tasks.map((task) => (
                      <KanbanItem key={task.id} value={task.id} asChild asHandle>
                        <Card className={`border-0 ${atLimit ? 'opacity-75' : ''}`}>
                          <CardContent className="p-3">
                            <div className="text-sm">{task.title}</div>
                          </CardContent>
                        </Card>
                      </KanbanItem>
                    ))}
                  </div>
                </KanbanColumn>
              );
            })}
          </KanbanBoard>
        </Kanban>
      );
    }

    return (
      <div className="flex flex-col gap-8">
        <div>
          <p className="mb-3 text-sm font-medium">{i18n.t('kanban.story.basic', 'Basic')}</p>
          <BasicKanban />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium">
            {i18n.t('kanban.story.withCategories', 'With Categories')}
          </p>
          <CategoryKanban />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium">
            {i18n.t('kanban.story.withDragHandles', 'With Drag Handles')}
          </p>
          <DragHandleKanban />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium">
            {i18n.t('kanban.story.withWipLimits', 'With WIP Limits')}
          </p>
          <WipLimitKanban />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // Verify all four variant boards rendered
    const boards = canvasElement.querySelectorAll('[data-slot="kanban-board"]');
    expect(boards.length).toBe(4);

    // Basic variant: 3 columns (backlog, doing, done)
    const firstBoard = boards[0];
    const firstBoardColumns = firstBoard.querySelectorAll('[data-slot="kanban-column"]');
    expect(firstBoardColumns.length).toBe(3);
    const firstBoardItems = firstBoard.querySelectorAll('[data-slot="kanban-item"]');
    expect(firstBoardItems.length).toBe(4);

    // Category variant: 3 columns with badges
    const categoryBoard = boards[1];
    const categoryColumns = categoryBoard.querySelectorAll('[data-slot="kanban-column"]');
    expect(categoryColumns.length).toBe(3);

    // Drag handle variant: has column handles
    const dragHandleBoard = boards[2];
    const columnHandles = dragHandleBoard.querySelectorAll('[data-slot="kanban-column-handle"]');
    expect(columnHandles.length).toBe(3);

    // WIP limit variant: 4 columns
    const wipBoard = boards[3];
    const wipColumns = wipBoard.querySelectorAll('[data-slot="kanban-column"]');
    expect(wipColumns.length).toBe(4);
  },
};

export const Sizes: Story = {
  render: () => {
    // Compact Cards
    function CompactKanban() {
      const [columns, setColumns] = React.useState<Record<string, { id: string; title: string }[]>>(
        {
          todo: [
            { id: '1', title: 'Task 1' },
            { id: '2', title: 'Task 2' },
            { id: '3', title: 'Task 3' },
          ],
          doing: [{ id: '4', title: 'Task 4' }],
          done: [
            { id: '5', title: 'Task 5' },
            { id: '6', title: 'Task 6' },
          ],
        }
      );

      return (
        <Kanban value={columns} onValueChange={setColumns} getItemValue={(item) => item.id}>
          <KanbanBoard className="flex gap-2">
            {Object.entries(columns).map(([columnId, tasks]) => (
              <KanbanColumn key={columnId} value={columnId} className="w-[160px] min-w-[160px]">
                <div className="pb-1.5 text-xs font-semibold capitalize">{columnId}</div>
                <div className="flex flex-col gap-1">
                  {tasks.map((task) => (
                    <KanbanItem key={task.id} value={task.id} asChild asHandle>
                      <Card className="border-0">
                        <CardContent className="p-2">
                          <div className="text-xs">{task.title}</div>
                        </CardContent>
                      </Card>
                    </KanbanItem>
                  ))}
                </div>
              </KanbanColumn>
            ))}
          </KanbanBoard>
        </Kanban>
      );
    }

    // Default Cards
    function DefaultKanban() {
      const [columns, setColumns] = React.useState<
        Record<string, { desc: string; id: string; title: string }[]>
      >({
        todo: [
          { id: '1', title: 'Setup project', desc: 'Initialize repository' },
          { id: '2', title: 'Design system', desc: 'Create components' },
        ],
        doing: [{ id: '3', title: 'Build features', desc: 'Implement core logic' }],
        done: [{ id: '4', title: 'Write tests', desc: 'Unit and integration' }],
      });

      return (
        <Kanban value={columns} onValueChange={setColumns} getItemValue={(item) => item.id}>
          <KanbanBoard className="flex gap-3">
            {Object.entries(columns).map(([columnId, tasks]) => (
              <KanbanColumn key={columnId} value={columnId} className="w-[220px] min-w-[220px]">
                <div className="pb-2 text-sm font-semibold capitalize">{columnId}</div>
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <KanbanItem key={task.id} value={task.id} asChild asHandle>
                      <Card className="border-0">
                        <CardContent className="space-y-1 p-3">
                          <div className="text-sm font-medium">{task.title}</div>
                          <div className="text-muted-foreground text-xs">{task.desc}</div>
                        </CardContent>
                      </Card>
                    </KanbanItem>
                  ))}
                </div>
              </KanbanColumn>
            ))}
          </KanbanBoard>
        </Kanban>
      );
    }

    // Large Cards
    function LargeKanban() {
      type LargeKanbanItem = {
        assignee: string;
        desc: string;
        id: string;
        priority: string;
        title: string;
      };
      const [columns, setColumns] = React.useState<Record<string, LargeKanbanItem[]>>({
        backlog: [
          {
            id: '1',
            title: 'User Authentication',
            desc: 'Implement OAuth2 flow with Google and GitHub providers',
            priority: 'High',
            assignee: 'Alice',
          },
        ],
        sprint: [
          {
            id: '2',
            title: 'Dashboard Redesign',
            desc: 'Update dashboard layout with new analytics widgets',
            priority: 'Medium',
            assignee: 'Bob',
          },
        ],
        done: [
          {
            id: '3',
            title: 'API Documentation',
            desc: 'Complete OpenAPI spec for all endpoints',
            priority: 'Low',
            assignee: 'Carol',
          },
        ],
      });

      const priorityColors: Record<string, string> = {
        High: 'bg-red-100 text-red-700',
        Medium: 'bg-yellow-100 text-yellow-700',
        Low: 'bg-green-100 text-green-700',
      };

      return (
        <Kanban value={columns} onValueChange={setColumns} getItemValue={(item) => item.id}>
          <KanbanBoard className="flex gap-4">
            {Object.entries(columns).map(([columnId, tasks]) => (
              <KanbanColumn key={columnId} value={columnId} className="w-[300px] min-w-[300px]">
                <div className="pb-3 text-base font-semibold capitalize">{columnId}</div>
                <div className="flex flex-col gap-3">
                  {tasks.map((task) => (
                    <KanbanItem key={task.id} value={task.id} asChild asHandle>
                      <Card className="border-0">
                        <CardContent className="space-y-3 p-4">
                          <div className="text-base font-medium">{task.title}</div>
                          <div className="text-muted-foreground text-sm">{task.desc}</div>
                          <div className="flex items-center justify-between pt-1">
                            <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                            <div className="flex items-center gap-2">
                              <Avatar className="size-6">
                                <AvatarFallback className="text-xs">
                                  {task.assignee[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-muted-foreground text-xs">{task.assignee}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </KanbanItem>
                  ))}
                </div>
              </KanbanColumn>
            ))}
          </KanbanBoard>
        </Kanban>
      );
    }

    return (
      <div className="flex flex-col gap-10">
        <div>
          <p className="mb-3 text-sm font-medium">{i18n.t('kanban.story.compact', 'Compact')}</p>
          <CompactKanban />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium">{i18n.t('kanban.story.default', 'Default')}</p>
          <DefaultKanban />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium">{i18n.t('kanban.story.large', 'Large')}</p>
          <LargeKanban />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // Verify all three size boards rendered
    const boards = canvasElement.querySelectorAll('[data-slot="kanban-board"]');
    expect(boards.length).toBe(3);

    // Compact: 3 columns, 6 items
    const compactBoard = boards[0];
    const compactColumns = compactBoard.querySelectorAll('[data-slot="kanban-column"]');
    expect(compactColumns.length).toBe(3);
    const compactItems = compactBoard.querySelectorAll('[data-slot="kanban-item"]');
    expect(compactItems.length).toBe(6);

    // Default: 3 columns, 4 items
    const defaultBoard = boards[1];
    const defaultColumns = defaultBoard.querySelectorAll('[data-slot="kanban-column"]');
    expect(defaultColumns.length).toBe(3);
    const defaultItems = defaultBoard.querySelectorAll('[data-slot="kanban-item"]');
    expect(defaultItems.length).toBe(4);

    // Large: 3 columns, 3 items with assignees
    const largeBoard = boards[2];
    const largeColumns = largeBoard.querySelectorAll('[data-slot="kanban-column"]');
    expect(largeColumns.length).toBe(3);
    const largeItems = largeBoard.querySelectorAll('[data-slot="kanban-item"]');
    expect(largeItems.length).toBe(3);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async (context) => {
    const { canvasElement } = context;
    const doc = canvasElement.ownerDocument;
    expect(
      doc.documentElement.classList.contains('dark') ||
        doc.documentElement.getAttribute('data-theme') === 'dark' ||
        doc.documentElement.style.colorScheme === 'dark'
    ).toBeTruthy();
    expect(canvasElement.querySelector('[data-slot="kanban-board"]')).toBeInTheDocument();
    const columns = canvasElement.querySelectorAll('[data-slot="kanban-column"]');
    expect(columns.length).toBe(3);
    await Default.play?.(context);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async (context) => {
    const { canvasElement } = context;
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.dir).toBe('rtl');
    expect(canvasElement.querySelector('[data-slot="kanban-board"]')).toBeInTheDocument();
    const columns = canvasElement.querySelectorAll('[data-slot="kanban-column"]');
    expect(columns.length).toBe(3);
    const items = canvasElement.querySelectorAll('[data-slot="kanban-item"]');
    expect(items.length).toBe(4);
    await Default.play?.(context);
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const instructions = canvasElement.querySelector('[data-slot="kanban-demo-instructions"]');
    if (!(instructions instanceof HTMLElement)) {
      throw new Error('Kanban instructions element was not found.');
    }
    expect(instructions.textContent?.trim()).toBe(
      '列間でアイテムをドラッグ（列の並び替えもできます）。'
    );

    const todoLabel = canvasElement.querySelector(
      '[data-slot="kanban-column"][data-column-id="todo"] [data-slot="kanban-demo-column-label"]'
    );
    if (!(todoLabel instanceof HTMLElement)) {
      throw new Error('Todo column label was not found.');
    }
    expect(todoLabel.textContent?.trim()).toBe('やること');

    const doingLabel = canvasElement.querySelector(
      '[data-slot="kanban-column"][data-column-id="doing"] [data-slot="kanban-demo-column-label"]'
    );
    if (!(doingLabel instanceof HTMLElement)) {
      throw new Error('Doing column label was not found.');
    }
    expect(doingLabel.textContent?.trim()).toBe('進行中');

    const doneLabel = canvasElement.querySelector(
      '[data-slot="kanban-column"][data-column-id="done"] [data-slot="kanban-demo-column-label"]'
    );
    if (!(doneLabel instanceof HTMLElement)) {
      throw new Error('Done column label was not found.');
    }
    expect(doneLabel.textContent?.trim()).toBe('完了');

    const todoHandle = canvasElement.querySelector(
      '[data-slot="kanban-column"][data-column-id="todo"] [data-slot="kanban-column-handle"]'
    );
    if (!(todoHandle instanceof HTMLButtonElement)) {
      throw new Error('Todo column handle was not found.');
    }
    expect(todoHandle.getAttribute('aria-label')).toBe('列をドラッグ');

    const writeDocsTitle = canvasElement.querySelector(
      '[data-task-id="t-1"] [data-slot="kanban-demo-task-title"]'
    );
    if (!(writeDocsTitle instanceof HTMLElement)) {
      throw new Error('Write docs task title was not found.');
    }
    expect(writeDocsTitle.textContent?.trim()).toBe('ドキュメントを書く');

    const addStoriesTitle = canvasElement.querySelector(
      '[data-task-id="t-2"] [data-slot="kanban-demo-task-title"]'
    );
    if (!(addStoriesTitle instanceof HTMLElement)) {
      throw new Error('Add stories task title was not found.');
    }
    expect(addStoriesTitle.textContent?.trim()).toBe('ストーリーを追加');

    const reviewA11yTitle = canvasElement.querySelector(
      '[data-task-id="t-3"] [data-slot="kanban-demo-task-title"]'
    );
    if (!(reviewA11yTitle instanceof HTMLElement)) {
      throw new Error('Review a11y task title was not found.');
    }
    expect(reviewA11yTitle.textContent?.trim()).toBe('a11yを確認');

    const shipTitle = canvasElement.querySelector(
      '[data-task-id="t-4"] [data-slot="kanban-demo-task-title"]'
    );
    if (!(shipTitle instanceof HTMLElement)) {
      throw new Error('Ship task title was not found.');
    }
    expect(shipTitle.textContent?.trim()).toBe('リリース');

    await Default.play?.(context);
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
  name: i18n.t('kanban.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  name: i18n.t('kanban.storyName.withFakerData', 'With Faker Data'),
  render: () => <KanbanWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="kanban-faker"]')).toBeInTheDocument();
    const columns = canvasElement.querySelectorAll('[data-column-id]');
    expect(columns.length).toBe(4); // To Do, In Progress, Review, Done
    const cards = canvasElement.querySelectorAll('[data-testid="kanban-card"]');
    expect(cards.length).not.toBe(0);
  },
};

// ============ MSW ASYNC STORIES ============

export const WithAsyncData: Story = {
  name: i18n.t('kanban.storyName.withAsyncData', 'With Async Data'),
  parameters: {
    msw: { handlers: kanbanHandlers },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="kanban-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const columns = canvasElement.querySelectorAll('[data-column-id]');
    expect(columns.length).toBe(4);
  },
};

export const Loading: Story = {
  name: i18n.t('kanban.storyName.loading', 'Loading State'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.loading },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="kanban-loading"]')).toBeInTheDocument();
  },
};

export const EmptyBoard: Story = {
  name: i18n.t('kanban.storyName.emptyBoard', 'Empty Board'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.empty },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="kanban-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const ManyCards: Story = {
  name: i18n.t('kanban.storyName.manyCards', 'Many Cards'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.manyCards },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="kanban-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const cards = canvasElement.querySelectorAll('[data-testid="kanban-card"]');
    expect(cards.length).toBeGreaterThan(20);
  },
};

// ============ 4xx CLIENT ERROR STORIES ============

export const Error401Unauthorized: Story = {
  name: i18n.t('kanban.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.unauthorized },
  },
  render: () => <KanbanWithAsyncData />,
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
  name: i18n.t('kanban.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.forbidden },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const errorEl = canvasElement.querySelector('[data-testid="kanban-error"]');
    expect(errorEl).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('kanban.storyName.error429RateLimit', 'Error 429: Rate Limited'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.tooManyRequests },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ 5xx SERVER ERROR STORIES ============

export const Error500InternalServerError: Story = {
  name: i18n.t('kanban.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.internalServerError },
  },
  render: () => <KanbanWithAsyncData />,
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
  name: i18n.t('kanban.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.badGateway },
  },
  render: () => <KanbanWithAsyncData />,
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
  name: i18n.t('kanban.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.serviceUnavailable },
  },
  render: () => <KanbanWithAsyncData />,
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
  name: i18n.t('kanban.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.gatewayTimeout },
  },
  render: () => <KanbanWithAsyncData />,
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
  name: i18n.t('kanban.storyName.slowResponse', 'Slow Response'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.slowResponse },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    // First verify loading state
    expect(canvasElement.querySelector('[data-testid="kanban-loading"]')).toBeInTheDocument();
    // Then wait for data
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="kanban-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('kanban.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.networkError },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="kanban-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error400BadRequest: Story = {
  name: i18n.t('kanban.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.badRequest },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('kanban.storyName.error422UnprocessableEntity', 'Error 422: Validation'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.unprocessableEntity },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kanbanHandlers },
  },
  play: async (context) => {
    const { canvasElement } = context;
    expect(canvasElement.querySelector('[data-slot="kanban-board"]')).toBeInTheDocument();
    const columns = canvasElement.querySelectorAll('[data-slot="kanban-column"]');
    expect(columns.length).toBe(3);
    const items = canvasElement.querySelectorAll('[data-slot="kanban-item"]');
    expect(items.length).toBe(4);
    await Default.play?.(context);
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('kanban.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify kanban board exists
    const kanbanBoard = canvasElement.querySelector('[data-slot="kanban-board"]');
    expect(kanbanBoard).toBeInTheDocument();

    // Verify columns exist
    const columns = canvasElement.querySelectorAll('[data-slot="kanban-column"]');
    expect(columns.length).not.toBe(0);

    // Verify column handles are accessible (for drag and drop)
    const columnHandles = canvasElement.querySelectorAll('[data-slot="kanban-column-handle"]');
    for (const handle of columnHandles) {
      if (handle instanceof HTMLButtonElement) {
        expect(handle).toHaveAttribute('aria-label');
      }
    }

    // Verify kanban items exist
    const items = canvasElement.querySelectorAll('[data-slot="kanban-item"]');
    expect(items.length).not.toBe(0);

    // Test keyboard navigation on kanban items
    const firstItem = items[0];
    if (firstItem instanceof HTMLElement) {
      const focusableElement = firstItem.querySelector('button, [tabindex="0"]');
      if (focusableElement instanceof HTMLElement) {
        focusableElement.focus();
        expect(document.activeElement).toBe(focusableElement);

        // Tab to next element
        await userEvent.tab();
        expect(document.activeElement).not.toBe(focusableElement);
      }
    }

    // Verify drag handles have proper ARIA attributes
    const itemHandles = canvasElement.querySelectorAll('[data-slot="kanban-item-handle"]');
    for (const handle of itemHandles) {
      if (handle instanceof HTMLElement) {
        // Drag handles should be keyboard accessible
        expect(handle).not.toHaveAttribute('tabindex', '-1');
      }
    }

    // Verify column labels exist for screen readers
    const columnLabels = canvasElement.querySelectorAll('[data-slot="kanban-demo-column-label"]');
    expect(columnLabels.length).not.toBe(0);
  },
};

// ============ FACTORY: SINGLE ENTITY STORIES ============

function KanbanSingleCardDemo() {
  const card = React.useMemo(() => createFakeKanbanCard(), []);
  return (
    <div className="p-6" data-testid="kanban-single-card">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <KanbanCardWithData card={card} />
    </div>
  );
}

export const SingleCard: Story = {
  name: i18n.t('kanban.storyName.singleCard', 'Factory: Single Card'),
  render: () => <KanbanSingleCardDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-single-card"]');
    expect(wrapper).toBeInTheDocument();
    const card = canvasElement.querySelector('[data-testid="kanban-card"]');
    expect(card).toBeInTheDocument();
    const title = card?.querySelector('[data-slot="kanban-card-title"]');
    expect(title).toBeInTheDocument();
    expect(title?.textContent?.trim()).not.toBe('');
  },
};

function KanbanSingleAssigneeDemo() {
  const assignee: FakeKanbanAssignee = React.useMemo(() => createFakeKanbanAssignee(), []);
  return (
    <div className="p-6" data-testid="kanban-single-assignee">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Avatar className="size-10">
            <AvatarImage src={assignee.avatar} alt={assignee.name} />
            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium" data-slot="assignee-name">
              {assignee.name}
            </div>
            <div className="text-muted-foreground text-xs" data-slot="assignee-email">
              {assignee.email}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const SingleAssignee: Story = {
  name: i18n.t('kanban.storyName.singleAssignee', 'Factory: Single Assignee'),
  render: () => <KanbanSingleAssigneeDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-single-assignee"]');
    expect(wrapper).toBeInTheDocument();
    const name = canvasElement.querySelector('[data-slot="assignee-name"]');
    expect(name).toBeInTheDocument();
    expect(name?.textContent?.trim()).not.toBe('');
    const email = canvasElement.querySelector('[data-slot="assignee-email"]');
    expect(email).toBeInTheDocument();
    expect(email?.textContent?.trim()).not.toBe('');
  },
};

function KanbanSingleTagDemo() {
  const tag: FakeKanbanTag = React.useMemo(() => createFakeKanbanTag(), []);
  return (
    <div className="p-6" data-testid="kanban-single-tag">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <Badge
        variant="outline"
        style={{ borderColor: tag.color, color: tag.color }}
        data-slot="tag-badge"
      >
        {tag.label}
      </Badge>
    </div>
  );
}

export const SingleTag: Story = {
  name: i18n.t('kanban.storyName.singleTag', 'Factory: Single Tag'),
  render: () => <KanbanSingleTagDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-single-tag"]');
    expect(wrapper).toBeInTheDocument();
    const badge = canvasElement.querySelector('[data-slot="tag-badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent?.trim()).not.toBe('');
  },
};

function KanbanSingleColumnDemo() {
  const column: FakeKanbanColumn = React.useMemo(
    () => createFakeKanbanColumn({ title: 'To Do', status: 'todo', color: '#6b7280' }, 3),
    []
  );
  return (
    <div className="p-6" data-testid="kanban-single-column">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="w-[280px]" data-column-id={column.id}>
        <div className="flex items-center justify-between pb-2">
          <div
            className="text-sm font-semibold"
            style={{ color: column.color }}
            data-slot="column-title"
          >
            {column.title}
            <Badge variant="secondary" className="ml-2">
              {column.cards.length}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {column.cards.map((card) => (
            <KanbanCardWithData key={card.id} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
}

export const SingleColumn: Story = {
  name: i18n.t('kanban.storyName.singleColumn', 'Factory: Single Column'),
  render: () => <KanbanSingleColumnDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-single-column"]');
    expect(wrapper).toBeInTheDocument();
    const title = canvasElement.querySelector('[data-slot="column-title"]');
    expect(title).toBeInTheDocument();
    expect(title?.textContent).toContain('To Do');
    const cards = canvasElement.querySelectorAll('[data-testid="kanban-card"]');
    expect(cards.length).toBe(3);
  },
};

// ============ FACTORY: BOARD RESPONSE STORY ============

function KanbanBoardResponseDemo() {
  const response: FakeKanbanBoardResponse = React.useMemo(
    () => createFakeKanbanBoardResponse(),
    []
  );
  return (
    <div className="p-6" data-testid="kanban-board-response">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="mb-4 space-y-1">
        <div className="text-sm font-medium" data-slot="board-name">
          {response.name}
        </div>
        <div className="text-muted-foreground text-xs" data-slot="board-member-count">
          {response.members.length} members
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {response.columns.map((column) => (
          <div key={column.id} className="w-[280px] min-w-[280px]" data-column-id={column.id}>
            <div className="flex items-center justify-between pb-2">
              <div className="text-sm font-semibold" style={{ color: column.color }}>
                {column.title}
                <Badge variant="secondary" className="ml-2">
                  {column.cards.length}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {column.cards.map((card) => (
                <KanbanCardWithData key={card.id} card={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const BoardResponse: Story = {
  name: i18n.t('kanban.storyName.boardResponse', 'Factory: Board Response'),
  render: () => <KanbanBoardResponseDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-board-response"]');
    expect(wrapper).toBeInTheDocument();
    const boardName = canvasElement.querySelector('[data-slot="board-name"]');
    expect(boardName).toBeInTheDocument();
    expect(boardName?.textContent?.trim()).not.toBe('');
    const memberCount = canvasElement.querySelector('[data-slot="board-member-count"]');
    expect(memberCount).toBeInTheDocument();
    expect(memberCount?.textContent).toContain('members');
    const columns = canvasElement.querySelectorAll('[data-column-id]');
    expect(columns.length).toBe(4);
  },
};

// ============ FACTORY: ACTIVITY STORIES ============

function KanbanSingleActivityDemo() {
  const activity: FakeKanbanActivity = React.useMemo(() => createFakeKanbanActivity(), []);
  return (
    <div className="p-6" data-testid="kanban-single-activity">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <Card>
        <CardContent className="flex items-center gap-3 p-4" data-slot="activity-item">
          <Avatar className="size-8">
            <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
            <AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="text-sm">
              <span className="font-medium" data-slot="activity-user">
                {activity.user.name}
              </span>{' '}
              <span data-slot="activity-action">{activity.action}</span>{' '}
              <span className="font-medium" data-slot="activity-target">
                {activity.target}
              </span>
            </div>
            <div className="text-muted-foreground text-xs" data-slot="activity-time">
              {new Date(activity.timestamp).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const SingleActivity: Story = {
  name: i18n.t('kanban.storyName.singleActivity', 'Factory: Single Activity'),
  render: () => <KanbanSingleActivityDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-single-activity"]');
    expect(wrapper).toBeInTheDocument();
    const activityItem = canvasElement.querySelector('[data-slot="activity-item"]');
    expect(activityItem).toBeInTheDocument();
    const user = canvasElement.querySelector('[data-slot="activity-user"]');
    expect(user?.textContent?.trim()).not.toBe('');
    const action = canvasElement.querySelector('[data-slot="activity-action"]');
    expect(action?.textContent?.trim()).not.toBe('');
    const target = canvasElement.querySelector('[data-slot="activity-target"]');
    expect(target?.textContent?.trim()).not.toBe('');
    const time = canvasElement.querySelector('[data-slot="activity-time"]');
    expect(time?.textContent?.trim()).not.toBe('');
  },
};

function KanbanActivitiesListDemo() {
  const activities = React.useMemo(() => createFakeKanbanActivities(5), []);
  return (
    <div className="p-6" data-testid="kanban-activities-list">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="space-y-2">
        {activities.map((activity) => (
          <Card key={activity.id}>
            <CardContent className="flex items-center gap-3 p-3" data-slot="activity-row">
              <Avatar className="size-6">
                <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
                <AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-sm">
                <span className="font-medium">{activity.user.name}</span> {activity.action}{' '}
                {activity.target}
              </div>
              <span className="text-muted-foreground text-xs">
                {new Date(activity.timestamp).toLocaleTimeString()}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ActivitiesList: Story = {
  name: i18n.t('kanban.storyName.activitiesList', 'Factory: Activities List'),
  render: () => <KanbanActivitiesListDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-activities-list"]');
    expect(wrapper).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-slot="activity-row"]');
    expect(rows.length).toBe(5);
  },
};

// ============ FACTORY: FILTER STORY ============

function KanbanFilterDemo() {
  const filter: FakeKanbanFilter = React.useMemo(() => createFakeKanbanFilter(), []);
  return (
    <div className="p-6" data-testid="kanban-filter">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="text-sm font-medium">
            {i18n.t('kanban.story.activeFilters', 'Active Filters')}
          </div>
          <div className="space-y-2">
            {filter.search && (
              <div className="flex items-center gap-2" data-slot="filter-search">
                <span className="text-muted-foreground text-xs">Search:</span>
                <Badge variant="secondary">{filter.search}</Badge>
              </div>
            )}
            {filter.priorities.length > 0 && (
              <div className="flex items-center gap-2" data-slot="filter-priorities">
                <span className="text-muted-foreground text-xs">Priorities:</span>
                {filter.priorities.map((p) => (
                  <Badge key={p} variant="outline">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
            {filter.tags.length > 0 && (
              <div className="flex items-center gap-2" data-slot="filter-tags">
                <span className="text-muted-foreground text-xs">Tags:</span>
                {filter.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {filter.assignees.length > 0 && (
              <div className="flex items-center gap-2" data-slot="filter-assignees">
                <span className="text-muted-foreground text-xs">Assignees:</span>
                <Badge variant="secondary">{filter.assignees.length} selected</Badge>
              </div>
            )}
            {filter.dueDate && (
              <div className="flex items-center gap-2" data-slot="filter-due-date">
                <span className="text-muted-foreground text-xs">Due:</span>
                <Badge variant="outline">{filter.dueDate}</Badge>
              </div>
            )}
            {!filter.search &&
              filter.priorities.length === 0 &&
              filter.tags.length === 0 &&
              filter.assignees.length === 0 &&
              !filter.dueDate && (
                <div className="text-muted-foreground text-xs" data-slot="filter-empty">
                  No filters active
                </div>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const FilterState: Story = {
  name: i18n.t('kanban.storyName.filterState', 'Factory: Filter State'),
  render: () => <KanbanFilterDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-filter"]');
    expect(wrapper).toBeInTheDocument();
    // The filter always renders - either filter slots or the empty message
    const card = wrapper?.querySelector('.space-y-3');
    expect(card).toBeInTheDocument();
  },
};

// ============ FACTORY: MATRIX STORIES ============

function KanbanPriorityMatrixDemo() {
  const cards = React.useMemo(() => createFakeKanbanCardPriorityMatrix(), []);
  return (
    <div className="p-6" data-testid="kanban-priority-matrix">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex flex-wrap gap-4">
        {cards.map((card) => (
          <div key={card.id} className="w-[260px]" data-slot="priority-card">
            <KanbanCardWithData card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const PriorityMatrix: Story = {
  name: i18n.t('kanban.storyName.priorityMatrix', 'Factory: Priority Matrix'),
  render: () => <KanbanPriorityMatrixDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-priority-matrix"]');
    expect(wrapper).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="priority-card"]');
    expect(cards.length).toBe(4); // low, medium, high, urgent
  },
};

function KanbanColumnStatusMatrixDemo() {
  const columns = React.useMemo(() => createFakeKanbanColumnStatusMatrix(), []);
  return (
    <div className="p-6" data-testid="kanban-status-matrix">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="w-[260px] min-w-[260px]"
            data-slot="status-column"
            data-column-id={column.id}
          >
            <div className="flex items-center gap-2 pb-2">
              <div className="text-sm font-semibold" style={{ color: column.color }}>
                {column.title}
              </div>
              <Badge variant="secondary">{column.status}</Badge>
              {column.limit && (
                <Badge variant="outline" className="text-xs">
                  limit: {column.limit}
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {column.cards.map((card) => (
                <KanbanCardWithData key={card.id} card={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ColumnStatusMatrix: Story = {
  name: i18n.t('kanban.storyName.columnStatusMatrix', 'Factory: Column Status Matrix'),
  render: () => <KanbanColumnStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-status-matrix"]');
    expect(wrapper).toBeInTheDocument();
    const columns = canvasElement.querySelectorAll('[data-slot="status-column"]');
    expect(columns.length).toBe(4); // todo, in-progress, review, done
  },
};

function KanbanTagMatrixDemo() {
  const cards = React.useMemo(() => createFakeKanbanCardTagMatrix(), []);
  return (
    <div className="p-6" data-testid="kanban-tag-matrix">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex flex-wrap gap-4">
        {cards.map((card) => (
          <div key={card.id} className="w-[260px]" data-slot="tag-card">
            <KanbanCardWithData card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const TagMatrix: Story = {
  name: i18n.t('kanban.storyName.tagMatrix', 'Factory: Tag Matrix'),
  render: () => <KanbanTagMatrixDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-tag-matrix"]');
    expect(wrapper).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="tag-card"]');
    expect(cards.length).toBe(4); // 0, 1, 2, 3 tags
  },
};

function KanbanAssigneeMatrixDemo() {
  const cards = React.useMemo(() => createFakeKanbanCardAssigneeMatrix(), []);
  return (
    <div className="p-6" data-testid="kanban-assignee-matrix">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex flex-wrap gap-4">
        {cards.map((card) => (
          <div key={card.id} className="w-[280px]" data-slot="assignee-card">
            <Card className="border" data-testid="kanban-card" data-card-id={card.id}>
              <CardContent className="space-y-2 p-4">
                <div className="text-sm font-medium">{card.title}</div>
                {card.assignee && (
                  <div className="flex items-center gap-2" data-slot="single-assignee">
                    <Avatar className="size-6">
                      <AvatarImage src={card.assignee.avatar} alt={card.assignee.name} />
                      <AvatarFallback>{card.assignee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground text-xs">{card.assignee.name}</span>
                  </div>
                )}
                {card.assignees && card.assignees.length > 0 && (
                  <div className="flex items-center gap-1" data-slot="multi-assignees">
                    {card.assignees.map((a) => (
                      <Avatar key={a.id} className="size-6">
                        <AvatarImage src={a.avatar} alt={a.name} />
                        <AvatarFallback>{a.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                )}
                {!card.assignee && (!card.assignees || card.assignees.length === 0) && (
                  <div className="text-muted-foreground text-xs" data-slot="no-assignee">
                    Unassigned
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AssigneeMatrix: Story = {
  name: i18n.t('kanban.storyName.assigneeMatrix', 'Factory: Assignee Matrix'),
  render: () => <KanbanAssigneeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-assignee-matrix"]');
    expect(wrapper).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="assignee-card"]');
    expect(cards.length).toBe(4); // no, single, 2, 4 assignees
    // Verify the "no assignee" variant
    expect(canvasElement.querySelector('[data-slot="no-assignee"]')).toBeInTheDocument();
    // Verify the "single assignee" variant
    expect(canvasElement.querySelector('[data-slot="single-assignee"]')).toBeInTheDocument();
    // Verify the "multi assignees" variant
    expect(canvasElement.querySelector('[data-slot="multi-assignees"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: SHOWCASE STORY ============

function KanbanShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = React.useMemo(() => createFakeKanbanShowcase(), []);
  const entries = Object.entries(showcase);
  return (
    <div className="p-6" data-testid="kanban-showcase">
      <p className="text-muted-foreground mb-3 text-sm">{t('kanban.instructions')}</p>
      <div className="space-y-3">
        {entries.map(([key, value]) => (
          <Card key={key}>
            <CardContent className="p-3" data-slot="showcase-entry" data-key={key}>
              <div className="text-xs font-semibold" data-slot="showcase-key">
                {key}
              </div>
              <pre className="text-muted-foreground mt-1 max-h-24 overflow-auto text-xs">
                {JSON.stringify(value, null, 2).slice(0, 200)}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const Showcase: Story = {
  name: i18n.t('kanban.storyName.showcase', 'Factory: Showcase'),
  render: () => <KanbanShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-showcase"]');
    expect(wrapper).toBeInTheDocument();
    const entries = canvasElement.querySelectorAll('[data-slot="showcase-entry"]');
    expect(entries.length).toBeGreaterThan(10);
    const keys = canvasElement.querySelectorAll('[data-slot="showcase-key"]');
    expect(keys.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: BULK FACTORIES ============

function KanbanBulkCardsDemo() {
  const cards = React.useMemo(() => createFakeKanbanCards(8), []);
  return (
    <div className="p-6" data-testid="kanban-bulk-cards">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.id} data-slot="bulk-card">
            <KanbanCardWithData card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const BulkCards: Story = {
  name: i18n.t('kanban.storyName.bulkCards', 'Factory: Bulk Cards'),
  render: () => <KanbanBulkCardsDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-bulk-cards"]');
    expect(wrapper).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="bulk-card"]');
    expect(cards.length).toBe(8);
  },
};

function KanbanBulkAssigneesDemo() {
  const assignees = React.useMemo(() => createFakeKanbanAssignees(6), []);
  return (
    <div className="p-6" data-testid="kanban-bulk-assignees">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex flex-wrap gap-3">
        {assignees.map((assignee) => (
          <Card key={assignee.id}>
            <CardContent className="flex items-center gap-2 p-3" data-slot="bulk-assignee">
              <Avatar className="size-8">
                <AvatarImage src={assignee.avatar} alt={assignee.name} />
                <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xs font-medium">{assignee.name}</div>
                <div className="text-muted-foreground text-xs">{assignee.email}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const BulkAssignees: Story = {
  name: i18n.t('kanban.storyName.bulkAssignees', 'Factory: Bulk Assignees'),
  render: () => <KanbanBulkAssigneesDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-bulk-assignees"]');
    expect(wrapper).toBeInTheDocument();
    const assignees = canvasElement.querySelectorAll('[data-slot="bulk-assignee"]');
    expect(assignees.length).toBe(6);
  },
};

function KanbanBulkTagsDemo() {
  const tags = React.useMemo(() => createFakeKanbanTags(9), []);
  return (
    <div className="p-6" data-testid="kanban-bulk-tags">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
            style={{ borderColor: tag.color, color: tag.color }}
            data-slot="bulk-tag"
          >
            {tag.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const BulkTags: Story = {
  name: i18n.t('kanban.storyName.bulkTags', 'Factory: Bulk Tags'),
  render: () => <KanbanBulkTagsDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-bulk-tags"]');
    expect(wrapper).toBeInTheDocument();
    const tags = canvasElement.querySelectorAll('[data-slot="bulk-tag"]');
    expect(tags.length).toBe(9);
  },
};

// ============ FACTORY: CONSTANTS STORIES ============

function KanbanPrioritiesDemo() {
  const priorityColors: Record<KanbanPriority, string> = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };
  return (
    <div className="p-6" data-testid="kanban-priorities">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex flex-wrap gap-2">
        {KANBAN_PRIORITIES.map((priority) => (
          <Badge
            key={priority}
            variant="secondary"
            className={priorityColors[priority]}
            data-slot="priority-badge"
          >
            {priority}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const Priorities: Story = {
  name: i18n.t('kanban.storyName.priorities', 'Factory: Priorities Constant'),
  render: () => <KanbanPrioritiesDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-priorities"]');
    expect(wrapper).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-slot="priority-badge"]');
    expect(badges.length).toBe(4);
    const texts = [...badges].map((b) => b.textContent?.trim());
    expect(texts).toContain('low');
    expect(texts).toContain('medium');
    expect(texts).toContain('high');
    expect(texts).toContain('urgent');
  },
};

function KanbanStatusesDemo() {
  const statusColors: Record<KanbanStatus, string> = {
    todo: '#6b7280',
    'in-progress': '#3b82f6',
    review: '#f59e0b',
    done: '#22c55e',
  };
  return (
    <div className="p-6" data-testid="kanban-statuses">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex flex-wrap gap-2">
        {KANBAN_STATUSES.map((status) => (
          <Badge
            key={status}
            variant="outline"
            style={{ borderColor: statusColors[status], color: statusColors[status] }}
            data-slot="status-badge"
          >
            {status}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const Statuses: Story = {
  name: i18n.t('kanban.storyName.statuses', 'Factory: Statuses Constant'),
  render: () => <KanbanStatusesDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-statuses"]');
    expect(wrapper).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-slot="status-badge"]');
    expect(badges.length).toBe(4);
    const texts = [...badges].map((b) => b.textContent?.trim());
    expect(texts).toContain('todo');
    expect(texts).toContain('in-progress');
    expect(texts).toContain('review');
    expect(texts).toContain('done');
  },
};

function KanbanTagColorsDemo() {
  return (
    <div className="p-6" data-testid="kanban-tag-colors">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex flex-wrap gap-2">
        {KANBAN_TAG_COLORS.map((color) => (
          <div
            key={color}
            className="flex size-10 items-center justify-center rounded-md font-mono text-xs text-white"
            style={{ backgroundColor: color }}
            data-slot="tag-color-swatch"
          >
            {color}
          </div>
        ))}
      </div>
    </div>
  );
}

export const TagColors: Story = {
  name: i18n.t('kanban.storyName.tagColors', 'Factory: Tag Colors Constant'),
  render: () => <KanbanTagColorsDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-tag-colors"]');
    expect(wrapper).toBeInTheDocument();
    const swatches = canvasElement.querySelectorAll('[data-slot="tag-color-swatch"]');
    expect(swatches.length).toBe(9);
  },
};

function KanbanTagLabelsDemo() {
  return (
    <div className="p-6" data-testid="kanban-tag-labels">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
      <div className="flex flex-wrap gap-2">
        {KANBAN_TAG_LABELS.map((label) => (
          <Badge key={label} variant="secondary" data-slot="tag-label-badge">
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const TagLabels: Story = {
  name: i18n.t('kanban.storyName.tagLabels', 'Factory: Tag Labels Constant'),
  render: () => <KanbanTagLabelsDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-tag-labels"]');
    expect(wrapper).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-slot="tag-label-badge"]');
    expect(badges.length).toBe(9);
    const texts = [...badges].map((b) => b.textContent?.trim());
    expect(texts).toContain('bug');
    expect(texts).toContain('feature');
    expect(texts).toContain('frontend');
  },
};

// ============ HANDLER: UNUSED STATUS HANDLER STORIES ============

export const SuccessHandler: Story = {
  name: i18n.t('kanban.storyName.successHandler', 'Handler: Success'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.success },
  },
  render: () => <KanbanWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="kanban-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const columns = canvasElement.querySelectorAll('[data-column-id]');
    expect(columns.length).toBe(4);
  },
};

export const CreatedHandler: Story = {
  name: i18n.t('kanban.storyName.createdHandler', 'Handler: Created (201)'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.created },
  },
  render: () => {
    function CreatedDemo() {
      const [result, setResult] = React.useState<string | null>(null);
      const [loading, setLoading] = React.useState(false);

      const createCard = () => {
        setLoading(true);
        fetch('/api/kanban/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New card', description: 'Test card' }),
        })
          .then(async (res) => {
            const data = (await res.json()) as { id: string; title: string };
            setResult(`Created card: ${data.title} (${data.id})`);
            setLoading(false);
            return undefined;
          })
          .catch(() => {
            setResult('Failed to create card');
            setLoading(false);
          });
      };

      return (
        <div className="p-6" data-testid="kanban-created">
          <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
          <Button onClick={createCard} disabled={loading} data-slot="create-button">
            {loading ? 'Creating...' : 'Create Card'}
          </Button>
          {result && (
            <div className="mt-3 text-sm" data-slot="create-result">
              {result}
            </div>
          )}
        </div>
      );
    }
    return <CreatedDemo />;
  },
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-created"]');
    expect(wrapper).toBeInTheDocument();
    const button = canvasElement.querySelector('[data-slot="create-button"]');
    expect(button).toBeInTheDocument();
    if (button instanceof HTMLButtonElement) {
      await userEvent.click(button);
      await waitFor(
        () => {
          expect(canvasElement.querySelector('[data-slot="create-result"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
      const result = canvasElement.querySelector('[data-slot="create-result"]');
      expect(result?.textContent).toContain('Created card');
    }
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('kanban.storyName.error404NotFound', 'Handler: Not Found (404)'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.notFound },
  },
  render: () => {
    function NotFoundDemo() {
      const [error, setError] = React.useState<string | null>(null);
      const [loading, setLoading] = React.useState(false);

      const fetchBoard = () => {
        setLoading(true);
        fetch('/api/kanban/board/nonexistent-id')
          .then(async (res) => {
            if (!res.ok) {
              const data = (await res.json()) as { code: string; message: string; status: number };
              setError(`${data.status} ${data.code}: ${data.message}`);
            }
            setLoading(false);
            return undefined;
          })
          .catch(() => {
            setError('Network error');
            setLoading(false);
          });
      };

      return (
        <div className="p-6" data-testid="kanban-not-found">
          <p className="text-muted-foreground mb-3 text-sm">{i18n.t('kanban.instructions')}</p>
          <Button onClick={fetchBoard} disabled={loading} data-slot="fetch-button">
            {loading ? 'Fetching...' : 'Fetch Board'}
          </Button>
          {error && (
            <Alert variant="destructive" className="mt-3" data-slot="not-found-error">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>{i18n.t('kanban.story.notFound', 'Not Found')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }
    return <NotFoundDemo />;
  },
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-not-found"]');
    expect(wrapper).toBeInTheDocument();
    const button = canvasElement.querySelector('[data-slot="fetch-button"]');
    expect(button).toBeInTheDocument();
    if (button instanceof HTMLButtonElement) {
      await userEvent.click(button);
      await waitFor(
        () => {
          expect(canvasElement.querySelector('[data-slot="not-found-error"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('kanban.storyName.error409Conflict', 'Handler: Conflict (409)'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.conflict },
  },
  render: () => {
    function ConflictDemo() {
      const { t } = useTranslation();
      const [error, setError] = React.useState<string | null>(null);
      const [loading, setLoading] = React.useState(false);

      const moveCard = () => {
        setLoading(true);
        fetch('/api/kanban/cards/some-card-id/move', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnId: 'done', position: 0 }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const data = (await res.json()) as {
                code: string;
                details?: Record<string, string>;
                message: string;
              };
              const byText = data.details ? ' (by ' + data.details.lastModifiedBy + ')' : '';
              setError(`${data.code}: ${data.message}` + byText);
            }
            setLoading(false);
            return undefined;
          })
          .catch(() => {
            setError('Network error');
            setLoading(false);
          });
      };

      return (
        <div className="p-6" data-testid="kanban-conflict">
          <p className="text-muted-foreground mb-3 text-sm">{t('kanban.instructions')}</p>
          <Button onClick={moveCard} disabled={loading} data-slot="move-button">
            {loading ? 'Moving...' : 'Move Card'}
          </Button>
          {error && (
            <Alert variant="destructive" className="mt-3" data-slot="conflict-error">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>{t('kanban.story.conflict', 'Conflict')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }
    return <ConflictDemo />;
  },
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-conflict"]');
    expect(wrapper).toBeInTheDocument();
    const button = canvasElement.querySelector('[data-slot="move-button"]');
    expect(button).toBeInTheDocument();
    if (button instanceof HTMLButtonElement) {
      await userEvent.click(button);
      await waitFor(
        () => {
          expect(canvasElement.querySelector('[data-slot="conflict-error"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const ColumnLimitReached: Story = {
  name: i18n.t('kanban.storyName.columnLimitReached', 'Handler: Column Limit Reached'),
  parameters: {
    msw: { handlers: kanbanStatusHandlers.columnLimitReached },
  },
  render: () => {
    function ColumnLimitDemo() {
      const { t } = useTranslation();
      const [error, setError] = React.useState<string | null>(null);
      const [loading, setLoading] = React.useState(false);

      const addCard = () => {
        setLoading(true);
        fetch('/api/kanban/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New card', columnId: 'doing' }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const data = (await res.json()) as {
                code: string;
                details?: Record<string, string>;
                message: string;
              };
              setError(
                `${data.code}: ${data.message} (${data.details?.current ?? '?'}/${data.details?.limit ?? '?'})`
              );
            }
            setLoading(false);
            return undefined;
          })
          .catch(() => {
            setError('Network error');
            setLoading(false);
          });
      };

      return (
        <div className="p-6" data-testid="kanban-column-limit">
          <p className="text-muted-foreground mb-3 text-sm">{t('kanban.instructions')}</p>
          <Button onClick={addCard} disabled={loading} data-slot="add-card-button">
            {loading ? 'Adding...' : 'Add Card to Full Column'}
          </Button>
          {error && (
            <Alert variant="destructive" className="mt-3" data-slot="column-limit-error">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>{t('kanban.story.columnLimit', 'Column Limit')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }
    return <ColumnLimitDemo />;
  },
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="kanban-column-limit"]');
    expect(wrapper).toBeInTheDocument();
    const button = canvasElement.querySelector('[data-slot="add-card-button"]');
    expect(button).toBeInTheDocument();
    if (button instanceof HTMLButtonElement) {
      await userEvent.click(button);
      await waitFor(
        () => {
          expect(
            canvasElement.querySelector('[data-slot="column-limit-error"]')
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
      const errorEl = canvasElement.querySelector('[data-slot="column-limit-error"]');
      expect(errorEl?.textContent).toContain('COLUMN_LIMIT');
    }
  },
};

// ============ DARK RTL STORY ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('kanban.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DARK JAPANESE STORY ============

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('kanban.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MOBILE STORY ============

export const Mobile: Story = {
  ...Default,
  name: i18n.t('kanban.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DATA ATTRIBUTES STORY ============

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('kanban.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
