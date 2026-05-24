import { generateMeta } from '@/lib/utils';

import { BalanceOverview } from './components/balance-overview';
import { ExchangeRates } from './components/exchange-rates';
import { TransactionHistory } from './components/transaction-history';

export async function generateMetadata() {
  return generateMeta({
    title: 'Payment Admin Dashboard',
    description:
      'Payment admin dashboard is a template used to track, manage and monitor payments and transactions. Built with shadcn/ui, Tailwind CSS, Next.js and React.',
    canonical: '/payment',
  });
}

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <BalanceOverview />
        <TransactionHistory />
      </div>
      <div className="space-y-4">
        <ExchangeRates />
      </div>
    </div>
  );
}
