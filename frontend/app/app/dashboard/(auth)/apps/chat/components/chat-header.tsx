'use client';

import { ArrowLeft, Ellipsis } from 'lucide-react';

import type { UserPropsTypes } from '@/app/dashboard/(auth)/apps/chat/types';
import useChatStore from '@/app/dashboard/(auth)/apps/chat/use-chat-store';
import { Avatar, AvatarFallback, AvatarImage, AvatarIndicator } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { generateAvatarFallback } from '@/lib/utils';

import { CallDialog } from './call-dialog';
import { ChatUserDropdown } from './chat-list-item-dropdown';
import { VideoCallDialog } from './video-call-dialog';

export function ChatHeader({ user }: { user: UserPropsTypes }) {
  const { setSelectedChat } = useChatStore();

  return (
    <div className="flex justify-between gap-4 lg:px-4">
      <div className="flex gap-4">
        <Button
          className="flex size-10 p-0 lg:hidden"
          onClick={() => setSelectedChat(null)}
          size="sm"
          variant="outline"
        >
          <ArrowLeft />
        </Button>
        <Avatar className="overflow-visible lg:size-10">
          <AvatarImage alt="avatar image" src={`${user?.avatar}`} />
          <AvatarIndicator variant={user?.online_status} />
          <AvatarFallback>{generateAvatarFallback(user?.name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{user.name}</span>
          {user.online_status === 'success' ? (
            <span className="text-xs text-green-500">Online</span>
          ) : (
            <span className="text-muted-foreground text-xs">{user.last_seen}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="hidden lg:flex lg:gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <VideoCallDialog />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">Start Video Chat</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <CallDialog />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">Start Call</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ChatUserDropdown>
          <Button size="icon" variant="ghost">
            <Ellipsis />
          </Button>
        </ChatUserDropdown>
      </div>
    </div>
  );
}
