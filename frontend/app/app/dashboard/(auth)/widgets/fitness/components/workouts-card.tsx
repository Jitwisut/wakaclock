import { Check, Dumbbell, Flower2, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const workouts = [
  {
    icon: Check,
    title: 'Morning Run',
    time: '6:30 AM',
    duration: '45 min',
    status: 'Completed',
    statusColor: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-200',
    iconBg: 'bg-green-200 dark:text-green-200 dark:bg-green-950',
  },
  {
    icon: Dumbbell,
    title: 'Strength Training',
    time: '2:00 PM',
    duration: '60 min',
    status: 'Next',
    statusColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
    iconBg: 'bg-orange-100 dark:bg-orange-900 dark:text-orange-200',
  },
  {
    icon: Flower2,
    title: 'Yoga Session',
    time: '7:00 PM',
    duration: '30 min',
    status: 'Pending',
    statusColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
    iconBg: 'bg-purple-100 dark:bg-purple-900',
  },
];

export function WorkoutsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&#39;s Workouts</CardTitle>
        <CardDescription>3 sessions planned</CardDescription>
        <CardAction>
          <Button size="icon-sm" variant="ghost">
            <Plus />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {workouts.map((workout) => (
          <div
            className="bg-muted/50 flex items-center justify-between rounded-xl p-4"
            key={workout.title}
          >
            <div className="flex items-center gap-3">
              <div className={`${workout.iconBg} rounded-xl p-3`}>
                <workout.icon className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">{workout.title}</p>
                <p className="text-muted-foreground text-xs">
                  {workout.time} • {workout.duration}
                </p>
              </div>
            </div>
            <Badge className={`${workout.statusColor} rounded-full px-3 py-1 text-xs font-medium`}>
              {workout.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
