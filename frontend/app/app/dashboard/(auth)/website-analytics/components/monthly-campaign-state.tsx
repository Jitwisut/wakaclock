import { Icon } from '@/components/icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const data = {
  title: 'Monthly Campaign State',
  metrics: [
    {
      name: 'Emails',
      value: 1.503,
      percentage: -0.3,
      icon: 'Mail',
    },
    {
      name: 'Opened',
      value: 6.043,
      percentage: 2.1,
      icon: 'Eye',
    },
    {
      name: 'Clicked',
      value: 600,
      percentage: -2.1,
      icon: 'MousePointer',
    },
    {
      name: 'Subscribe',
      value: 490,
      percentage: 8.5,
      icon: 'UserPlus',
    },
    {
      name: 'Complaints',
      value: 490,
      percentage: 4.5,
      icon: 'CircleAlert',
    },
    {
      name: 'Unsubscribe',
      value: 1.2,
      percentage: -0.5,
      icon: 'UserMinus',
    },
  ],
};

export function MonthlyCampaignStateCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
        <CardDescription>8.5K social visitors</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {data.metrics.map((metric) => (
            <div className="flex items-center" key={metric.name}>
              <div className="bg-muted flex size-10 items-center justify-center rounded-md border">
                <Icon className="size-4" name={metric.icon} />
              </div>
              <div className="ml-4">
                <p>{metric.name}</p>
              </div>
              <div className="ml-auto flex items-center justify-between space-x-3">
                <span className="text-sm">{metric.value}</span>
                <div className="w-14 text-end">
                  <Badge
                    className={cn({
                      'text-green-600': metric.percentage >= 0,
                      'text-red-600': metric.percentage < 0,
                    })}
                    variant="outline"
                  >
                    {metric.percentage}%
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
