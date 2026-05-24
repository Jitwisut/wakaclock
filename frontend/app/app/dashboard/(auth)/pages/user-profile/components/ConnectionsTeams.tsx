import {
  BadgeDollarSignIcon,
  ChevronRight,
  ContainerIcon,
  PaletteIcon,
  UserCheck,
  UserPlus,
  UsersIcon,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const connections = [
  {
    id: '1',
    name: 'Rachel Doe',
    initials: 'R',
    connections: 25,
    status: 'connected',
    online: true,
  },
  {
    id: '2',
    name: 'Isabella Finley',
    avatar:
      'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200',
    connections: 79,
    status: 'pending',
    online: true,
  },
  {
    id: '3',
    name: 'David Harrison',
    avatar:
      'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=200',
    connections: 0,
    status: 'connected',
  },
  {
    id: '4',
    name: 'Costa Quinn',
    avatar:
      'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200',
    connections: 9,
    status: 'pending',
    online: false,
  },
];

const teams = [
  { id: '1', icon: UsersIcon, name: '#digitalmarketing', members: 8 },
  { id: '2', icon: BadgeDollarSignIcon, name: '#ethereum', members: 14 },
  { id: '3', icon: ContainerIcon, name: '#conference', members: 3 },
  { id: '4', icon: PaletteIcon, name: '#supportteam', members: 3 },
];

export function ConnectionsTeams() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden pb-0">
        <CardHeader>
          <CardTitle>Connections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connections.map((connection) => (
            <div className="flex items-center gap-4" key={connection.id}>
              <div className="relative">
                <Avatar className="size-10">
                  {connection.avatar ? (
                    <AvatarImage alt={connection.name} src={connection.avatar} />
                  ) : (
                    <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      {connection.initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                {connection.online && (
                  <div className="border-background absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 bg-green-500" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium">{connection.name}</p>
                <p className="text-muted-foreground text-sm">
                  {connection.connections} connections
                </p>
              </div>

              {connection.status === 'connected' ? (
                <Button
                  className="shrink-0 rounded-full bg-blue-500 hover:bg-blue-600"
                  size="icon-sm"
                >
                  <UserCheck />
                </Button>
              ) : (
                <Button className="shrink-0 rounded-full" size="icon-sm" variant="outline">
                  <UserPlus />
                </Button>
              )}
            </div>
          ))}
        </CardContent>

        <CardFooter className="border-t p-0!">
          <Button className="flex w-full justify-between rounded-none lg:px-6!" variant="link">
            View all connections
            <ChevronRight />
          </Button>
        </CardFooter>
      </Card>

      <Card className="overflow-hidden pb-0">
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {teams.map((team) => (
            <div className="flex items-center gap-4" key={team.id}>
              <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
                {team.icon && <team.icon className="size-5" />}
              </div>

              <div className="flex-1">
                <p className="font-medium">{team.name}</p>
                <p className="text-muted-foreground text-sm">{team.members} members</p>
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter className="border-t p-0!">
          <Button className="flex w-full justify-between rounded-none lg:px-6!" variant="link">
            View all teams
            <ChevronRight />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
