import { TimeDocument } from '@/components/marketing/time/time-document';

export { timeViewport as viewport } from '@/components/marketing/time/time-document';

export const dynamic = 'force-static';

export default function TimeLayout({ children }: { children: React.ReactNode }) {
  return <TimeDocument lang="en">{children}</TimeDocument>;
}
