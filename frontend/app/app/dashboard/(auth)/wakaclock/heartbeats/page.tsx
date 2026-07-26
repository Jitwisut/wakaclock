'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RequireUser } from '@/components/wakaclock/require-user';
import { getHeartbeats } from '@/lib/wakaclock/endpoints';
import { todayDateString } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { SendHeartbeatDialog } from './components/send-heartbeat-dialog';

function HeartbeatsPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [date, setDate] = React.useState(todayDateString());

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.heartbeats(userId, date),
    queryFn: () => getHeartbeats(userId, date),
    enabled: Boolean(userId),
  });

  const rows = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Raw heartbeats — {data?.total ?? 0} today</CardTitle>
            <CardDescription>GET /heartbeats · POST /heartbeats · POST /heartbeats.bulk</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button className="gap-1.5" size="sm" variant="outline">
                  <CalendarIcon className="size-3.5" />
                  {format(new Date(date), 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  onSelect={(d) => d && setDate(format(d, 'yyyy-MM-dd'))}
                  selected={new Date(date)}
                />
              </PopoverContent>
            </Popover>
            <SendHeartbeatDialog date={date} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          emptyDescription="Send a test heartbeat above, or point wakaclock-cli at this backend."
          emptyTitle="No heartbeats on this day"
          error={error}
          isEmpty={!isLoading && !error && rows.length === 0}
          isLoading={isLoading}
        >
          <ScrollArea className="h-[520px] rounded-md border">
            <Table>
              <TableHeader className="bg-card sticky top-0">
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Write</TableHead>
                  <TableHead>Editor</TableHead>
                  <TableHead>OS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((hb) => (
                  <TableRow key={`${hb.entity}-${hb.time}-${hb.cursor_position}`}>
                    <TableCell className="font-mono text-xs">
                      {new Date(hb.time * 1000).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="max-w-56 truncate" title={hb.entity}>
                      {hb.entity}
                    </TableCell>
                    <TableCell>{hb.project ?? '—'}</TableCell>
                    <TableCell>{hb.language ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{hb.category}</Badge>
                    </TableCell>
                    <TableCell>{hb.is_write ? 'yes' : 'no'}</TableCell>
                    <TableCell className="text-muted-foreground">{hb.editor || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {hb.operating_system || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </QueryState>
      </CardContent>
    </Card>
  );
}

export default function HeartbeatsPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="The raw event stream every aggregate on this dashboard is built from."
        title="Heartbeats"
      />
      <RequireUser>
        <HeartbeatsPanel />
      </RequireUser>
    </div>
  );
}
