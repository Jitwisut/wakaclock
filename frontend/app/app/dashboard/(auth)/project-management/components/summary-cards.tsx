import { Award, Briefcase, DollarSign, FileClock } from 'lucide-react';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function SummaryCards() {
  return (
    <div className="*:data-[slot=card]:from-primary/10 grid gap-4 *:data-[slot=card]:bg-gradient-to-t md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Revenue</CardTitle>
          <CardDescription>
            <span className="text-green-600">+20.1% </span>from last month
          </CardDescription>
          <CardAction>
            <DollarSign className="text-muted-foreground/50 size-4 lg:size-6" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="font-display text-2xl lg:text-3xl">$45,231.89</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
          <CardDescription>
            <span className="text-green-600">+5.02%</span> from last month
          </CardDescription>
          <CardAction>
            <Briefcase className="text-muted-foreground/50 size-4 lg:size-6" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="font-display text-2xl lg:text-3xl">1.423</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>New Leads</CardTitle>
          <CardDescription>
            <span className="text-red-600">-3.58%</span> from last month
          </CardDescription>
          <CardAction>
            <Award className="text-muted-foreground/50 size-4 lg:size-6" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="font-display text-2xl lg:text-3xl">3.500</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Time Spent</CardTitle>
          <CardDescription>
            <span className="text-red-600">-3.58%</span> from last month
          </CardDescription>
          <CardAction>
            <FileClock className="text-muted-foreground/50 size-4 lg:size-6" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="font-display text-2xl lg:text-3xl">168h 40m</div>
        </CardContent>
      </Card>
    </div>
  );
}
