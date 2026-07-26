'use client';

import * as React from 'react';

import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, DatabaseIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { importWakaTime, reprocess } from '@/lib/wakaclock/endpoints';
import { daysAgoDateString, todayDateString } from '@/lib/wakaclock/format';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

function ReprocessCard() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [start, setStart] = React.useState(daysAgoDateString(6));
  const [end, setEnd] = React.useState(todayDateString());
  const [confirmText, setConfirmText] = React.useState('');

  const mutation = useMutation({
    mutationFn: () => reprocess(userId, start, end),
    onSuccess: (res) => {
      toast.success(`Reprocessed ${res.data.reprocessed_heartbeats} heartbeats`);
      setConfirmText('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseIcon className="size-4" />
          Reprocess
        </CardTitle>
        <CardDescription>
          POST /reprocess — deletes and rebuilds every aggregate table for this range from raw
          heartbeats. Idempotent, but not reversible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Start</Label>
            <DatePickerButton onChange={setStart} value={start} />
          </div>
          <div className="space-y-1.5">
            <Label>End</Label>
            <DatePickerButton onChange={setEnd} value={end} />
          </div>
        </div>
        <AlertDialog onOpenChange={(open) => !open && setConfirmText('')}>
          <AlertDialogTrigger asChild>
            <Button disabled={!userId} variant="destructive">
              Reprocess range
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reprocess {start} → {end}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes rows from 8 aggregate tables for this user and range, then rebuilds
                them from raw heartbeats. Type <strong>reprocess</strong> to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="reprocess"
              value={confirmText}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText !== 'reprocess' || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? 'Reprocessing…' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function ImportCard() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [filePath, setFilePath] = React.useState('');

  const mutation = useMutation({
    mutationFn: () => importWakaTime(userId, filePath),
    onSuccess: (res) => {
      toast.success(
        `Imported ${res.data.imported_heartbeats} (skipped ${res.data.skipped_heartbeats})`
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="size-4" />
          Import WakaTime data dump
        </CardTitle>
        <CardDescription>POST /import/wakatime</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Server-side path, not a file upload</AlertTitle>
          <AlertDescription>
            The backend reads this path from its own filesystem — it must already exist on the
            machine running the wakaclock API, not on the machine running this browser.
          </AlertDescription>
        </Alert>
        <div className="space-y-1.5">
          <Label>File path</Label>
          <Input
            className="font-mono text-sm"
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="/data/wakatime-export.json"
            value={filePath}
          />
        </div>
        <Button
          disabled={!userId || !filePath || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Importing…' : 'Import'}
        </Button>
      </CardContent>
    </Card>
  );
}

function DatePickerButton({
  value,
  onChange,
}: {
  onChange: (date: string) => void;
  value: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="w-full justify-start gap-1.5" variant="outline">
          <CalendarIcon className="size-3.5" />
          {format(new Date(value), 'MMM d, yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          onSelect={(d) => d && onChange(format(d, 'yyyy-MM-dd'))}
          selected={new Date(value)}
        />
      </PopoverContent>
    </Popover>
  );
}

export function MaintenancePanel() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ReprocessCard />
      <ImportCard />
    </div>
  );
}
