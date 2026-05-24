'use client';

import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DndContextProps,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DropAnimation,
  type DroppableContainer,
  KeyboardCode,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  closestCenter,
  closestCorners,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  type AnimateLayoutChanges,
  SortableContext,
  type SortableContextProps,
  arrayMove,
  defaultAnimateLayoutChanges,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { useComposedRefs } from '@/lib/compose-refs';
import { cn } from '@/lib/utils';

/**
 * Kanban component library - Drag and drop board system
 *
 * @description
 * A full-featured kanban board component built on @dnd-kit.
 * Supports columns, items, drag handles, and keyboard navigation.
 *
 * ## Features
 * - **Drag & Drop**: Smooth drag and drop for items and columns
 * - **Keyboard Navigation**: Full keyboard support (Arrow keys, Enter, Escape)
 * - **Touch Support**: Mobile-friendly touch gestures
 * - **Overlays**: Drag preview overlays during drag
 * - **Announcements**: Screen reader announcements
 * - **Column Sorting**: Reorder columns themselves
 * - **Cross-Column Moves**: Move items between columns
 *
 * ## Components
 * - `Kanban` - Root component with drag context
 * - `KanbanBoard` - Container for columns
 * - `KanbanColumn` - Droppable column container
 * - `KanbanColumnHandle` - Drag handle for columns
 * - `KanbanItem` - Draggable item
 * - `KanbanItemHandle` - Drag handle for items
 * - `KanbanOverlay` - Drag preview overlay
 *
 * ## Accessibility
 * - Keyboard navigation with arrow keys
 * - Screen reader announcements for drag operations
 * - ARIA attributes for drag states
 * - Focus management
 *
 * @example
 * ```tsx
 * const [columns, setColumns] = useState({
 *   todo: [{ id: '1', title: 'Task 1' }],
 *   done: [{ id: '2', title: 'Task 2' }],
 * });
 *
 * <Kanban
 *   value={columns}
 *   onValueChange={setColumns}
 *   getItemValue={(item) => item.id}
 * >
 *   <KanbanBoard>
 *     {Object.keys(columns).map((columnId) => (
 *       <KanbanColumn key={columnId} value={columnId}>
 *         <KanbanColumnHandle>
 *           <GripIcon />
 *         </KanbanColumnHandle>
 *         <h3>{columnId}</h3>
 *         {columns[columnId].map((item) => (
 *           <KanbanItem key={item.id} value={item.id} asHandle>
 *             {item.title}
 *           </KanbanItem>
 *         ))}
 *       </KanbanColumn>
 *     ))}
 *   </KanbanBoard>
 *   <KanbanOverlay>
 *     {({ value, variant }) => (
 *       <div>{variant === 'item' ? 'Dragging item' : 'Dragging column'}</div>
 *     )}
 *   </KanbanOverlay>
 * </Kanban>
 * ```
 *
 * @see https://dndkit.com/
 */

const directions: string[] = [
  KeyboardCode.Down,
  KeyboardCode.Right,
  KeyboardCode.Up,
  KeyboardCode.Left,
];

