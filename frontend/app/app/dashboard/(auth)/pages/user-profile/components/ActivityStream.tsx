import { Clock12Icon, FileText, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@/components/ui/timeline';

const activities = [
  {
    id: '1',
    type: 'file-upload',
    title: 'Task report - uploaded weekly reports',
    description: 'Added 3 files to task',
    timestamp: '5 minutes ago',
    files: [
      { name: 'weekly-reports.xls', size: '12kb', type: 'excel' },
      { name: 'weekly-reports.xls', size: '4kb', type: 'word' },
      { name: 'monthly-reports.xls', size: '8kb', type: 'word' },
    ],
  },
  {
    id: '2',
    type: 'status-update',
    title: 'Project status updated',
    description: 'Marked',
    timestamp: '3 hours ago',
    badge: { text: 'Completed', color: 'cyan' },
  },
  {
    id: '3',
    type: 'image-added',
    title: '3 new photos added',
    description: 'Added 3 images to',
    timestamp: 'Yesterday',
    images: [
      {
        id: '1',
        src: 'https://plus.unsplash.com/premium_photo-1751667124857-32b5a1c63d8a?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=400',
      },
      {
        id: '2',
        src: 'https://images.unsplash.com/photo-1747302793923-23f66490ae0d?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=400',
      },
      {
        id: '3',
        src: 'https://images.unsplash.com/photo-1756038714389-8ff4e5967ed5?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=400',
      },
    ],
  },
];

export function ActivityStream() {
  return (
    <Card className="overflow-hidden pb-0">
      <CardHeader>
        <CardTitle>Activity stream</CardTitle>
        <CardAction>
          <Button size="icon-sm" variant="ghost">
            <MoreHorizontal />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Timeline defaultValue={3}>
          {activities.map((activity) => (
            <TimelineItem className="space-y-2" key={activity.id} step={Number(activity.id)}>
              <TimelineHeader>
                <TimelineSeparator />
                <TimelineTitle className="-mt-0.5">{activity.title}</TimelineTitle>
                <TimelineIndicator />
              </TimelineHeader>
              <TimelineContent className="space-y-4">
                {activity.files && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {activity.files.map((file) => (
                      <Link
                        className="bg-muted/30 hover:bg-muted flex items-center gap-3 rounded-lg border p-4"
                        href="#"
                        key={`${activity.id}-${file.name}`}
                      >
                        <FileText className="text-muted-foreground size-5" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="text-muted-foreground text-xs">{file.size}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {activity.images && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {activity.images.map((img) => (
                      <figure key={img.id}>
                        <img alt="..." className="aspect-video w-full rounded-lg" src={img.src} />
                      </figure>
                    ))}
                  </div>
                )}

                {activity.timestamp && (
                  <TimelineDate className="mt-2 mb-0 flex items-center gap-1.5">
                    <Clock12Icon className="size-3" />
                    {activity.timestamp}
                  </TimelineDate>
                )}
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </CardContent>
      <CardFooter className="border-t p-0!">
        <Button className="w-full rounded-none" variant="ghost">
          View more
        </Button>
      </CardFooter>
    </Card>
  );
}
