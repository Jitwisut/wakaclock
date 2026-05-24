import { Droplet, Flame, Footprints, MoreHorizontal, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';

const days = [
  { day: 'Mon', date: '17', active: true },
  { day: 'Tue', date: '18', active: false },
  { day: 'Wed', date: '19', active: false },
  { day: 'Thu', date: '20', active: false },
  { day: 'Fri', date: '21', active: false },
  { day: 'Sat', date: '22', active: false },
  { day: 'Sun', date: '23', active: false },
];

const activities = [
  {
    icon: Footprints,
    label: 'Steps',
    current: 22_000,
    target: 22_000,
    status: 'Completed',
    percentage: 100,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-950',
  },
  {
    icon: Flame,
    label: 'Calories',
    current: 1420,
    target: 1680,
    status: 'In Progress',
    percentage: 85,
    color: 'bg-pink-500',
    bgColor: 'bg-pink-100  dark:bg-pink-950',
  },
  {
    icon: Droplet,
    label: 'Water',
    current: 2.2,
    target: 3,
    unit: 'L',
    status: 'In Progress',
    percentage: 50,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100  dark:bg-blue-950',
  },
  {
    icon: Sparkles,
    label: 'Meditation',
    current: 0,
    target: 15,
    unit: 'min',
    status: 'Pending',
    percentage: 72,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-100  dark:bg-purple-950',
  },
];

export function DailyActivityCard() {
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle className="text-xl">Daily Activity</CardTitle>
        <CardDescription>Mon 17 — Sun 23</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-24">
              <DropdownMenuGroup>
                <DropdownMenuItem>Close</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {days.map((day) => (
            <button
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-3 transition-colors ${
                day.active ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-secondary/80'
              }`}
              key={day.date}
            >
              <span className="text-xs font-medium">{day.day}</span>
              <span className="text-sm font-semibold">{day.date}</span>
            </button>
          ))}
        </div>
      </CardContent>
      <div className="divide-y border-t">
        {activities.map((activity) => (
          <div className="p-4 px-6" key={activity.label}>
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`${activity.bgColor} rounded-xl p-2`}>
                  <activity.icon className="text-muted-foreground size-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">{activity.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {activity.current} / {activity.target} {activity.unit || ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground mb-2 text-xs">{activity.status}</p>
                <p className="text-muted-foreground text-sm">{activity.percentage}%</p>
              </div>
            </div>
            <Progress indicatorColor={activity.color} value={activity.percentage} />
          </div>
        ))}
      </div>
    </Card>
  );
}
