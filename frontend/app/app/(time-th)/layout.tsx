import { TimeDocument } from '@/components/marketing/time/time-document';

export { timeViewport as viewport } from '@/components/marketing/time/time-document';

export const dynamic = 'force-static';

export default function ThaiTimeLayout({ children }: { children: React.ReactNode }) {
  return <TimeDocument lang="th">{children}</TimeDocument>;
}
