import { generateMeta } from '@/lib/utils';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: 'E-commerce Widgets',
    description:
      'UI components that show ecommerce metrics such as sales, revenue, orders, and customer activity within a dashboard. Built with shadcn/ui, Tailwind CSS, Next.js.',
    canonical: '/widgets/ecommerce',
  });
}

export default function Page() {
  return <div className="text-muted-foreground ps-2 text-sm">Coming soon...</div>;
}