const coordinateGetter: KeyboardCoordinateGetter = (event, { context }) => {
  const { active, droppableRects, droppableContainers, collisionRect } = context;

  if (directions.includes(event.code)) {
    event.preventDefault();

    if (!active || !collisionRect) return;

    const filteredContainers: DroppableContainer[] = [];

    for (const entry of droppableContainers.getEnabled()) {
      if (!entry || entry?.disabled) return;

      const rect = droppableRects.get(entry.id);

      if (!rect) return;

      const data = entry.data.current;

      if (data) {
        const { type, children } = data;

        if (type === 'container' && children?.length > 0) {
          if (active.data.current?.type !== 'container') {
            return;
          }
        }
      }

      switch (event.code) {
        case KeyboardCode.Down:
          if (collisionRect.top < rect.top) {
            filteredContainers.push(entry);
          }
          break;
        case KeyboardCode.Up:
          if (collisionRect.top > rect.top) {
            filteredContainers.push(entry);
          }
          break;
        case KeyboardCode.Left:
          if (collisionRect.left >= rect.left + rect.width) {
            filteredContainers.push(entry);
          }
          break;
        case KeyboardCode.Right:
          if (collisionRect.left + collisionRect.width <= rect.left) {
            filteredContainers.push(entry);
          }
          break;
      }
    }

    const collisions = closestCorners({
      active,
      collisionRect: collisionRect,
      droppableRects,
      droppableContainers: filteredContainers,
      pointerCoordinates: null,
    });
    const closestId = getFirstCollision(collisions, 'id');

    if (closestId != null) {
      const newDroppable = droppableContainers.get(closestId);
      const newNode = newDroppable?.node.current;
      const newRect = newDroppable?.rect.current;

      if (newNode && newRect) {
        if (newDroppable.id === 'placeholder') {
          return {
            x: newRect.left + (newRect.width - collisionRect.width) / 2,
            y: newRect.top + (newRect.height - collisionRect.height) / 2,
          };
        }

        if (newDroppable.data.current?.type === 'container') {
          return {
            x: newRect.left + 20,
            y: newRect.top + 74,
          };
        }

        return {
          x: newRect.left,
          y: newRect.top,
        };
      }
    }
  }

  return undefined;
};

const ROOT_NAME = 'Kanban';
const BOARD_NAME = 'KanbanBoard';
const COLUMN_NAME = 'KanbanColumn';
const COLUMN_HANDLE_NAME = 'KanbanColumnHandle';
const ITEM_NAME = 'KanbanItem';
const ITEM_HANDLE_NAME = 'KanbanItemHandle';
const OVERLAY_NAME = 'KanbanOverlay';

/** Kanban context value for internal use */
interface KanbanContextValue<T> {
  id: string;
  items: Record<UniqueIdentifier, T[]>;
  modifiers: DndContextProps['modifiers'];
  strategy: SortableContextProps['strategy'];
  orientation: 'horizontal' | 'vertical';
  activeId: UniqueIdentifier | null;
  setActiveId: (id: UniqueIdentifier | null) => void;
  getItemValue: (item: T) => UniqueIdentifier;
  flatCursor: boolean;
}

const KanbanContext = React.createContext<KanbanContextValue<unknown> | null>(null);
KanbanContext.displayName = ROOT_NAME;

