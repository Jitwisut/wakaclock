import { generateMeta } from '@/lib/utils';

import KanbanBoard from './components/kanban-board';

export async function generateMetadata() {
  return generateMeta({
    title: 'Kanban Board',
    description:
      'Create a layout where you can easily manage your projects and tasks with the Kanban template. Built with shadcn/ui, React, Next.js and Tailwind CSS.',
    canonical: '/apps/kanban',
  });
}

export default function Page() {
  return <KanbanBoard />;
}
