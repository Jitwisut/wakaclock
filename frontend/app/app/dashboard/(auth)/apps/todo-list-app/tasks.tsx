'use client';

import React from 'react';

import AddTodoSheet from '@/app/dashboard/(auth)/apps/todo-list-app/components/add-todo-sheet';
import TodoDetailSheet from '@/app/dashboard/(auth)/apps/todo-list-app/components/todo-detail-sheet';
import TodoList from '@/app/dashboard/(auth)/apps/todo-list-app/components/todo-list';
import { TodoStoreProvider, useTodoStore } from '@/app/dashboard/(auth)/apps/todo-list-app/store';
import type { Todo } from '@/app/dashboard/(auth)/apps/todo-list-app/types';

function TasksContent() {
  const {
    activeTab,
    isAddDialogOpen,
    setAddDialogOpen,
    isTodoSheetOpen,
    setTodoSheetOpen,
    selectedTodoId,
    setSelectedTodoId,
  } = useTodoStore();

  // Add state for managing edit mode
  const [editTodoId, setEditTodoId] = React.useState<null | string>(null);

  const handleAddTodoClick = () => {
    // Clear edit ID when adding a new todo
    setEditTodoId(null);
    setAddDialogOpen(true);
  };

  const handleEditTodoClick = (id: string) => {
    // Set the edit ID and open the add/edit sheet
    setEditTodoId(id);
    setAddDialogOpen(true);
  };

  const handleSelectTodo = (id: string) => {
    setSelectedTodoId(id);
    setTodoSheetOpen(true);
  };

  const handleCloseAddSheet = () => {
    setAddDialogOpen(false);
    setEditTodoId(null);
  };

  const handleCloseTodoSheet = () => {
    setTodoSheetOpen(false);
    setSelectedTodoId(null);
  };

  return (
    <div className="space-y-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Todo List</h1>
      </header>

      <TodoList
        activeTab={activeTab}
        onAddTodoClick={handleAddTodoClick}
        onSelectTodo={handleSelectTodo}
      />

      <AddTodoSheet
        editTodoId={editTodoId}
        isOpen={isAddDialogOpen}
        onClose={handleCloseAddSheet}
      />

      <TodoDetailSheet
        isOpen={isTodoSheetOpen}
        onClose={handleCloseTodoSheet}
        onEditClick={(id) => {
          handleCloseTodoSheet();
          handleEditTodoClick(id);
        }}
        todoId={selectedTodoId}
      />
    </div>
  );
}

export default function Tasks({ tasks }: { tasks: Todo[] }) {
  return (
    <TodoStoreProvider todos={tasks}>
      <TasksContent />
    </TodoStoreProvider>
  );
}
