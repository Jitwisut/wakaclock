'use client';

import { Calendar, MapPin, PencilIcon, TrendingUp } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { useProfileStore } from '../store';

export function ProfileHeader() {
  const user = useProfileStore((state) => state.user);

  return (
    <div className="relative">
      <div className="relative aspect-video w-full rounded-t-md bg-[url('https://images.unsplash.com/photo-1735926199195-85b726600751?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1000')] bg-cover bg-center md:max-h-[240px]">
        <div className="absolute end-4 top-4">
          <Button className="bg-background/50 rounded-full" size="icon-sm" variant="ghost">
            <PencilIcon />
          </Button>
        </div>
      </div>

      <div className="-mt-10 px-4 pb-4 text-center lg:-mt-14">
        <Avatar className="border-background mx-auto size-20 border-4 lg:size-28">
          <AvatarImage alt={user.name} src={user.avatar} />
          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex items-center justify-center gap-2">
          <h4 className="text-lg font-semibold lg:text-2xl">{user.name}</h4>
        </div>

        <div className="text-muted-foreground mt-3 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            <span>{user.role}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            <span className="text-blue-500">{user.location}</span>
          </div>
          <div className="hidden items-center gap-1.5 lg:flex">
            <Calendar className="h-4 w-4" />
            <span>Joined {user.joinedDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
