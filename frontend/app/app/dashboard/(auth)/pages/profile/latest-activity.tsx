'use client';

import { DownloadIcon } from '@radix-ui/react-icons';
import { BadgeCheckIcon, BriefcaseBusinessIcon, ClockIcon } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function LatestActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Activity</CardTitle>
        <CardAction>
          <Link
            className="text-muted-foreground hover:text-primary text-sm hover:underline"
            href="#"
          >
            View All
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="ps-8">
        <ol className="relative border-s">
          <li className="ms-6 mb-10 space-y-2">
            <span className="bg-muted absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full border">
              <BriefcaseBusinessIcon className="text-primary size-3" />
            </span>
            <h3 className="flex items-center font-semibold">
              Shadcn UI Kit Application UI v2.0.0{' '}
              <Badge className="ms-2" variant="outline">
                Latest
              </Badge>
            </h3>
            <time className="text-muted-foreground flex items-center gap-1.5 text-sm leading-none">
              <ClockIcon className="size-3" /> Released on December 2nd, 2025
            </time>
            <p className="text-muted-foreground text-sm">
              Get access to over 20+ pages including a dashboard layout, charts, kanban board,
              calendar, and pre-order E-commerce & Marketing pages.
            </p>
            <Button asChild variant="outline">
              <Link href="#">
                <DownloadIcon /> Download ZIP
              </Link>
            </Button>
          </li>
          <li className="ms-6 mb-10 space-y-2">
            <span className="bg-muted absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full border">
              <BadgeCheckIcon className="text-primary size-3" />
            </span>
            <h3 className="font-semibold">Shadcn UI Kit Figma v1.3.0</h3>
            <time className="text-muted-foreground flex items-center gap-1.5 text-sm leading-none">
              <ClockIcon className="size-3" /> Released on December 2nd, 2025
            </time>
            <p className="text-muted-foreground text-sm">
              All of the pages and components are first designed in Figma and we keep a parity
              between the two versions even as we update the project.
            </p>
          </li>
          <li className="ms-6 space-y-2">
            <span className="bg-muted absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full border">
              <BriefcaseBusinessIcon className="text-primary size-3" />
            </span>
            <h3 className="font-semibold">Shadcn UI Kit Library v1.2.2</h3>
            <time className="text-muted-foreground flex items-center gap-1.5 text-sm leading-none">
              <ClockIcon className="size-3" /> Released on December 2nd, 2025
            </time>
            <p className="text-muted-foreground text-sm">
              Get started with dozens of web components and interactive elements built on top of
              Tailwind CSS.
            </p>
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}
