import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { CinemaGuestFrame } from '@/components/wakaclock/cinema-guest-frame';
import { LayoutSwitch } from '@/components/wakaclock/layout-switch';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: '500 Page',
    description:
      'This is an example of a template for 500 error pages. Built with shadcn/ui, Tailwind CSS and Next.js.',
    canonical: '/pages/error/500',
  });
}

function Classic500() {
  return (
    <div className="from-background to-secondary/10 flex min-h-screen flex-col items-center justify-center bg-gradient-to-b p-4">
      <div className="w-full max-w-3xl space-y-4 lg:space-y-8">
        <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-lg border border-red-600/10 bg-red-500/5 sm:h-80">
          <div className="absolute inset-0 grid grid-cols-10 grid-rows-10 opacity-10">
            {Array.from({ length: 100 }, (_, i) => i).map((cellId) => (
              <div
                className="border-1 border-red-600/30"
                key={`error-grid-${cellId}`}
                style={{
                  opacity: Math.random() * 0.5 + 0.5,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 text-center">
            <div className="mb-4 text-8xl font-black tracking-tighter text-red-600 sm:text-9xl">
              500
            </div>
            <div className="text-foreground text-xl font-medium sm:text-2xl">Server Error</div>
          </div>

          <div className="from-background/80 absolute right-0 bottom-0 left-0 h-1/3 bg-gradient-to-t to-transparent" />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <LayoutSwitch
      classic={<Classic500 />}
      native={
        <CinemaGuestFrame
          aside="Something failed on our side, not yours."
          headline="500"
          kicker="Error 500"
          title="Server Error"
        >
          <div className="flex w-full max-w-sm flex-col gap-4">
            <p className="text-muted-foreground text-sm">
              Nothing you recorded is affected. Head back and carry on where you were.
            </p>
            <Button asChild size="lg">
              <Link href="/dashboard/wakaclock">Back to the dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </CinemaGuestFrame>
      }
    />
  );
}
