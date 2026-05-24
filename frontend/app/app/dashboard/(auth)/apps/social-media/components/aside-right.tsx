'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface User {
  avatar: string;
  id: string;
  isFollowed?: boolean;
  name: string;
  username: string;
}

const suggestedUsers: User[] = [
  {
    id: '1',
    name: 'Azunyan Senpai',
    username: '@nyancat221b',
    avatar: 'https://i.pravatar.cc/150?img=11',
  },
  {
    id: '2',
    name: 'Oarack Babama',
    username: '@oarackbabama',
    avatar: 'https://i.pravatar.cc/150?img=12',
  },
  {
    id: '3',
    name: 'David Gilmore',
    username: '@davidgilmore',
    avatar: 'https://i.pravatar.cc/150?img=13',
  },
  {
    id: '4',
    name: 'Gerard Way',
    username: '@gerardway',
    avatar: 'https://i.pravatar.cc/150?img=14',
    isFollowed: true,
  },
  {
    id: '5',
    name: 'Mary Suez',
    username: '@marysuez821',
    avatar: 'https://i.pravatar.cc/150?img=15',
  },
  {
    id: '6',
    name: 'Edgar Wright',
    username: '@davidgilmore',
    avatar: 'https://i.pravatar.cc/150?img=16',
  },
];

const trendingArtists: User[] = [
  {
    id: '1',
    name: 'Saylor Twift',
    username: '@saylortwiftofficial',
    avatar: 'https://i.pravatar.cc/150?img=20',
  },
  {
    id: '2',
    name: 'Frank Iero',
    username: '@frankieroofficial',
    avatar: 'https://i.pravatar.cc/150?img=21',
  },
  {
    id: '3',
    name: 'Charlie XXX',
    username: '@clarliexx',
    avatar: 'https://i.pravatar.cc/150?img=22',
  },
  {
    id: '4',
    name: 'Star Warz',
    username: '@starwarzofficial',
    avatar: 'https://i.pravatar.cc/150?img=23',
  },
];

export function AsideRight() {
  return (
    <aside className="hidden flex-col gap-4 lg:flex">
      <Card className="bg-muted">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Suggested For You</CardTitle>
          <CardAction>
            <Button className="text-xs font-normal" size="sm" variant="link">
              See All
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedUsers.map((user) => (
            <div className="flex items-center justify-between" key={user.id}>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-muted-foreground text-xs">{user.username}</p>
                </div>
              </div>
              <Button
                className={user.isFollowed ? 'text-muted-foreground' : ''}
                size="sm"
                variant="link"
              >
                {user.isFollowed ? 'Followed' : 'Follow'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-muted">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Trending Artists</CardTitle>
          <CardAction>
            <Button className="text-xs font-normal" size="sm" variant="link">
              See All
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {trendingArtists.map((artist) => (
            <div className="flex items-center justify-between" key={artist.id}>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={artist.avatar} />
                  <AvatarFallback>{artist.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{artist.name}</p>
                  <p className="text-muted-foreground text-xs">{artist.username}</p>
                </div>
              </div>
              <Button size="sm" variant="link">
                Follow
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
