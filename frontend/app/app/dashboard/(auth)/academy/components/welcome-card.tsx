import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function WelcomeCard() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative">
        <div className="grid items-center pt-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="font-display text-3xl">
              Hi, Andrew <span className="text-4xl">👋</span>
            </div>
            <div className="text-2xl">What do you want to learn today with your partner?</div>
            <div className="text-muted-foreground">
              Discover courses, track progress, and achieve your learning goods seamlessly.
            </div>
            <div className="pt-2">
              <Button>Explorer Course</Button>
            </div>
          </div>
          <figure className="hidden lg:col-span-1 lg:block">
            <Image
              alt="shadcn/ui"
              className="block w-full dark:hidden"
              height={50}
              src="/academy-dashboard-light.svg"
              unoptimized
              width={100}
            />
            <Image
              alt="shadcn/ui"
              className="hidden w-full dark:block"
              height={50}
              src="/academy-dashboard-dark.svg"
              unoptimized
              width={100}
            />
          </figure>
          <Image
            alt="shadcn/ui"
            className="pointer-events-none absolute inset-0 aspect-auto"
            height={300}
            src="/star-shape.png"
            unoptimized
            width={800}
          />
        </div>
      </CardContent>
    </Card>
  );
}
