import { promises as fs } from 'fs';
import path from 'path';

import { z } from 'zod';

import { generateMeta } from '@/lib/utils';

import { columns } from './components/columns';
import { DataTable } from './components/data-table';
import { taskSchema } from './data/schema';

export async function generateMetadata() {
  return generateMeta({
    title: 'Tasks',
    description: 'A task and issue tracker build using Tanstack Table.',
    canonical: '/apps/tasks',
  });
}

// Simulate a database read for tasks.
async function getTasks() {
  const data = await fs.readFile(
    path.join(process.cwd(), 'app/dashboard/(auth)/apps/tasks/data/tasks.json')
  );

  const tasks = JSON.parse(data.toString());

  return z.array(taskSchema).parse(tasks);
}

export default async function TaskPage() {
  const tasks = await getTasks();

  return <DataTable columns={columns} data={tasks} />;
}
