'use client';

import * as React from 'react';

import { v4 as uuidv4 } from 'uuid';

import type {
  FilterTab,
  Todo,
  TodoFile,
  TodoPriority,
  ViewMode,
} from '@/app/dashboard/(auth)/apps/todo-list-app/types';

interface TodoStore {
  activeTab: FilterTab;
  addComment: (todoId: string, text: string) => void;
  addFile: (todoId: string, file: Omit<TodoFile, 'id'>) => void;
  addSubTask: (todoId: string, title: string) => void;
  addTodo: (
    todo: Omit<
      Todo,
      'comments' | 'createdAt' | 'files' | 'id' | 'reminderDate' | 'starred' | 'subTasks'
    >
  ) => void;
  deleteComment: (todoId: string, commentId: string) => void;
  deleteTodo: (id: string) => void;
  filterPriority: null | TodoPriority;
  filterUser: null | string[];
  isAddDialogOpen: boolean;

  isTodoSheetOpen: boolean;
  removeFile: (todoId: string, fileId: string) => void;
  removeSubTask: (todoId: string, subTaskId: string) => void;
  reorderTodos: (todoPositions: { id: string; position: number }[]) => void;
  searchQuery: string;
  selectedTodoId: null | string;
  setActiveTab: (tab: FilterTab) => void;
  setAddDialogOpen: (isOpen: boolean) => void;
  setFilterPriority: (priority: null | TodoPriority) => void;
  setFilterUser: (users: null | string[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTodoId: (id: null | string) => void;
  // Actions
  setTodos: (todos: Todo[]) => void;
  setTodoSheetOpen: (isOpen: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  showStarredOnly: boolean; // New field for starred filter
  todos: Todo[];
  toggleShowStarredOnly: () => void; // New action for toggling starred filter
  toggleStarred: (todoId: string) => void;
  updateSubTask: (todoId: string, subTaskId: string, completed: boolean) => void;
  updateTodo: (id: string, updatedTodo: Partial<Omit<Todo, 'id'>>) => void;
  viewMode: ViewMode;
}

type TodoState = Pick<
  TodoStore,
  | 'activeTab'
  | 'filterPriority'
  | 'filterUser'
  | 'isAddDialogOpen'
  | 'isTodoSheetOpen'
  | 'searchQuery'
  | 'selectedTodoId'
  | 'showStarredOnly'
  | 'todos'
  | 'viewMode'
>;

type TodoAction =
  | { commentId: string; todoId: string; type: 'deleteComment' }
  | { completed: boolean; subTaskId: string; todoId: string; type: 'updateSubTask' }
  | { file: Omit<TodoFile, 'id'>; todoId: string; type: 'addFile' }
  | { fileId: string; todoId: string; type: 'removeFile' }
  | { id: null | string; type: 'setSelectedTodoId' }
  | { id: string; type: 'deleteTodo' }
  | { id: string; type: 'updateTodo'; updatedTodo: Partial<Omit<Todo, 'id'>> }
  | { isOpen: boolean; type: 'setAddDialogOpen' }
  | { isOpen: boolean; type: 'setTodoSheetOpen' }
  | { mode: ViewMode; type: 'setViewMode' }
  | { priority: null | TodoPriority; type: 'setFilterPriority' }
  | { query: string; type: 'setSearchQuery' }
  | { subTaskId: string; todoId: string; type: 'removeSubTask' }
  | { tab: FilterTab; type: 'setActiveTab' }
  | { text: string; todoId: string; type: 'addComment' }
  | { title: string; todoId: string; type: 'addSubTask' }
  | {
      todo: Omit<
        Todo,
        'comments' | 'createdAt' | 'files' | 'id' | 'reminderDate' | 'starred' | 'subTasks'
      >;
      type: 'addTodo';
    }
  | { todoId: string; type: 'toggleStarred' }
  | { todoPositions: { id: string; position: number }[]; type: 'reorderTodos' }
  | { todos: Todo[]; type: 'setTodos' }
  | { type: 'setFilterUser'; users: null | string[] }
  | { type: 'toggleShowStarredOnly' };

const initialState: TodoState = {
  todos: [],
  selectedTodoId: null,
  activeTab: 'all',
  isAddDialogOpen: false,
  isTodoSheetOpen: false,
  viewMode: 'list',
  filterUser: null,
  filterPriority: null,
  showStarredOnly: false,
  searchQuery: '',
};

function reducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'setTodos': {
      return {
        ...state,
        todos: action.todos,
      };
    }
    case 'addTodo': {
      return {
        ...state,
        todos: [
          ...state.todos,
          {
            ...action.todo,
            id: uuidv4(),
            createdAt: new Date(),
            comments: [],
            files: [],
            subTasks: [],
            starred: false,
          },
        ],
      };
    }
    case 'updateTodo': {
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.id ? { ...todo, ...action.updatedTodo } : todo
        ),
      };
    }
    case 'deleteTodo': {
      return {
        ...state,
        todos: state.todos.filter((todo) => todo.id !== action.id),
      };
    }
    case 'setSelectedTodoId': {
      return {
        ...state,
        selectedTodoId: action.id,
      };
    }
    case 'setActiveTab': {
      return {
        ...state,
        activeTab: action.tab,
      };
    }
    case 'setAddDialogOpen': {
      return {
        ...state,
        isAddDialogOpen: action.isOpen,
      };
    }
    case 'setTodoSheetOpen': {
      return {
        ...state,
        isTodoSheetOpen: action.isOpen,
      };
    }
    case 'addComment': {
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.todoId
            ? {
                ...todo,
                comments: [
                  ...todo.comments,
                  {
                    id: uuidv4(),
                    text: action.text,
                    createdAt: new Date(),
                  },
                ],
              }
            : todo
        ),
      };
    }
    case 'deleteComment': {
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.todoId
            ? {
                ...todo,
                comments: todo.comments.filter((comment) => comment.id !== action.commentId),
              }
            : todo
        ),
      };
    }
    case 'reorderTodos': {
      const reorderedTodos = [...state.todos];

      action.todoPositions.forEach(({ id, position }) => {
        const todoIndex = reorderedTodos.findIndex((todo) => todo.id === id);
        if (todoIndex !== -1) {
          const [todo] = reorderedTodos.splice(todoIndex, 1);
          reorderedTodos.splice(position, 0, todo);
        }
      });

      return {
        ...state,
        todos: reorderedTodos,
      };
    }
    case 'setViewMode': {
      return {
        ...state,
        viewMode: action.mode,
      };
    }
    case 'setFilterUser': {
      return {
        ...state,
        filterUser: action.users,
      };
    }
    case 'setFilterPriority': {
      return {
        ...state,
        filterPriority: action.priority,
      };
    }
    case 'setSearchQuery': {
      return {
        ...state,
        searchQuery: action.query,
      };
    }
    case 'toggleShowStarredOnly': {
      return {
        ...state,
        showStarredOnly: !state.showStarredOnly,
      };
    }
    case 'addFile': {
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.todoId
            ? {
                ...todo,
                files: [
                  ...(todo.files || []),
                  {
                    ...action.file,
                    id: uuidv4(),
                  },
                ],
              }
            : todo
        ),
      };
    }
    case 'removeFile': {
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.todoId
            ? {
                ...todo,
                files: (todo.files || []).filter((file) => file.id !== action.fileId),
              }
            : todo
        ),
      };
    }
    case 'addSubTask': {
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.todoId
            ? {
                ...todo,
                subTasks: [
                  ...(todo.subTasks || []),
                  {
                    id: uuidv4(),
                    title: action.title,
                    completed: false,
                  },
                ],
              }
            : todo
        ),
      };
    }
    case 'updateSubTask': {
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.todoId
            ? {
                ...todo,
                subTasks: (todo.subTasks || []).map((subTask) =>
                  subTask.id === action.subTaskId
                    ? { ...subTask, completed: action.completed }
                    : subTask
                ),
              }
            : todo
        ),
      };
    }
    case 'removeSubTask': {
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.todoId
            ? {
                ...todo,
                subTasks: (todo.subTasks || []).filter(
                  (subTask) => subTask.id !== action.subTaskId
                ),
              }
            : todo
        ),
      };
    }
    case 'toggleStarred': {
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.todoId ? { ...todo, starred: !todo.starred } : todo
        ),
      };
    }
    default: {
      return state;
    }
  }
}

