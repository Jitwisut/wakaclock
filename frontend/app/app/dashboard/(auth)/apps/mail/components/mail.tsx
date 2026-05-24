'use client';

import * as React from 'react';

import Cookies from 'js-cookie';
import { Search } from 'lucide-react';

import { MailDisplayMobile } from '@/app/dashboard/(auth)/apps/mail/components/mail-display-mobile';
import { NavDesktop } from '@/app/dashboard/(auth)/apps/mail/components/nav-desktop';
import { NavMobile } from '@/app/dashboard/(auth)/apps/mail/components/nav-mobile';
import { Input } from '@/components/ui/input';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

import { type Mail as MailType } from '../data';
import { useMailStore } from '../use-mail';

import { MailDisplay } from './mail-display';
import { MailList } from './mail-list';

interface MailProps {
  accounts: {
    email: string;
    icon: React.ReactNode;
    label: string;
  }[];
  defaultCollapsed?: boolean;
  defaultLayout: number[] | undefined;
  mails: MailType[];
  navCollapsedSize: number;
}

export function Mail({
  mails,
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: MailProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const isMobile = useIsMobile();
  const { selectedMail } = useMailStore();
  const [tab, setTab] = React.useState('all');

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        className="items-stretch"
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          Cookies.set('react-resizable-panels:layout:mail', JSON.stringify(sizes));
        }}
      >
        <ResizablePanel
          className={cn(isCollapsed && 'min-w-[50px] transition-all duration-300 ease-in-out')}
          collapsedSize={navCollapsedSize}
          collapsible
          defaultSize={defaultLayout[0]}
          hidden={isMobile}
          maxSize={20}
          minSize={15}
          onCollapse={() => {
            setIsCollapsed(true);
            Cookies.set('react-resizable-panels:collapsed', JSON.stringify(true));
          }}
          onResize={() => {
            setIsCollapsed(false);
            Cookies.set('react-resizable-panels:collapsed', JSON.stringify(false));
          }}
        >
          <NavDesktop isCollapsed={isCollapsed} />
        </ResizablePanel>
        <ResizableHandle hidden={isMobile} withHandle />
        <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
          <Tabs
            className="flex h-full flex-col gap-0"
            defaultValue="all"
            onValueChange={(value) => setTab(value)}
          >
            <div className="flex items-center px-4 py-2">
              <div className="flex items-center gap-2">
                {isMobile && <NavMobile />}
                <h1 className="text-xl font-bold">Inbox</h1>
              </div>
              <TabsList className="ml-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
              </TabsList>
            </div>
            <Separator />
            <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 p-4 backdrop-blur">
              <form>
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                  <Input className="pl-8" placeholder="Search" />
                </div>
              </form>
            </div>
            <div className="min-h-0">
              <MailList
                items={
                  tab === 'all' ? mails : mails.filter((item) => item.read === (tab === 'read'))
                }
              />
            </div>
          </Tabs>
        </ResizablePanel>
        <ResizableHandle hidden={isMobile} withHandle />
        <ResizablePanel defaultSize={defaultLayout[2]} hidden={isMobile} minSize={30}>
          {isMobile ? (
            <MailDisplayMobile mail={mails.find((item) => item.id === selectedMail?.id) || null} />
          ) : (
            <MailDisplay mail={mails.find((item) => item.id === selectedMail?.id) || null} />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}