function useKanbanContext(consumerName: string) {
  const context = React.useContext(KanbanContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

/** Helper interface for getItemValue callback */
interface GetItemValue<T> {
  /**
   * Callback that returns a unique identifier for each kanban item. Required for array of objects.
   * @example getItemValue={(item) => item.id}
   */
  getItemValue: (item: T) => UniqueIdentifier;
}

/**
 * KanbanRoot component props
 * @see https://dndkit.com/
 */
export type KanbanRootProps<T> = Omit<DndContextProps, 'collisionDetection'> &
  GetItemValue<T> & {
    /** Kanban data organized by column */
    value: Record<UniqueIdentifier, T[]>;
    /** Callback when columns change */
    onValueChange?: (columns: Record<UniqueIdentifier, T[]>) => void;
    /** Callback when items are moved */
    onMove?: (event: DragEndEvent & { activeIndex: number; overIndex: number }) => void;
    /** Sorting strategy for items */
    strategy?: SortableContextProps['strategy'];
    /** Layout orientation */
    orientation?: 'horizontal' | 'vertical';
    /** Use flat cursor instead of grab cursor */
    flatCursor?: boolean;
  } & (T extends object ? GetItemValue<T> : Partial<GetItemValue<T>>);

/**
 * Kanban component - Drag and drop kanban board root
 *
 * @description
 * The root component that provides drag-and-drop context for the
 * kanban board. Manages state, collision detection, and accessibility.
 *
 * @typeParam T - Type of items in the kanban board
 */
function KanbanRoot<T>(props: KanbanRootProps<T>) {
  const {
    value,
    onValueChange,
    modifiers,
    strategy = verticalListSortingStrategy,
    orientation = 'horizontal',
    onMove,
    getItemValue: getItemValueProp,
    accessibility,
    flatCursor = false,
    ...kanbanProps
  } = props;

  const id = React.useId();
  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const lastOverIdRef = React.useRef<UniqueIdentifier | null>(null);
  const hasMovedRef = React.useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter,
    })
  );

  const getItemValue = React.useCallback(
    (item: T): UniqueIdentifier => {
      if (typeof item === 'object' && !getItemValueProp) {
        throw new Error('getItemValue is required when using array of objects');
      }
      return getItemValueProp ? getItemValueProp(item) : (item as UniqueIdentifier);
    },
    [getItemValueProp]
  );

  const getColumn = React.useCallback(
    (id: UniqueIdentifier) => {
      if (id in value) return id;

      for (const [columnId, items] of Object.entries(value)) {
        if (items.some((item) => getItemValue(item) === id)) {
          return columnId;
        }
      }

      return null;
    },
    [value, getItemValue]
  );

  const collisionDetection: CollisionDetection = React.useCallback(
    (args) => {
      if (activeId && activeId in value) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) => container.id in value
          ),
        });
      }

      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);
      let overId = getFirstCollision(intersections, 'id');

      if (!overId) {
        if (hasMovedRef.current) {
          lastOverIdRef.current = activeId;
        }
        return lastOverIdRef.current ? [{ id: lastOverIdRef.current }] : [];
      }

      if (overId in value) {
        const containerItems = value[overId];
        if (containerItems && containerItems.length > 0) {
          const closestItem = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (container) =>
                container.id !== overId &&
                containerItems.some((item) => getItemValue(item) === container.id)
            ),
          });

          if (closestItem.length > 0) {
            overId = closestItem[0]?.id ?? overId;
          }
        }
      }

      lastOverIdRef.current = overId;
      return [{ id: overId }];
    },
    [activeId, value, getItemValue]
  );

  const onDragStart = React.useCallback(
    (event: DragStartEvent) => {
      kanbanProps.onDragStart?.(event);

      if (event.activatorEvent.defaultPrevented) return;
      setActiveId(event.active.id);
    },
    [kanbanProps.onDragStart]
  );

  const onDragOver = React.useCallback(
    (event: DragOverEvent) => {
      kanbanProps.onDragOver?.(event);

      if (event.activatorEvent.defaultPrevented) return;

      const { active, over } = event;
      if (!over) return;

      const activeColumn = getColumn(active.id);
      const overColumn = getColumn(over.id);

      if (!activeColumn || !overColumn) return;

      if (activeColumn === overColumn) {
        const items = value[activeColumn];
        if (!items) return;

        const activeIndex = items.findIndex((item) => getItemValue(item) === active.id);
        const overIndex = items.findIndex((item) => getItemValue(item) === over.id);

        if (activeIndex !== overIndex) {
          const newColumns = { ...value };
          newColumns[activeColumn] = arrayMove(items, activeIndex, overIndex);
          onValueChange?.(newColumns);
        }
      } else {
        const activeItems = value[activeColumn];
        const overItems = value[overColumn];

        if (!activeItems || !overItems) return;

        const activeIndex = activeItems.findIndex((item) => getItemValue(item) === active.id);

        if (activeIndex === -1) return;

        const activeItem = activeItems[activeIndex];
        if (!activeItem) return;

        const updatedItems = {
          ...value,
          [activeColumn]: activeItems.filter((item) => getItemValue(item) !== active.id),
          [overColumn]: [...overItems, activeItem],
        };

        onValueChange?.(updatedItems);
        hasMovedRef.current = true;
      }
    },
    [value, getColumn, getItemValue, onValueChange, kanbanProps.onDragOver]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      kanbanProps.onDragEnd?.(event);

      if (event.activatorEvent.defaultPrevented) return;

      const { active, over } = event;

      if (!over) {
        setActiveId(null);
        return;
      }

      if (active.id in value && over.id in value) {
        const activeIndex = Object.keys(value).indexOf(active.id as string);
        const overIndex = Object.keys(value).indexOf(over.id as string);

        if (activeIndex !== overIndex) {
          const orderedColumns = Object.keys(value);
          const newOrder = arrayMove(orderedColumns, activeIndex, overIndex);

          const newColumns: Record<UniqueIdentifier, T[]> = {};
          for (const key of newOrder) {
            const items = value[key];
            if (items) {
              newColumns[key] = items;
            }
          }

          if (onMove) {
            onMove({ ...event, activeIndex, overIndex });
          } else {
            onValueChange?.(newColumns);
          }
        }
      } else {
        const activeColumn = getColumn(active.id);
        const overColumn = getColumn(over.id);

        if (!activeColumn || !overColumn) {
          setActiveId(null);
          return;
        }

        if (activeColumn === overColumn) {
          const items = value[activeColumn];
          if (!items) {
            setActiveId(null);
            return;
          }

          const activeIndex = items.findIndex((item) => getItemValue(item) === active.id);
          const overIndex = items.findIndex((item) => getItemValue(item) === over.id);

          if (activeIndex !== overIndex) {
            const newColumns = { ...value };
            newColumns[activeColumn] = arrayMove(items, activeIndex, overIndex);
            if (onMove) {
              onMove({
                ...event,
                activeIndex,
                overIndex,
              });
            } else {
              onValueChange?.(newColumns);
            }
          }
        }
      }

      setActiveId(null);
      hasMovedRef.current = false;
    },
    [value, getColumn, getItemValue, onValueChange, onMove, kanbanProps.onDragEnd]
  );

  const onDragCancel = React.useCallback(
    (event: DragCancelEvent) => {
      kanbanProps.onDragCancel?.(event);

      if (event.activatorEvent.defaultPrevented) return;

      setActiveId(null);
      hasMovedRef.current = false;
    },
    [kanbanProps.onDragCancel]
  );

  const announcements: Announcements = React.useMemo(
    () => ({
      onDragStart({ active }) {
        const isColumn = active.id in value;
        const itemType = isColumn ? 'column' : 'item';
        const position = isColumn
          ? Object.keys(value).indexOf(active.id as string) + 1
          : (() => {
              const column = getColumn(active.id);
              if (!column || !value[column]) return 1;
              return value[column].findIndex((item) => getItemValue(item) === active.id) + 1;
            })();
        const total = isColumn
          ? Object.keys(value).length
          : (() => {
              const column = getColumn(active.id);
              return column ? (value[column]?.length ?? 0) : 0;
            })();

        return `Picked up ${itemType} at position ${position} of ${total}`;
      },
      onDragOver({ active, over }) {
        if (!over) return;

        const isColumn = active.id in value;
        const itemType = isColumn ? 'column' : 'item';
        const position = isColumn
          ? Object.keys(value).indexOf(over.id as string) + 1
          : (() => {
              const column = getColumn(over.id);
              if (!column || !value[column]) return 1;
              return value[column].findIndex((item) => getItemValue(item) === over.id) + 1;
            })();
        const total = isColumn
          ? Object.keys(value).length
          : (() => {
              const column = getColumn(over.id);
              return column ? (value[column]?.length ?? 0) : 0;
            })();

        const overColumn = getColumn(over.id);
        const activeColumn = getColumn(active.id);

        if (isColumn) {
          return `${itemType} is now at position ${position} of ${total}`;
        }

        if (activeColumn !== overColumn) {
          return `${itemType} is now at position ${position} of ${total} in ${overColumn}`;
        }

        return `${itemType} is now at position ${position} of ${total}`;
      },
      onDragEnd({ active, over }) {
        if (!over) return;

        const isColumn = active.id in value;
        const itemType = isColumn ? 'column' : 'item';
        const position = isColumn
          ? Object.keys(value).indexOf(over.id as string) + 1
          : (() => {
              const column = getColumn(over.id);
              if (!column || !value[column]) return 1;
              return value[column].findIndex((item) => getItemValue(item) === over.id) + 1;
            })();
        const total = isColumn
          ? Object.keys(value).length
          : (() => {
              const column = getColumn(over.id);
              return column ? (value[column]?.length ?? 0) : 0;
            })();

        const overColumn = getColumn(over.id);
        const activeColumn = getColumn(active.id);

        if (isColumn) {
          return `${itemType} was dropped at position ${position} of ${total}`;
        }

        if (activeColumn !== overColumn) {
          return `${itemType} was dropped at position ${position} of ${total} in ${overColumn}`;
        }

        return `${itemType} was dropped at position ${position} of ${total}`;
      },
      onDragCancel({ active }) {
        const isColumn = active.id in value;
        const itemType = isColumn ? 'column' : 'item';
        return `Dragging was cancelled. ${itemType} was dropped.`;
      },
    }),
    [value, getColumn, getItemValue]
  );

  const contextValue = React.useMemo<KanbanContextValue<T>>(
    () => ({
      id,
      items: value,
      modifiers,
      strategy,
      orientation,
      activeId,
      setActiveId,
      getItemValue,
      flatCursor,
    }),
    [id, value, activeId, modifiers, strategy, orientation, getItemValue, flatCursor]
  );

  return (
    <KanbanContext.Provider value={contextValue as KanbanContextValue<unknown>}>
      <DndContext
        collisionDetection={collisionDetection}
        modifiers={modifiers}
        sensors={sensors}
        {...kanbanProps}
        id={id}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: `
            To pick up a kanban item or column, press space or enter.
            While dragging, use the arrow keys to move the item.
            Press space or enter again to drop the item in its new position, or press escape to cancel.
          `,
          },
          ...accessibility,
        }}
      />
    </KanbanContext.Provider>
  );
}

