import { Download } from 'lucide-react';

import {
  ChatWidget,
  ExerciseMinutes,
  LatestPayments,
  PaymentMethodCard,
  SubscriptionsCard,
  TeamMembersCard,
  TotalRevenueCard,
} from '@/app/dashboard/(auth)/default/components';
import { CalendarDateRangePicker as CustomDateRangePicker } from '@/components/custom-date-range-picker';
import { Button } from '@/components/ui/button';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Admin Dashboard',
    description:
      'The admin dashboard template offers a sleek and efficient interface for monitoring important data and user interactions. Built with shadcn/ui.',
    canonical: '/default',
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <CustomDateRangePicker />
          <Button>
            <Download />
            <span className="hidden lg:inline">Download</span>
          </Button>
        </div>
      </div>
      <div className="gap-4 space-y-4 lg:grid lg:grid-cols-3 lg:space-y-0">
        <TeamMembersCard />
        <SubscriptionsCard />
        <TotalRevenueCard />
        <ChatWidget />
        <div className="lg:col-span-2">
          <ExerciseMinutes />
        </div>
        <div className="lg:col-span-2">
          <LatestPayments />
        </div>
        <PaymentMethodCard />
      </div>
    </div>
  );
}
