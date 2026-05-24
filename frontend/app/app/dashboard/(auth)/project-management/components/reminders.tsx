import { ArrowRight, CircleCheck } from 'lucide-react';

import { AddReminderDialog } from '@/app/dashboard/(auth)/project-management/components/add-reminder-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Reminder = {
  date?: string;
  id: number;
  isCompleted: boolean;
  level?: string;
  note?: string;
  type?: string;
};

const reminders: Reminder[] = [
  {
    id: 1,
    note: 'Create a design training for beginners.',
    level: 'low',
    type: 'Design Education',
    isCompleted: false,
    date: 'Today, 12:30',
  },
  {
    id: 2,
    note: 'Have a meeting with the new design team.',
    level: 'medium',
    type: 'Meeting',
    isCompleted: true,
    date: 'Today, 10:00',
  },
  {
    id: 3,
    note: 'Respond to customer support emails.',
    level: 'high',
    type: 'Customer Support',
    isCompleted: false,
    date: 'Tomorrow, 16:30',
  },
];

export function Reminders() {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle>Reminder</CardTitle>
        <CardAction>
          <AddReminderDialog />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-3">
          {reminders.map((reminder) => (
            <Card key={reminder.id}>
              <CardHeader>
                <CardTitle className="flex items-center text-base font-semibold capitalize">
                  <span
                    className={cn('d-inline me-2 size-2 rounded-full', {
                      'bg-gray-400': reminder.level === 'low',
                      'bg-orange-400': reminder.level === 'medium',
                      'bg-red-600': reminder.level === 'high',
                    })}
                  />{' '}
                  {reminder.level}{' '}
                  {reminder.isCompleted ? (
                    <CircleCheck className="ms-auto me-2 size-4 text-green-600" />
                  ) : (
                    <CircleCheck className="ms-auto me-2 size-4 text-gray-400" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-muted-foreground text-sm">{reminder.date}</div>
                <div className="text-sm">{reminder.note}</div>
                <Badge variant="outline">{reminder.type}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-4 text-end">
          <Button className="text-muted-foreground hover:text-primary" variant="link">
            Show the other 10 reminders <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
