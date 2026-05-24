'use client';

import { useEffect, useRef } from 'react';

import Image from 'next/image';

import useChatStore from '@/app/dashboard/(auth)/apps/chat/use-chat-store';

import { ChatBubble } from './chat-bubbles';
import { ChatFooter } from './chat-footer';
import { ChatHeader } from './chat-header';
import { UserDetailSheet } from './user-detail-sheet';

import type { ChatMessageProps } from '../types';

export function ChatContent() {
  const { selectedChat } = useChatStore();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollIntoView(false);
    }
  }, [selectedChat]);

  if (!selectedChat) {
    return (
      <figure className="hidden h-full items-center justify-center text-center lg:flex">
        <Image
          alt="shadcn/ui"
          className="block max-w-sm dark:hidden"
          height={200}
          src="/not-selected-chat.svg"
          unoptimized
          width={200}
        />
        <Image
          alt="shadcn/ui"
          className="hidden max-w-sm dark:block"
          height={200}
          src="/not-selected-chat-light.svg"
          width={200}
        />
      </figure>
    );
  }

  return (
    <div className="bg-background fixed inset-0 z-50 flex h-full flex-col p-4 lg:relative lg:z-10 lg:bg-transparent lg:p-0">
      {selectedChat.user && <ChatHeader user={selectedChat.user} />}

      <div className="flex-1 overflow-y-auto lg:px-4">
        <div ref={messagesContainerRef}>
          <div className="flex flex-col items-start space-y-10 py-8">
            {selectedChat?.messages?.length &&
              selectedChat.messages.map((item: ChatMessageProps) => (
                <ChatBubble key={item.id} message={item} type={item.type} />
              ))}
          </div>
        </div>
      </div>

      <ChatFooter />

      {selectedChat.user && <UserDetailSheet user={selectedChat.user} />}
    </div>
  );
}
