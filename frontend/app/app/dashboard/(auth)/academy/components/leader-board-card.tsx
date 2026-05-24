import { ChevronRight } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function LeaderboardCard() {
  const topStudents = [
    {
      id: 1,
      name: 'Liam Smith',
      points: 5000,
      avatar: `/images/avatars/01.png`,
    },
    {
      id: 2,
      name: 'Emma Brown',
      points: 4800,
      avatar: `/images/avatars/02.png`,
    },
    {
      id: 3,
      name: 'Noah Johnson',
      points: 4600,
      avatar: `/images/avatars/03.png`,
    },
    {
      id: 4,
      name: 'Olivia Davis',
      points: 4400,
      avatar: `/images/avatars/04.png`,
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Leaderboard</CardTitle>
        <CardAction className="-mt-2.5">
          <Button size="icon" variant="outline">
            <ChevronRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topStudents.map((student, index) => (
            <li className="flex items-center space-x-4" key={student.id}>
              <span>{index + 1}.</span>
              <Avatar>
                <AvatarImage alt={student.name} src={student.avatar} />
                <AvatarFallback>
                  {student.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1">{student.name}</span>
              <Badge variant="outline">{student.points} pts</Badge>
            </li>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
