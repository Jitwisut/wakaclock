import { MoreHorizontal, UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ActivityStream } from './ActivityStream';
import { ConnectionsTeams } from './ConnectionsTeams';
import { ProfileHeader } from './ProfileHeader';
import { ProfileSidebar } from './ProfileSidebar';
import { ProjectsTable } from './ProjectsTable';

export function ProfilePage() {
  return (
    <div className="mx-auto min-h-screen lg:max-w-7xl xl:pt-6">
      <div className="space-y-4">
        <div className="bg-card overflow-hidden rounded-md border">
          <ProfileHeader />

          <div className="border-t">
            <div className="flex items-center justify-between px-4">
              <Tabs className="flex-1" defaultValue="profile">
                <TabsList className="-mb-0.5 h-auto gap-6 border-none bg-transparent p-0">
                  <TabsTrigger
                    className="data-[state=active]:border-b-primary data-[state=active]:text-foreground text-muted-foreground rounded-none border-b-2 border-transparent px-0 py-4 shadow-none!"
                    value="profile"
                  >
                    Profile
                  </TabsTrigger>
                  <TabsTrigger
                    className="data-[state=active]:border-b-primary data-[state=active]:text-foreground text-muted-foreground rounded-none border-b-2 border-transparent px-0 py-4 shadow-none!"
                    value="teams"
                  >
                    Teams
                  </TabsTrigger>
                  <TabsTrigger
                    className="data-[state=active]:border-b-primary data-[state=active]:text-foreground text-muted-foreground rounded-none border-b-2 border-transparent px-0 py-4 shadow-none!"
                    value="projects"
                  >
                    Projects
                    <Badge className="rounded-full" variant="secondary">
                      3
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                <Button size="sm">
                  <UserPlus />
                  <span className="hidden md:inline">Connect</span>
                </Button>
                <Button size="icon-sm" variant="outline">
                  <MoreHorizontal />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="gap-4 space-y-4 lg:grid lg:grid-cols-[320px_1fr] lg:space-y-0 xl:grid-cols-[360px_1fr]">
          <ProfileSidebar />

          <main className="space-y-6">
            <ActivityStream />
            <ConnectionsTeams />
            <ProjectsTable />
          </main>
        </div>
      </div>
    </div>
  );
}