/** Kanban board context for internal use */
const KanbanBoardContext = React.createContext<boolean>(false);
KanbanBoardContext.displayName = BOARD_NAME;

/** KanbanBoard component props */
export interface KanbanBoardProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Board content */
  children: React.ReactNode;
  /** Render as child element */
  asChild?: boolean;
}

/** KanbanBoard component - container for kanban columns */
const KanbanBoard = React.forwardRef<HTMLDivElement, KanbanBoardProps>((props, forwardedRef) => {
  const { asChild, className, ...boardProps } = props;

  const context = useKanbanContext(BOARD_NAME);

  const columns = React.useMemo(() => {
    return Object.keys(context.items);
  }, [context.items]);

  const BoardPrimitive = asChild ? Slot : 'div';

  return (
    <KanbanBoardContext.Provider value={true}>
      <SortableContext
        items={columns}
        strategy={
          context.orientation === 'horizontal'
            ? horizontalListSortingStrategy
            : verticalListSortingStrategy
        }
      >
        <BoardPrimitive
          aria-orientation={context.orientation}
          data-orientation={context.orientation}
          data-slot="kanban-board"
          data-testid="kanban-board"
          {...boardProps}
          ref={forwardedRef}
          className={cn(
            'flex size-full gap-4',
            context.orientation === 'horizontal' ? 'flex-row' : 'flex-col',
            className
          )}
        />
      </SortableContext>
    </KanbanBoardContext.Provider>
  );
});
KanbanBoard.displayName = BOARD_NAME;

