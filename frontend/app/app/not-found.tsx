import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="bg-background grid h-screen items-center pb-8 lg:grid-cols-2 lg:pb-0">
      <div className="text-center">
        <p className="text-muted-foreground text-base font-semibold">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl lg:text-7xl">
          Page not found
        </h1>
        <p className="text-muted-foreground mt-6 text-base leading-7">
          Sorry, we couldn’t find the page you’re looking for.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-2">
          <Button asChild size="lg">
            <Link href="/dashboard">Go back home</Link>
          </Button>
          <Button size="lg" variant="ghost">
            Contact support <ArrowRight className="ms-2 h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="hidden lg:block">
        <img
          alt="404 page not found illustration"
          className="w-full object-contain lg:max-w-2xl"
          height={400}
          loading="lazy"
          src="/404.svg"
          width={300}
        />
      </div>
    </div>
  );
}
