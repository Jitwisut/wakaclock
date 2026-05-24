import { generateMeta } from '@/lib/utils';

import AIChatInterface from '../components/ai-chat-interface';
import AIChatSidebar from '../components/ai-chat-sidebar';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: 'AI Chat V2',
    description:
      'AI chatbot is an app ui template that allows users to interact with an AI for messaging and assistance. Built with shadcn/ui, Next.js and Tailwind CSS.',
    canonical: '/apps/ai-chat-v2',
  });
}

export default function Page() {
  return (
    <div className="relative flex h-[calc(100vh-var(--header-height)-3rem)] rounded-md lg:border">
      <AIChatSidebar />
      <div className="flex w-full grow flex-col">
        <AIChatInterface />
      </div>
    </div>
  );
}