/** Kanban column context value for internal use */
interface KanbanColumnContextValue {
  id: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  isDragging?: boolean;
  disabled?: boolean;
}

/** Kanban column context for sharing column state */
const KanbanColumnContext = React.createContext<KanbanColumnContextValue | null>(null);
KanbanColumnContext.displayName = COLUMN_NAME;

/** Hook to access kanban column context */
function useKanbanColumnContext(consumerName: string) {
  const context = React.useContext(KanbanColumnContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${COLUMN_NAME}\``);
  }
  return context;
}

/** Layout change animation function */
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

/** KanbanColumn component props */
export interface KanbanColumnProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Column identifier */
  value: UniqueIdentifier;
  /** Column content */
  children: React.ReactNode;
  /** Render as child element */
  asChild?: boolean;
  /** Use entire column as drag handle */
  asHandle?: boolean;
  /** Disable column drag */
  disabled?: boolean;
}

/** KanbanColumn component - draggable column container */
const KanbanColumn = React.forwardRef<HTMLDivElement, KanbanColumnProps>((props, forwardedRef) => {
  const { value, asChild, asHandle, disabled, className, style, ...columnProps } = props;

  const id = React.useId();
  const context = useKanbanContext(COLUMN_NAME);
  const inBoard = React.useContext(KanbanBoardContext);
  const inOverlay = React.useContext(KanbanOverlayContext);

  if (!inBoard && !inOverlay) {
    throw new Error(
      `\`${COLUMN_NAME}\` must be used within \`${BOARD_NAME}\` or \`${OVERLAY_NAME}\``
    );
  }

  if (value === '') {
    throw new Error(`\`${COLUMN_NAME}\` value cannot be an empty string`);
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: value,
    disabled,
    animateLayoutChanges,
  });

  const composedRef = useComposedRefs(forwardedRef, (node) => {
    if (disabled) return;
    setNodeRef(node);
  });

  const composedStyle = React.useMemo<React.CSSProperties>(() => {
    return {
      transform: CSS.Transform.toString(transform),
      transition,
      ...style,
    };
  }, [transform, transition, style]);

  const items = React.useMemo(() => {
    const items = context.items[value] ?? [];
    return items.map((item) => context.getItemValue(item));
  }, [context.items, value, context.getItemValue]);

  const columnContext = React.useMemo<KanbanColumnContextValue>(
    () => ({
      id,
      attributes,
      listeners,
      setActivatorNodeRef,
      isDragging,
      disabled,
    }),
    [id, attributes, listeners, setActivatorNodeRef, isDragging, disabled]
  );

  const ColumnPrimitive = asChild ? Slot : 'div';

  return (
    <KanbanColumnContext.Provider value={columnContext}>
      <SortableContext
        items={items}
        strategy={
          context.orientation === 'horizontal'
            ? horizontalListSortingStrategy
            : verticalListSortingStrategy
        }
      >
        <ColumnPrimitive
          id={id}
          data-disabled={disabled}
          data-dragging={isDragging ? '' : undefined}
          data-slot="kanban-column"
          data-testid="kanban-column"
          {...columnProps}
          {...(asHandle && !disabled ? attributes : {})}
          {...(asHandle && !disabled ? listeners : {})}
          ref={composedRef}
          style={composedStyle}
          className={cn(
            'bg-muted flex size-full flex-col gap-2 rounded-lg p-2.5 aria-disabled:pointer-events-none aria-disabled:opacity-50',
            {
              'touch-none select-none': asHandle,
              'cursor-default': context.flatCursor,
              'data-dragging:cursor-grabbing': !context.flatCursor,
              'cursor-grab': !isDragging && asHandle && !context.flatCursor,
              'opacity-50': isDragging,
              'pointer-events-none opacity-50': disabled,
            },
            className
          )}
        />
      </SortableContext>
    </KanbanColumnContext.Provider>
  );
});
KanbanColumn.displayName = COLUMN_NAME;

