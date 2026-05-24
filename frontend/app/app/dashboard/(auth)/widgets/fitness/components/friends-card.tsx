import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const friends = [
  {
    name: 'Sarah Chen',
    activity: 'Completed 10km run',
    time: '2h',
    avatar: '/images/avatars/01.png',
  },
  {
    name: 'Mike Johnson',
    activity: 'New PR in deadlifts',
    time: '4h',
    avatar: '/images/avatars/02.png',
  },
  {
    name: 'Emma Davis',
    activity: 'Joined yoga challenge',
    time: '6h',
    avatar: '/images/avatars/03.png',
  },
];

export function FriendsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Friends</CardTitle>
        <CardDescription>Recent activity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {friends.map((friend) => (
          <div className="flex items-center gap-3" key={friend.name}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={friend.avatar || '/placeholder.svg'} />
              <AvatarFallback>
                {friend.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{friend.name}</p>
              <p className="text-muted-foreground truncate text-xs">{friend.activity}</p>
            </div>
            <span className="text-muted-foreground text-xs">{friend.time}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
