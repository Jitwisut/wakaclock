import { generateMeta } from '@/lib/utils';

import CreateProjectEmptyState from './components/create-project-empty-state';

export async function generateMetadata() {
  return generateMeta({
    title: 'Empty States 02',
    description:
      'Empty states show placeholder content when no data is available. Built with shadcn/ui, Tailwind CSS, Next.js and React.',
    canonical: '/empty-states/02',
  });
}

export default function Page() {
  return <CreateProjectEmptyState />;
}