/** KanbanColumnHandle component props */
export interface KanbanColumnHandleProps extends React.ComponentPropsWithoutRef<'button'> {
  /** Render as child element */
  asChild?: boolean;
}

/** KanbanColumnHandle component - drag handle for columns */
const KanbanColumnHandle = React.forwardRef<HTMLButtonElement, KanbanColumnHandleProps>(
  (props, forwardedRef) => {
    const { asChild, disabled, className, ...columnHandleProps } = props;

    const context = useKanbanContext(COLUMN_NAME);
    const columnContext = useKanbanColumnContext(COLUMN_HANDLE_NAME);

    const isDisabled = disabled ?? columnContext.disabled;

    const composedRef = useComposedRefs(forwardedRef, (node) => {
      if (isDisabled) return;
      columnContext.setActivatorNodeRef(node);
    });

    const HandlePrimitive = asChild ? Slot : 'button';

    return (
      <HandlePrimitive
        type="button"
        aria-controls={columnContext.id}
        data-disabled={isDisabled}
        data-dragging={columnContext.isDragging ? '' : undefined}
        data-slot="kanban-column-handle"
        data-testid="kanban-column-handle"
        {...columnHandleProps}
        {...(isDisabled ? {} : columnContext.attributes)}
        {...(isDisabled ? {} : columnContext.listeners)}
        ref={composedRef}
        className={cn(
          'select-none disabled:pointer-events-none disabled:opacity-50',
          context.flatCursor ? 'cursor-default' : 'cursor-grab data-dragging:cursor-grabbing',
          className
        )}
        disabled={isDisabled}
      />
    );
  }
);
KanbanColumnHandle.displayName = COLUMN_HANDLE_NAME;

