import type React from 'react';

import { generateMeta } from '@/lib/utils';

import { SidebarNav } from './components/sidebar-nav';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: 'Settings Page',
    description:
      'Example of settings page and form created using react-hook-form and Zod validator. Built with Tailwind CSS and React.',
    canonical: '/pages/settings',
  });
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings and set e-mail preferences.
        </p>
      </div>
      <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:space-x-4">
        <aside className="lg:w-64">
          <SidebarNav />
        </aside>
        <div className="flex-1 lg:max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
