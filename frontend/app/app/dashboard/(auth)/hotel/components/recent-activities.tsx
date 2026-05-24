'use client';

import { useState } from 'react';

import { ChevronRight } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ActivityItem {
  avatar: string;
  description: string;
  id: string;
  name: string;
  room: string;
  time: string;
}

const items = [
  {
    id: '1',
    name: 'Wade Warren',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    room: '2747',
    description: 'requested for a coffee and water',
    time: '16 mins',
  },
  {
    id: '2',
    name: 'Esther Howard',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    room: '3565',
    description: 'Book and manage conference.',
    time: '24 mins',
  },
  {
    id: '3',
    name: 'Leslie Alexander',
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    room: '3546',
    description: 'Provide information about local.',
    time: '32 mins',
  },
  {
    id: '4',
    name: 'Guy Hawkins',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    room: '5654',
    description: 'Allow guests to view and settle.',
    time: '48 mins',
  },
];

export function RecentActivities() {
  const [selectedItem, setSelectedItem] = useState<ActivityItem | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Recent activities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {items.map((item) => (
            <div
              className="hover:bg-muted -mx-2 flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors"
              key={item.id}
              onClick={() => setSelectedItem(item)}
            >
              <Avatar>
                <AvatarImage alt={item.name} src={item.avatar} />
                <AvatarFallback>
                  {item.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-foreground font-semibold">{item.name}</p>
                <p className="text-muted-foreground truncate text-sm">
                  Room #{item.room}, {item.description}
                </p>
              </div>
              <span className="text-muted-foreground text-sm whitespace-nowrap">{item.time}</span>
            </div>
          ))}

          <div className="mt-4">
            <Button className="w-full" size="sm" variant="outline">
              View all <ChevronRight />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog onOpenChange={() => setSelectedItem(null)} open={!!selectedItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
            <DialogDescription>Guest request information</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage alt={selectedItem.name} src={selectedItem.avatar} />
                  <AvatarFallback>
                    {selectedItem.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{selectedItem.name}</p>
                  <p className="text-muted-foreground text-sm">Room #{selectedItem.room}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className=" ">Request</p>
                <p className="text-muted-foreground text-sm">{selectedItem.description}</p>
              </div>
              <div className="space-y-2">
                <p className=" ">Time</p>
                <p className="text-muted-foreground text-sm">{selectedItem.time} ago</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
