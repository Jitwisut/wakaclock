import { FolderPlus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Empty States 01',
    description:
      'Empty states show placeholder content when no data is available. Built with shadcn/ui, Tailwind CSS, Next.js and React.',
    canonical: '/empty-states/01',
  });
}

export default function Page() {
  return (
    <div className="flex h-[calc(100vh-var(--header-height)-3rem)] flex-col items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <FolderPlus className="text-muted-foreground mx-auto h-16 w-16" />
        <h2 className="mt-6 text-xl font-semibold">No projects</h2>
        <p className="text-muted-foreground mt-2 text-sm">Get started by creating a new project.</p>
        <div className="mt-6">
          <Button>
            <Plus />
            New Project
          </Button>
        </div>
      </div>
    </div>
  );
}
