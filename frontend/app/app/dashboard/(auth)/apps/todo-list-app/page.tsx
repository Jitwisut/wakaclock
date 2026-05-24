import { promises as fs } from 'fs';
import path from 'path';

import Tasks from '@/app/dashboard/(auth)/apps/todo-list-app/tasks';
import { generateMeta } from '@/lib/utils';

import type { Todo } from './types';

async function getTasks(): Promise<Todo[]> {
  const data = await fs.readFile(
    path.join(process.cwd(), 'app/dashboard/(auth)/apps/todo-list-app/data/tasks.json')
  );
  return JSON.parse(data.toString()) as Todo[];
}

export async function generateMetadata() {
  return generateMeta({
    title: 'Todo List App',
    description:
      'Organize your tasks, add new tasks and view task details with the to-do list app template. Built with shadcn/ui, Next.js and Tailwind CSS.',
    canonical: '/apps/todo-list-app',
  });
}

export default async function Page() {
  const tasks = await getTasks();

  return <Tasks tasks={tasks} />;
}
