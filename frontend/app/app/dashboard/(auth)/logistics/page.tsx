import { AlertCircleIcon } from 'lucide-react';

import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Logistics Admin Dashboard',
    description:
      'On the hotel admin dashboard, you can see your turnover, manage reservations, and view your customers. Built with shadcn/ui, Tailwind CSS, Next.js.',
    canonical: '/logistics',
  });
}

export default function Page() {
  return (
    <div className="flex h-[90vh] items-center justify-center text-center">
      <div className="max-w-(--breakpoint-sm) space-y-4 lg:space-y-8">
        <h1 className="flex items-center justify-center text-3xl font-bold tracking-tight lg:text-4xl">
          <svg
            className="mr-5 h-9 w-9 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              fill="currentColor"
            />
          </svg>
          Logistics Dashboard
        </h1>
        <div className="lg:text-lg">Logistics admin dashboard template coming soon.</div>
        <div className="text-muted-foreground flex items-center justify-center gap-2">
          <AlertCircleIcon className="h-4 w-4 text-orange-400" />
          This page is currently under construction.
        </div>
      </div>
    </div>
  );
}
