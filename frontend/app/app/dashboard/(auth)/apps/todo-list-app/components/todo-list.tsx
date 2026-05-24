import React from 'react';

import {
  closestCenter,
  DndContext,
  type DragCancelEvent,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { GridIcon, ListIcon, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';

import StatusTabs from '@/app/dashboard/(auth)/apps/todo-list-app/components/status-tabs';
import TodoItem from '@/app/dashboard/(auth)/apps/todo-list-app/components/todo-item';
import {
  EnumTodoPriority,
  priorityDotColors,
} from '@/app/dashboard/(auth)/apps/todo-list-app/enum';
import { useTodoStore } from '@/app/dashboard/(auth)/apps/todo-list-app/store';
import type { FilterTab, Todo, TodoStatus } from '@/app/dashboard/(auth)/apps/todo-list-app/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TodoListProps {
  activeTab: FilterTab;
  onAddTodoClick: () => void;
  onSelectTodo: (id: string) => void;
}

export default function TodoList({ activeTab, onSelectTodo, onAddTodoClick }: TodoListProps) {
  const [activeId, setActiveId] = React.useState<null | string>(null);
  const {
    todos,
    updateTodo,
    reorderTodos,
    viewMode,
    setViewMode,
    filterUser,
    setFilterUser,
    filterPriority,
    setFilterPriority,
    searchQuery,
    setSearchQuery,
    toggleStarred,
    showStarredOnly,
    toggleShowStarredOnly,
    setActiveTab,
  } = useTodoStore();
  const [, setReorderedPositions] = React.useState<{ id: string; position: number }[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
  };

  // Get unique users for the filter dropdown
  const uniqueUsers = [...new Set(todos.flatMap((todo) => todo.assignedTo))];

  // Apply all filters
  const filteredTodos = todos.filter((todo) => {
    // Tab filter
    if (activeTab !== 'all') return todo.status === activeTab;

    // User filter
    if (
      filterUser &&
      filterUser.length > 0 &&
      !filterUser.some((user) => todo.assignedTo.includes(user))
    ) {
      return false;
    }

    // Priority filter
    if (filterPriority && todo.priority !== filterPriority) return false;

    // Starred filter
    if (showStarredOnly && !todo.starred) return false;

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        todo.title.toLowerCase().includes(query) ||
        todo.description?.toLowerCase().includes(query) ||
        todo.assignedTo.some((user) => user.toLowerCase().includes(query))
      );
    }

    return true;
  });

  const handleStatusChange = (id: string, status: TodoStatus) => {
    updateTodo(id, { status });
    toast.success(`Task status changed to ${status.replace('-', ' ')}`);
  };

  const handleDragStart = (event: DragStartEvent) => {
    console.info('event.active.id', event.active.id);
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = filteredTodos.findIndex((item) => item.id === active.id);
    const newIndex = filteredTodos.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(filteredTodos, oldIndex, newIndex);

    const positions = newItems.map((item, index) => ({
      id: item.id,
      position: index,
    }));

    reorderTodos(positions);
    setReorderedPositions(positions);

    console.info('Todos after reordering:', {
      reorderedTodos: newItems.map((todo) => ({
        id: todo.id,
        title: todo.title,
        position: positions.find((p) => p.id === todo.id)?.position,
      })),
    });

    toast.success('The to-do items have been reordered successfully.');
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveId(null);
  };

  const handleUserFilterChange = (user: string, checked: boolean) => {
    if (!filterUser) {
      setFilterUser(checked ? [user] : null);
    } else {
      const newUsers = checked ? [...filterUser, user] : filterUser.filter((u) => u !== user);

      setFilterUser(newUsers.length > 0 ? newUsers : null);
    }
  };

  const clearFilters = () => {
    setFilterUser(null);
    setFilterPriority(null);
    setSearchQuery('');
    if (showStarredOnly) {
      toggleShowStarredOnly();
    }
  };

  const handleStarToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleStarred(id);
  };

  const renderFilterContent = () => (
    <div className="space-y-6 p-4">
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Assigned Users</h4>
        <div className="flex flex-wrap gap-2">
          {uniqueUsers.map((user) => (
            <Toggle
              className="px-3 text-xs"
              key={user}
              onPressedChange={(pressed) => handleUserFilterChange(user, pressed)}
              pressed={filterUser?.includes(user) || false}
              size="sm"
              variant="outline"
            >
              {user}
            </Toggle>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox checked={showStarredOnly} id="starred" onCheckedChange={toggleShowStarredOnly} />
        <Label htmlFor="starred">Show starred only</Label>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Priority</h4>
        <div className="flex gap-2 *:grow">
          {Object.values(EnumTodoPriority).map((priority) => (
            <Toggle
              className="px-3 text-xs capitalize"
              key={priority}
              onPressedChange={() => setFilterPriority(priority)}
              pressed={filterPriority?.includes(priority) || false}
              size="sm"
              variant="outline"
            >
              <span className={cn('size-2 rounded-full', priorityDotColors[priority])} />
              {priority}
            </Toggle>
          ))}
        </div>

        {(filterUser || filterPriority || showStarredOnly) && (
          <div className="text-end">
            <Button className="px-0!" onClick={clearFilters} size="sm" variant="link">
              Clear Filters
              <X />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const items = todos.map((v) => v.id);

  const renderTodoItems = () => {
    if (viewMode === 'grid') {
      return (
        <DndContext
          collisionDetection={closestCenter}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          sensors={sensors}
        >
          <SortableContext items={items} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  onClick={() => onSelectTodo(todo.id)}
                  onStarToggle={handleStarToggle}
                  onStatusChange={handleStatusChange}
                  todo={todo}
                  viewMode="grid"
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <TodoItem
                isDraggingOverlay
                todo={filteredTodos.find((t) => t.id === activeId) as Todo}
                viewMode="grid"
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      );
    }

    // List view with drag and drop
    return (
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SortableContext items={items} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 space-y-4">
            {filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                onClick={() => onSelectTodo(todo.id)}
                onStarToggle={handleStarToggle}
                onStatusChange={handleStatusChange}
                todo={todo}
                viewMode="list"
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <TodoItem
              isDraggingOverlay
              todo={filteredTodos.find((t) => t.id === activeId) as Todo}
              viewMode="list"
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  return (
    <>
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <StatusTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="flex w-full items-center gap-2 lg:w-auto">
          {/* Search input */}
          <div className="relative w-auto">
            <Search className="absolute top-2.5 left-3 size-4 opacity-50" />
            <Input
              className="ps-10"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              value={searchQuery}
            />
          </div>

          {/* Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="relative" size="icon" variant="outline">
                <SlidersHorizontal />
                {(filterUser || filterPriority || showStarredOnly) && (
                  <Badge
                    className="absolute -end-1.5 -top-1.5 size-4 rounded-full p-0"
                    variant="secondary"
                  >
                    {(filterUser ? 1 : 0) + (filterPriority ? 1 : 0) + (showStarredOnly ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              {renderFilterContent()}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode toggle */}
          <ToggleGroup
            onValueChange={(value) => value && setViewMode(value as 'grid' | 'list')}
            type="single"
            value={viewMode}
            variant="outline"
          >
            <ToggleGroupItem aria-label="List view" value="list">
              <ListIcon />
            </ToggleGroupItem>
            <ToggleGroupItem aria-label="Grid view" value="grid">
              <GridIcon />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Add button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="fixed end-6 bottom-6 z-10 rounded-full! md:size-14"
                  onClick={onAddTodoClick}
                  size="icon"
                >
                  <Plus className="md:size-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Add To-Do</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {filteredTodos.length === 0 ? (
        <div className="flex h-[calc(100vh-12rem)] flex-col items-center justify-center py-12 text-center">
          <h3 className="text-xl font-medium">No tasks found</h3>
          <p className="text-muted-foreground mt-2">Add a new task to get started</p>
        </div>
      ) : (
        renderTodoItems()
      )}
    </>
  );
}
