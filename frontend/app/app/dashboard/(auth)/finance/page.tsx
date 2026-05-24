import { Download } from 'lucide-react';

import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';
import { Button } from '@/components/ui/button';
import { generateMeta } from '@/lib/utils';

import KPICards from './components/kpi-cards';
import MonthlyExpenses from './components/monthly-expenses';
import CreditCards from './components/my-wallet';
import Revenue from './components/revenue';
import SavingGoal from './components/saving-goal';
import Summary from './components/summary';
import Transactions from './components/transactions';

export async function generateMetadata() {
  return generateMeta({
    title: 'Finance Admin Dashboard',
    description:
      'A finance dashboard is an admin panel that visualizes key financial data such as income, expenses, cash flow, budget, and profit. Built with shadcn/ui, Tailwind CSS, Next.js.',
    canonical: '/finance',
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Finance Dashboard</h1>
        <div className="flex items-center space-x-2">
          <CalendarDateRangePicker />
          <Button size="icon">
            <Download />
          </Button>
        </div>
      </div>

      <KPICards />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Revenue />
        <MonthlyExpenses />
        <Summary />
      </div>

      <div className="grid-cols-2 gap-4 space-y-4 lg:grid lg:space-y-0">
        <Transactions />
        <div className="space-y-4">
          <SavingGoal />
          <CreditCards />
        </div>
      </div>
    </div>
  );
}
