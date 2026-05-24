'use client';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Phone, PhoneMissedIcon, X } from 'lucide-react';

import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function CallDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline">
          <PhoneMissedIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="top-8 flex translate-y-0 items-center justify-between">
        <VisuallyHidden>
          <DialogTitle>Calling...</DialogTitle>
        </VisuallyHidden>
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage alt="shadcn/ui avatar" src="/images/avatars/04.png" />
          </Avatar>
          <div className="text-lg">Jennica calling ...</div>
        </div>
        <div className="flex gap-4">
          <Button className="size-12 rounded-full" variant="destructive">
            <X />
          </Button>
          <Button
            className="size-12 rounded-full bg-green-600 hover:bg-green-700 dark:bg-green-950"
            variant="destructive"
          >
            <Phone />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
