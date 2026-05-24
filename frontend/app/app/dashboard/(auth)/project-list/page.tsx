import { Plus } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { generateMeta } from '@/lib/utils';

import projects from './data.json';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: 'Project List',
    description:
      'A projects list is an organized overview of projects with key details and statuses. Built with shadcn/ui, Tailwind CSS, Next.js and React. Includes TypeScript.',
    canonical: '/project-list',
  });
}

export default function Page() {
  return (
    <>
      <div className="mb-4 flex flex-row items-center justify-between space-y-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">List of your ongoing projects</p>
        </div>
        <Button>
          <Plus />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {projects.map((project) => (
          <Link href="#" key={project.id}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{project.title}</CardTitle>
                <CardDescription>{project.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground mb-4 text-sm">{project.date}</div>

                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm opacity-90">Progress</span>
                    <span className="text-sm font-semibold">{project.progress}%</span>
                  </div>
                  <Progress indicatorColor={project.progressColor} value={project.progress} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2">
                    {project.team.map((member) => (
                      <Avatar key={`${project.id}-member-${member.id}`}>
                        <AvatarImage alt={`${member.id}`} src={member.avatar} />
                        <AvatarFallback>CN</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>

                  <Badge
                    className={`${project.badgeColor} border-0 text-white hover:${project.badgeColor}`}
                  >
                    {project.timeLeft}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
