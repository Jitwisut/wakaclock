'use client';

import { ChevronRight } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { generateAvatarFallback } from '@/lib/utils';

const connections = [
  {
    name: 'Olivia Davis',
    email: 'olivia.davis@example.com',
    avatar: `/images/avatars/01.png`,
    status: 'connect',
  },
  {
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatar: `/images/avatars/02.png`,
    status: 'disconnect',
  },
  {
    name: 'Alice Smith',
    email: 'alice.smith@example.com',
    avatar: `/images/avatars/03.png`,
    status: 'connect',
  },
  {
    name: 'Emily Martinez',
    email: 'emily.martinez@example.com',
    avatar: `/images/avatars/05.png`,
    status: 'disconnect',
  },
  {
    name: 'James Wilson',
    email: 'james.wilson@example.com',
    avatar: `/images/avatars/06.png`,
    status: 'disconnect',
  },
];

export function Connections() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connections</CardTitle>
        <CardAction>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline">
                  <ChevronRight />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View All</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {connections.map((item) => (
            <div className="flex items-center justify-between" key={item.email}>
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage alt="@shadcn" src={item.avatar} />
                  <AvatarFallback>{generateAvatarFallback(item.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-muted-foreground text-xs">{item.email}</div>
                </div>
              </div>
              {item.status === 'disconnect' ? (
                <Button size="sm" variant="outline">
                  Disconnect
                </Button>
              ) : (
                <Button size="sm">Connect</Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
