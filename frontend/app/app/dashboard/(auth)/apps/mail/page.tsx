import { cookies } from 'next/headers';

import { generateMeta } from '@/lib/utils';

import { Mail } from './components/mail';
import { accounts, mails } from './data';

export async function generateMetadata() {
  return generateMeta({
    title: 'Mail App',
    description:
      'Easily organize incoming and outgoing mail with the mail management template. Built with shadcn/ui, Next.js and Tailwind CSS.',
    canonical: '/apps/mail',
  });
}

export default async function MailPage() {
  const cookieStore = await cookies();
  const layout = cookieStore.get('react-resizable-panels:layout:mail');
  const collapsed = cookieStore.get('react-resizable-panels:collapsed');

  const defaultLayout = layout ? (JSON.parse(layout.value) as number[]) : undefined;
  const defaultCollapsed = collapsed ? (JSON.parse(collapsed.value) as boolean) : undefined;

  return (
    <div className="h-[calc(100vh-var(--header-height)-3rem)] rounded-md border">
      <Mail
        accounts={accounts}
        defaultCollapsed={defaultCollapsed}
        defaultLayout={defaultLayout}
        mails={mails}
        navCollapsedSize={4}
      />
    </div>
  );
}
