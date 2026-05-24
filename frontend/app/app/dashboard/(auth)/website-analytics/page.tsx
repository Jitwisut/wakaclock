import {
  AverageDailySalesCard,
  EarningReportsCard,
  MonthlyCampaignStateCard,
  SaleOverviewCard,
  SalesByCountriesCard,
  TicketsCard,
  TotalEarningCard,
  WebsiteAnalyticsCard,
} from '@/app/dashboard/(auth)/website-analytics/components';
import StatCards from '@/app/dashboard/(auth)/website-analytics/components/stat-cards';
import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';
import { Button } from '@/components/ui/button';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Website Analytics Admin Dashboard',
    description:
      'Website analytics admin dashboard template offers an efficient and flexible tool that allows to track websites traffic data, user interactions and performance analytics in detail with a modern, user-friendly and responsive interface.',
    canonical: '/website-analytics',
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Website Analytics</h1>
        <div className="flex items-center space-x-2">
          <div className="grow">
            <CalendarDateRangePicker />
          </div>
          <Button>Download</Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <StatCards />
        </div>
        <div className="lg:col-span-12 xl:col-span-8">
          <EarningReportsCard />
        </div>
        <div className="lg:col-span-12 xl:col-span-4">
          <TicketsCard />
        </div>
        <div className="lg:col-span-4">
          <WebsiteAnalyticsCard />
        </div>
        <div className="lg:col-span-4">
          <AverageDailySalesCard />
        </div>
        <div className="lg:col-span-4">
          <SaleOverviewCard />
        </div>
        <div className="lg:col-span-4">
          <SalesByCountriesCard />
        </div>
        <div className="lg:col-span-4">
          <TotalEarningCard />
        </div>
        <div className="lg:col-span-4">
          <MonthlyCampaignStateCard />
        </div>
      </div>
    </div>
  );
}
