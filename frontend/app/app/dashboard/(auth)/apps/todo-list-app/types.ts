import type {
  EnumTodoPriority,
  EnumTodoStatus,
} from '@/app/dashboard/(auth)/apps/todo-list-app/enum';

export type TodoPriority = `${EnumTodoPriority}`;
export type TodoStatus = `${EnumTodoStatus}`;
export type FilterTab = 'all' | TodoStatus;
export type ViewMode = 'grid' | 'list';

export interface Comment {
  createdAt: Date;
  id: string;
  text: string;
}

export interface TodoFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  url: string;
}

export interface SubTask {
  completed: boolean;
  id: string;
  title: string;
}

export interface Todo {
  assignedTo: string[];
  comments: Comment[];
  createdAt: Date;
  description?: string;
  dueDate?: Date | null;
  files?: TodoFile[];
  id: string;
  priority: TodoPriority;
  reminderDate?: Date | null; // New field for reminders
  starred: boolean;
  status: TodoStatus;
  subTasks?: SubTask[];
  title: string;
}

export interface TodoPosition {
  id: string;
  position: number;
}
