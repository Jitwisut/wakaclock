import { generateMeta } from '@/lib/utils';

import { MeetingRoomSchedule } from './components/meeting-room-schedule';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: 'Bookings',
    description:
      'On the hotel management admin dashboard, you can see your turnover, manage reservations, and view your customers. Built with shadcn/ui, Tailwind CSS, Next.js.',
    canonical: '/hotel/bookings',
  });
}

export default function Page() {
  return <MeetingRoomSchedule />;
}