/** Kanban item context value for internal use */
interface KanbanItemContextValue {
  id: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  isDragging?: boolean;
  disabled?: boolean;
}

/** Kanban item context for sharing item state */
const KanbanItemContext = React.createContext<KanbanItemContextValue | null>(null);
KanbanItemContext.displayName = ITEM_NAME;

/** Hook to access kanban item context */
function useKanbanItemContext(consumerName: string) {
  const context = React.useContext(KanbanItemContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ITEM_NAME}\``);
  }
  return context;
}

/** KanbanItem component props */
export interface KanbanItemProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Item identifier */
  value: UniqueIdentifier;
  /** Use entire item as drag handle */
  asHandle?: boolean;
  /** Render as child element */
  asChild?: boolean;
  /** Disable item drag */
  disabled?: boolean;
}

/** KanbanItem component - draggable item within columns */
const KanbanItem = React.forwardRef<HTMLDivElement, KanbanItemProps>((props, forwardedRef) => {
  const { value, style, asHandle, asChild, disabled, className, ...itemProps } = props;

  const id = React.useId();
  const context = useKanbanContext(ITEM_NAME);
  const inBoard = React.useContext(KanbanBoardContext);
  const inOverlay = React.useContext(KanbanOverlayContext);

  if (!inBoard && !inOverlay) {
    throw new Error(`\`${ITEM_NAME}\` must be used within \`${BOARD_NAME}\``);
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: value, disabled });

  if (value === '') {
    throw new Error(`\`${ITEM_NAME}\` value cannot be an empty string`);
  }

  const composedRef = useComposedRefs(forwardedRef, (node) => {
    if (disabled) return;
    setNodeRef(node);
  });

  const composedStyle = React.useMemo<React.CSSProperties>(() => {
    return {
      transform: CSS.Transform.toString(transform),
      transition,
      ...style,
    };
  }, [transform, transition, style]);

  const itemContext = React.useMemo<KanbanItemContextValue>(
    () => ({
      id,
      attributes,
      listeners,
      setActivatorNodeRef,
      isDragging,
      disabled,
    }),
    [id, attributes, listeners, setActivatorNodeRef, isDragging, disabled]
  );

  const ItemPrimitive = asChild ? Slot : 'div';

  return (
    <KanbanItemContext.Provider value={itemContext}>
      <ItemPrimitive
        id={id}
        data-disabled={disabled}
        data-dragging={isDragging ? '' : undefined}
        data-slot="kanban-item"
        data-testid="kanban-item"
        {...itemProps}
        {...(asHandle && !disabled ? attributes : {})}
        {...(asHandle && !disabled ? listeners : {})}
        ref={composedRef}
        style={composedStyle}
        className={cn(
          'focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
          {
            'touch-none select-none': asHandle,
            'cursor-default': context.flatCursor,
            'data-dragging:cursor-grabbing': !context.flatCursor,
            'cursor-grab': !isDragging && asHandle && !context.flatCursor,
            'opacity-50': isDragging,
            'pointer-events-none opacity-50': disabled,
          },
          className
        )}
      />
    </KanbanItemContext.Provider>
  );
});
KanbanItem.displayName = ITEM_NAME;

