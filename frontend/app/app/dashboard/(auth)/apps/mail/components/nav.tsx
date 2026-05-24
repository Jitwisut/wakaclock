'use client';

import type { ReactNode } from 'react';

import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

interface NavProps {
  isCollapsed: boolean;
  links: {
    dot?: ReactNode;
    icon: LucideIcon;
    label?: string;
    title: string;
    variant: 'default' | 'ghost';
  }[];
}

export function Nav({ links, isCollapsed }: NavProps) {
  return (
    <div
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
      data-collapsed={isCollapsed}
    >
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link) =>
          isCollapsed ? (
            <Tooltip delayDuration={0} key={`nav-${link.title}`}>
              <TooltipTrigger asChild>
                <Link
                  className={cn(
                    buttonVariants({ variant: link.variant, size: 'icon' }),
                    'h-9 w-9',
                    link.variant === 'default' &&
                      'dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-white'
                  )}
                  href="#"
                >
                  {link.dot ?? <link.icon className="size-4" />}
                  <span className="sr-only">{link.title}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="flex items-center gap-4" side="right">
                {link.title}
                {link.label && <span className="text-muted-foreground ml-auto">{link.label}</span>}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              className={cn(
                buttonVariants({ variant: link.variant, size: 'sm' }),
                link.variant === 'default' &&
                  'dark:bg-muted dark:hover:bg-muted dark:text-white dark:hover:text-white',
                'justify-start'
              )}
              href="#"
              key={`nav-${link.title}`}
            >
              {link.dot ?? <link.icon className="mr-2 h-4 w-4" />}
              {link.title}
              {link.label && (
                <span
                  className={cn(
                    'ml-auto',
                    link.variant === 'default' && 'text-background dark:text-white'
                  )}
                >
                  {link.label}
                </span>
              )}
            </Link>
          )
        )}
      </nav>
    </div>
  );
}
