import { Download } from 'lucide-react';

import {
  BalanceCard,
  BestSellingProducts,
  ExpenseCard,
  IncomeCard,
  RevenueChart,
  TableOrderStatus,
  TaxCard,
} from '@/app/dashboard/(auth)/sales/components';
import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';
import { Button } from '@/components/ui/button';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Sales Admin Dashboard',
    description:
      'A modern and elegant responsive sales admin Dashboard. Easily manage, analyze, and report your sales data. Built with shadcn/ui, Tailwind CSS, Next.js.',
    canonical: '/sales',
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Sales Dashboard</h1>
        <div className="flex items-center space-x-2">
          <div className="grow">
            <CalendarDateRangePicker />
          </div>
          <Button>
            <Download />
            <span className="hidden lg:inline">Download</span>
          </Button>
        </div>
      </div>
      <div className="gap-4 space-y-4 md:grid md:grid-cols-2 lg:space-y-0 xl:grid-cols-8">
        <div className="md:col-span-4">
          <RevenueChart />
        </div>
        <div className="md:col-span-4">
          <div className="col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            <BalanceCard />
            <IncomeCard />
            <ExpenseCard />
            <TaxCard />
          </div>
        </div>
      </div>
      <div className="gap-4 space-y-4 lg:space-y-0 xl:grid xl:grid-cols-3">
        <div className="xl:col-span-1">
          <BestSellingProducts />
        </div>
        <div className="xl:col-span-2">
          <TableOrderStatus />
        </div>
      </div>
    </div>
  );
}
