'use client';

import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';

type AppointmentData = {
  avatar: string;
  description: string;
  hour: string;
  status: string;
  statusColor: 'success' | 'warning';
  title: string;
};

const data: AppointmentData[] = [
  {
    avatar: '/images/avatars/08.png',
    hour: '10:00-11:00 AM',
    title: 'General Health Check up',
    description: 'Dr. Dianne Philips',
    status: 'active',
    statusColor: 'success',
  },
  {
    avatar: '/images/avatars/04.png',
    hour: '05:00-06:00 PM',
    title: 'Temporary Headache',
    description: 'Dr. Jenny Smith',
    status: 'pending',
    statusColor: 'warning',
  },
];

export default function PlannedCalendar() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  return (
    <Card className="p-0">
      <CardContent className="p-0">
        <Calendar
          className="w-full!"
          dayButtonClassName="md:size-12"
          dayClassName="md:size-10"
          defaultMonth={new Date()}
          mode="single"
          monthClassName="space-y-4 w-full flex flex-col"
          monthGridClassName="m-0"
          monthsClassName="w-full"
          onSelect={setDate}
          selected={date}
          today={new Date()}
          weekClassName="w-full!"
          weekdayClassName="w-full!"
        />
      </CardContent>
      <div className="flex flex-col divide-y border-t px-0">
        {data.map((item) => (
          <div className="w-full" key={`appointment-${item.title}-${item.hour}`}>
            <div className="flex items-center p-4">
              <Avatar>
                <AvatarImage src={item.avatar} />
                <AvatarFallback>AC</AvatarFallback>
              </Avatar>
              <div className="ms-4 space-y-1">
                <p className="leading-none font-medium">{item.title}</p>
                <p className="text-muted-foreground text-sm">
                  {item.description} at {item.hour}
                </p>
              </div>
              <Badge className="ms-auto capitalize" variant={item.statusColor}>
                {item.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