const TodoStoreContext = React.createContext<TodoStore | undefined>(undefined);

export function TodoStoreProvider({
  children,
  todos,
}: {
  children: React.ReactNode;
  todos: Todo[];
}) {
  const [state, dispatch] = React.useReducer(reducer, initialState, (base) => ({
    ...base,
    todos,
  }));

  React.useEffect(() => {
    dispatch({ type: 'setTodos', todos });
  }, [todos]);

  const setTodos = React.useCallback((nextTodos: Todo[]) => {
    dispatch({ type: 'setTodos', todos: nextTodos });
  }, []);

  const addTodo = React.useCallback<TodoStore['addTodo']>((todo) => {
    dispatch({ type: 'addTodo', todo });
  }, []);

  const updateTodo = React.useCallback<TodoStore['updateTodo']>((id, updatedTodo) => {
    dispatch({ type: 'updateTodo', id, updatedTodo });
  }, []);

  const deleteTodo = React.useCallback<TodoStore['deleteTodo']>((id) => {
    dispatch({ type: 'deleteTodo', id });
  }, []);

  const setSelectedTodoId = React.useCallback<TodoStore['setSelectedTodoId']>((id) => {
    dispatch({ type: 'setSelectedTodoId', id });
  }, []);

  const setActiveTab = React.useCallback<TodoStore['setActiveTab']>((tab) => {
    dispatch({ type: 'setActiveTab', tab });
  }, []);

  const setAddDialogOpen = React.useCallback<TodoStore['setAddDialogOpen']>((isOpen) => {
    dispatch({ type: 'setAddDialogOpen', isOpen });
  }, []);

  const setTodoSheetOpen = React.useCallback<TodoStore['setTodoSheetOpen']>((isOpen) => {
    dispatch({ type: 'setTodoSheetOpen', isOpen });
  }, []);

  const addComment = React.useCallback<TodoStore['addComment']>((todoId, text) => {
    dispatch({ type: 'addComment', todoId, text });
  }, []);

  const deleteComment = React.useCallback<TodoStore['deleteComment']>((todoId, commentId) => {
    dispatch({ type: 'deleteComment', todoId, commentId });
  }, []);

  const reorderTodos = React.useCallback<TodoStore['reorderTodos']>((todoPositions) => {
    dispatch({ type: 'reorderTodos', todoPositions });
  }, []);

  const setViewMode = React.useCallback<TodoStore['setViewMode']>((mode) => {
    dispatch({ type: 'setViewMode', mode });
  }, []);

  const setFilterUser = React.useCallback<TodoStore['setFilterUser']>((users) => {
    dispatch({ type: 'setFilterUser', users });
  }, []);

  const setFilterPriority = React.useCallback<TodoStore['setFilterPriority']>((priority) => {
    dispatch({ type: 'setFilterPriority', priority });
  }, []);

  const setSearchQuery = React.useCallback<TodoStore['setSearchQuery']>((query) => {
    dispatch({ type: 'setSearchQuery', query });
  }, []);

  const toggleShowStarredOnly = React.useCallback<TodoStore['toggleShowStarredOnly']>(() => {
    dispatch({ type: 'toggleShowStarredOnly' });
  }, []);

  const addFile = React.useCallback<TodoStore['addFile']>((todoId, file) => {
    dispatch({ type: 'addFile', todoId, file });
  }, []);

  const removeFile = React.useCallback<TodoStore['removeFile']>((todoId, fileId) => {
    dispatch({ type: 'removeFile', todoId, fileId });
  }, []);

  const addSubTask = React.useCallback<TodoStore['addSubTask']>((todoId, title) => {
    dispatch({ type: 'addSubTask', todoId, title });
  }, []);

  const updateSubTask = React.useCallback<TodoStore['updateSubTask']>(
    (todoId, subTaskId, completed) => {
      dispatch({ type: 'updateSubTask', todoId, subTaskId, completed });
    },
    []
  );

  const removeSubTask = React.useCallback<TodoStore['removeSubTask']>((todoId, subTaskId) => {
    dispatch({ type: 'removeSubTask', todoId, subTaskId });
  }, []);

  const toggleStarred = React.useCallback<TodoStore['toggleStarred']>((todoId) => {
    dispatch({ type: 'toggleStarred', todoId });
  }, []);

  const value = React.useMemo<TodoStore>(
    () => ({
      ...state,
      setTodos,
      addTodo,
      updateTodo,
      deleteTodo,
      setSelectedTodoId,
      setActiveTab,
      setAddDialogOpen,
      setTodoSheetOpen,
      addComment,
      deleteComment,
      reorderTodos,
      setViewMode,
      setFilterUser,
      setFilterPriority,
      setSearchQuery,
      toggleShowStarredOnly,
      addFile,
      removeFile,
      addSubTask,
      updateSubTask,
      removeSubTask,
      toggleStarred,
    }),
    [
      state,
      setTodos,
      addTodo,
      updateTodo,
      deleteTodo,
      setSelectedTodoId,
      setActiveTab,
      setAddDialogOpen,
      setTodoSheetOpen,
      addComment,
      deleteComment,
      reorderTodos,
      setViewMode,
      setFilterUser,
      setFilterPriority,
      setSearchQuery,
      toggleShowStarredOnly,
      addFile,
      removeFile,
      addSubTask,
      updateSubTask,
      removeSubTask,
      toggleStarred,
    ]
  );

  return React.createElement(TodoStoreContext.Provider, { value }, children);
}

export function useTodoStore(): TodoStore {
  const store = React.useContext(TodoStoreContext);
  if (!store) {
    throw new Error('useTodoStore must be used within a TodoStoreProvider');
  }
  return store;
}
