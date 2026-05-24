import {
  AtomIcon,
  CatIcon,
  ChevronRight,
  Package2Icon,
  PlusIcon,
  ShipWheelIcon,
  TreePalmIcon,
  UnlinkIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const projects = [
  {
    id: '1',
    name: 'UI/UX',
    icon: Package2Icon,
    progress: 0,
    hoursSpent: '4:25',
    updated: 'Updated 2 hours ago',
  },
  {
    id: '2',
    name: 'Get a complete audit store',
    icon: ShipWheelIcon,
    progress: 45,
    hoursSpent: '18:42',
    updated: 'Updated 1 day ago',
  },
  {
    id: '3',
    name: 'Build stronger customer relationships',
    icon: TreePalmIcon,
    progress: 59,
    hoursSpent: '9:01',
    updated: 'Updated 2 days ago',
  },
  {
    id: '4',
    name: 'Update subscription method',
    icon: UnlinkIcon,
    progress: 57,
    hoursSpent: '0:37',
    updated: 'Updated 2 days ago',
  },
  {
    id: '5',
    name: 'Create a new theme',
    icon: AtomIcon,
    progress: 100,
    hoursSpent: '24:12',
    updated: 'Updated 1 week ago',
  },
  {
    id: '6',
    name: 'Improve social banners',
    icon: CatIcon,
    progress: 0,
    hoursSpent: '8:08',
    updated: 'Updated 1 week ago',
  },
];

export function ProjectsTable() {
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardAction className="-mt-2">
          <Button size="sm" variant="outline">
            <PlusIcon /> New Project
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Project</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Hours Spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg text-lg">
                      {project.icon && <project.icon className="size-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{project.name}</p>
                      <p className="text-muted-foreground text-xs">{project.updated}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={project.progress} />
                    <span className="text-muted-foreground w-8 shrink-0 text-right text-sm">
                      {project.progress}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{project.hoursSpent}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="border-t p-0!">
        <Button className="text-muted-foreground w-full justify-center" variant="link">
          View all projects
          <ChevronRight />
        </Button>
      </CardFooter>
    </Card>
  );
}
