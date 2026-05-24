import { promises as fs } from 'fs';
import path from 'path';

import { ChatContent, ChatSidebar } from '@/app/dashboard/(auth)/apps/chat/components';
import { generateMeta } from '@/lib/utils';

import type { ChatItemProps, UserPropsTypes } from './types';

export async function generateMetadata() {
  return generateMeta({
    title: 'Chat App',
    description:
      'A template to create chat and messaging apps for your customers or users. Built with shadcn/ui, Next.js and Tailwind CSS.',
    canonical: '/apps/chat',
  });
}

async function getChats(): Promise<ChatItemProps[]> {
  const data = await fs.readFile(
    path.join(process.cwd(), 'app/dashboard/(auth)/apps/chat/data/chats.json')
  );
  return JSON.parse(data.toString()) as ChatItemProps[];
}

async function getChatUser(id: number): Promise<undefined | UserPropsTypes> {
  const data = await fs.readFile(
    path.join(process.cwd(), 'app/dashboard/(auth)/apps/chat/data/contacts.json')
  );
  const contacts = JSON.parse(data.toString()) as UserPropsTypes[];
  return contacts.find((item: UserPropsTypes) => item.id === id);
}

export default async function Page() {
  const chats = await getChats();

  const chats_with_user = await Promise.all(
    chats.map(async (item: ChatItemProps) => {
      item.user = await getChatUser(item.user_id);
      return item;
    })
  );

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-3rem)] w-full">
      <ChatSidebar chats={chats_with_user} />
      <div className="grow">
        <ChatContent />
      </div>
    </div>
  );
}
