import type React from 'react';

import { ChatStoreProvider } from '@/app/dashboard/(auth)/apps/chat/use-chat-store';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ChatStoreProvider>{children}</ChatStoreProvider>;
}
