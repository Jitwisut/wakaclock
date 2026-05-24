import Onboarding from '@/app/dashboard/(auth)/pages/onboarding-flow/components/onboarding';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Onboarding Flow',
    description:
      'Onboarding flow screens are a step-by-step process that asks users questions to personalize their experience. Built with shadcn/ui, Tailwind CSS, Next.js.',
    canonical: '/pages/onboarding-flow',
  });
}

export default function Page() {
  return <Onboarding />;
}
