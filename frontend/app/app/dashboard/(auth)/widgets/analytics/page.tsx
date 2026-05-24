import { generateMeta } from '@/lib/utils';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: 'Analytic Widgets',
    description:
      'Interactive components that display key metrics, charts, and insights within a dashboard interface. Built with shadcn/ui, Tailwind CSS, Next.js.',
    canonical: '/widgets/analytics',
  });
}
export default function Page() {
  return <div className="text-muted-foreground ps-2 text-sm">Coming soon...</div>;
}
