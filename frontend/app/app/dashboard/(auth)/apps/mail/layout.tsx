import type React from 'react';

import { MailStoreProvider } from '@/app/dashboard/(auth)/apps/mail/use-mail';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MailStoreProvider>{children}</MailStoreProvider>;
}
