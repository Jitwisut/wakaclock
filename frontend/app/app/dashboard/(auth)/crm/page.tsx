import {
  LeadBySourceCard,
  LeadsCard,
  RecentTasks,
  SalesPipeline,
  TargetCard,
  TotalCustomersCard,
  TotalDeals,
  TotalRevenueCard,
} from '@/app/dashboard/(auth)/crm/components';
import { CalendarDateRangePicker as CustomDateRangePicker } from '@/components/custom-date-range-picker';
import { Button } from '@/components/ui/button';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'CRM Admin Dashboard',
    description:
      'CRM admin dashboard template offers a streamlined and interactive interface for managing customer relationships, tracking sales, and analyzing performance metrics. Built with shadcn/ui, Tailwind CSS, Next.js.',
    canonical: '/crm',
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">CRM Dashboard</h1>
        <div className="flex items-center space-x-2">
          <CustomDateRangePicker />
          <Button>Download</Button>
        </div>
      </div>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TargetCard />
          <TotalCustomersCard />
          <TotalDeals />
          <TotalRevenueCard />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <LeadBySourceCard />
          <RecentTasks />
          <SalesPipeline />
        </div>
        <LeadsCard />
      </div>
    </div>
  );
}
