import { CalendarCheck2Icon, CalendarClockIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function ProgressStatisticsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress Statistics</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col space-y-6">
        <div className="space-y-4 text-center">
          <div>Total Activity</div>
          <div className="font-display text-3xl lg:text-4xl">72.5%</div>
        </div>
        <div className="grid w-full gap-8 lg:grid-cols-2">
          <div className="flex items-center gap-2">
            <Progress indicatorColor="bg-orange-500" value={65} />
            <div className="text-muted-foreground text-sm">65%</div>
          </div>
          <div className="flex items-center gap-2">
            <Progress indicatorColor="bg-green-500" value={50} />
            <div className="text-muted-foreground text-sm">50%</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary flex size-10 items-center justify-center rounded-lg">
                <CalendarClockIcon className="text-primary-foreground size-4" />
              </div>
              <span className="text-2xl font-semibold">30</span>
            </div>
            <Badge className="h-auto bg-orange-500 px-4 py-2 text-sm">In Progress</Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary flex size-10 items-center justify-center rounded-lg">
                <CalendarCheck2Icon className="text-primary-foreground size-4" />
              </div>
              <span className="text-2xl font-semibold">18</span>
            </div>
            <Badge className="h-auto bg-green-500 px-4 py-2 text-sm">Completed</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
