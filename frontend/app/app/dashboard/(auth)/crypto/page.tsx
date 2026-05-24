import {
  BalanceSummeryChart,
  DigitalWallets,
  OverviewCard,
  RecentActivities,
  TradingCard,
} from '@/app/dashboard/(auth)/crypto/components';
import { Button } from '@/components/ui/button';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Crypto Admin Dashboard',
    description:
      'The crypto admin dashboard is a template for effectively tracking cryptocurrency prices, market trends and portfolio performance. Built with shadcn/ui.',
    canonical: '/crypto',
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Crypto Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button>Download</Button>
        </div>
      </div>
      <div className="space-y-4">
        <div className="gap-4 space-y-4 lg:grid lg:grid-cols-6 lg:space-y-0">
          <div className="lg:col-span-12 xl:col-span-2">
            <OverviewCard />
          </div>
          <div className="lg:col-span-6 xl:col-span-2">
            <DigitalWallets />
          </div>
          <div className="lg:col-span-6 xl:col-span-2">
            <TradingCard />
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <RecentActivities />
          </div>
          <div className="xl:col-span-2">
            <BalanceSummeryChart />
          </div>
        </div>
      </div>
    </div>
  );
}
