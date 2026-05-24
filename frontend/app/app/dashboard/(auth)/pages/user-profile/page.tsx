import { generateMeta } from '@/lib/utils';

import { ProfilePage } from './components/ProfilePage';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: 'User Profile',
    description:
      'A page within a dashboard that shows detailed user information, profile settings, and recent activity. Built with shadcn/ui, Tailwind CSS, Next.js and React. Typescript is included.',
    canonical: '/pages/profile-v2',
  });
}

function App() {
  return <ProfilePage />;
}

export default App;
