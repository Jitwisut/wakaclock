'use client';

import React, { useState } from 'react';

import { Compass, Ellipsis, History, Library, Menu, Plus, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import conversations from '../data.json';

import { AIUpgradePricingModal } from './ai-upgrade-modal';

interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  label: string;
}

const sidebarItems: SidebarItem[] = [
  { icon: Compass, label: 'Explore' },
  { icon: Library, label: 'Library' },
  { icon: History, label: 'History' },
];

export type Conversation = (typeof conversations)[number];

const groupConversationsByCategory = (conversationList: Conversation[]) => {
  const groups: Record<string, { conversations: Conversation[]; title: string }> = {
    today: { title: 'Today', conversations: [] },
    yesterday: { title: 'Yesterday', conversations: [] },
    '7days': { title: '7 Days Ago', conversations: [] },
    older: { title: 'Older', conversations: [] },
  };

  conversationList.forEach((conv) => {
    groups[conv.category].conversations.push(conv);
  });

  return Object.entries(groups)
    .filter(([_, group]) => group.conversations.length > 0)
    .map(([key, group]) => ({ key, ...group }));
};

const SidebarContent = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConversations] = useState(conversations);

  const params = useParams<{ id: string }>();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const conversationGroups = groupConversationsByCategory(filteredConversations);

  return (
    <div className="flex h-full flex-col border-e lg:w-72">
      <div className="border-b px-4 py-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            className="bg-background border-transparent pl-6 text-sm shadow-none focus:border-transparent! focus:shadow-none focus:ring-0!"
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search chats..."
            value={searchQuery}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="grow space-y-4 overflow-y-auto p-4 lg:space-y-8">
        {conversationGroups.map((group) => (
          <div key={group.key}>
            <h3 className="text-muted-foreground mb-4 text-xs">{group.title}</h3>
            <div className="space-y-0.5">
              {group.conversations.map((conversation) => (
                <div className="group flex items-center" key={conversation.id}>
                  <Link
                    className={cn(
                      'hover:bg-muted block w-full min-w-0 justify-start truncate rounded-lg p-2 px-3 text-start text-sm',
                      params.id === conversation.id && 'bg-muted'
                    )}
                    href={`/dashboard/apps/ai-chat-v2/${conversation.id}`}
                  >
                    {conversation.title}
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="group-hover:opacity-100 md:opacity-0"
                        size="icon"
                        variant="ghost"
                      >
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>Rename</DropdownMenuItem>
                      <DropdownMenuItem>Share</DropdownMenuItem>
                      <DropdownMenuItem>Pin the chat</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-500!">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filteredConversations.length === 0 && searchQuery && (
          <div className="text-muted-foreground py-4 text-center text-sm">
            No conversations found
          </div>
        )}
      </div>

      <div>
        <div className="p-4">
          {sidebarItems.map((item) => (
            <Button
              className={cn('hover:bg-muted w-full justify-start', item.isActive && 'bg-muted')}
              key={item.label}
              variant="ghost"
            >
              <item.icon />
              {item.label}
            </Button>
          ))}

          <AIUpgradePricingModal>
            <Button className="hover:bg-muted w-full justify-start" variant="ghost">
              <Sparkles /> Upgrade
            </Button>
          </AIUpgradePricingModal>
        </div>

        <div className="border-t p-4">
          <Button asChild className="w-full">
            <Link href="/dashboard/apps/ai-chat-v2">
              <Plus />
              New Chat
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function AIChatSidebar() {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button className="absolute end-0 top-0 z-10 md:hidden" size="icon" variant="ghost">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
