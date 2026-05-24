'use client';

import React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const tabs = [
    {
      label: 'Fitness',
      key: 'fitness',
      href: '/dashboard/widgets/fitness',
    },
    {
      label: 'E-commerce',
      key: 'ecommerce',
      href: '/dashboard/widgets/ecommerce',
    },
    {
      label: 'Analytics',
      key: 'analytics',
      href: '/dashboard/widgets/analytics',
    },
  ];

  return (
    <>
      <div className="mb-4 flex gap-2 [&_[data-slot=button]]:rounded-full">
        {tabs.map((tab) => (
          <Button
            asChild
            key={tab.key}
            variant={pathname.endsWith(tab.key) ? 'default' : 'outline'}
          >
            <Link href={tab.href}>{tab.label}</Link>
          </Button>
        ))}
      </div>
      {children}
    </>
  );
}