/** KanbanItemHandle component props */
export interface KanbanItemHandleProps extends React.ComponentPropsWithoutRef<'button'> {
  /** Render as child element */
  asChild?: boolean;
}

/** KanbanItemHandle component - drag handle for items */
const KanbanItemHandle = React.forwardRef<HTMLButtonElement, KanbanItemHandleProps>(
  (props, forwardedRef) => {
    const { asChild, disabled, className, ...itemHandleProps } = props;

    const context = useKanbanContext(ITEM_HANDLE_NAME);
    const itemContext = useKanbanItemContext(ITEM_HANDLE_NAME);

    const isDisabled = disabled ?? itemContext.disabled;

    const composedRef = useComposedRefs(forwardedRef, (node) => {
      if (isDisabled) return;
      itemContext.setActivatorNodeRef(node);
    });

    const HandlePrimitive = asChild ? Slot : 'button';

    return (
      <HandlePrimitive
        type="button"
        aria-controls={itemContext.id}
        data-disabled={isDisabled}
        data-dragging={itemContext.isDragging ? '' : undefined}
        data-slot="kanban-item-handle"
        data-testid="kanban-item-handle"
        {...itemHandleProps}
        {...(isDisabled ? {} : itemContext.attributes)}
        {...(isDisabled ? {} : itemContext.listeners)}
        ref={composedRef}
        className={cn(
          'select-none disabled:pointer-events-none disabled:opacity-50',
          context.flatCursor ? 'cursor-default' : 'cursor-grab data-dragging:cursor-grabbing',
          className
        )}
        disabled={isDisabled}
      />
    );
  }
);
KanbanItemHandle.displayName = ITEM_HANDLE_NAME;

/** Kanban overlay context for internal use */
const KanbanOverlayContext = React.createContext(false);
KanbanOverlayContext.displayName = OVERLAY_NAME;

/** Drop animation configuration */
const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
};

/** KanbanOverlay component props */
export interface KanbanOverlayProps extends Omit<
  React.ComponentPropsWithoutRef<typeof DragOverlay>,
  'children'
> {
  /** Container element for portal */
  container?: Element | DocumentFragment | null;
  /** Render function or static content for overlay */
  children?:
    | ((params: { value: UniqueIdentifier; variant: 'column' | 'item' }) => React.ReactNode)
    | React.ReactNode;
}

/** KanbanOverlay component - drag preview overlay */
function KanbanOverlay(props: KanbanOverlayProps) {
  const { container: containerProp, children, ...overlayProps } = props;

  const context = useKanbanContext(OVERLAY_NAME);

  const [mounted, setMounted] = React.useState(false);
  React.useLayoutEffect(() => setMounted(true), []);

  const container = containerProp ?? (mounted ? globalThis.document?.body : null);

  if (!container) return null;

  const variant = context.activeId && context.activeId in context.items ? 'column' : 'item';

  return ReactDOM.createPortal(
    <DragOverlay
      dropAnimation={dropAnimation}
      modifiers={context.modifiers}
      className={cn(!context.flatCursor && 'cursor-grabbing')}
      {...overlayProps}
    >
      <KanbanOverlayContext.Provider value={true}>
        {context.activeId && children
          ? typeof children === 'function'
            ? children({
                value: context.activeId,
                variant,
              })
            : children
          : null}
      </KanbanOverlayContext.Provider>
    </DragOverlay>,
    container
  );
}

export {
  KanbanRoot as Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  //
  KanbanRoot as Root,
  KanbanBoard as Board,
  KanbanColumn as Column,
  KanbanColumnHandle as ColumnHandle,
  KanbanItem as Item,
  KanbanItemHandle as ItemHandle,
  KanbanOverlay as Overlay,
};
