'use client';

import { Briefcase, FolderKanban, Mail, Phone, TrendingUp, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { useProfileStore } from '../store';

export function ProfileSidebar() {
  const { user, profileCompletion } = useProfileStore();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Progress className="flex-1" value={profileCompletion} />
            <span className="text-muted-foreground text-xs">{profileCompletion}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div>
          <h3 className="font-semibold">Profile</h3>
        </div>

        <div className="space-y-4 lg:space-y-8">
          <div>
            <p className="text-muted-foreground mb-3 text-xs font-medium uppercase">About</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Users className="text-muted-foreground h-4 w-4" />
                <span>{user.name}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="text-muted-foreground h-4 w-4" />
                <span>{user.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <TrendingUp className="text-muted-foreground h-4 w-4" />
                <span>{user.role}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-3 text-xs font-medium uppercase">Contacts</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="text-muted-foreground h-4 w-4" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="text-muted-foreground h-4 w-4" />
                <span>{user.phone}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-3 text-xs font-medium uppercase">Teams</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Users className="text-muted-foreground h-4 w-4" />
                <span>Member of {user.teams} teams</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FolderKanban className="text-muted-foreground h-4 w-4" />
                <span>Working on {user.projects} projects</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
