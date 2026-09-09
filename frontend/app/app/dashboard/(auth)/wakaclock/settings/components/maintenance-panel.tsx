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
    mutationFn: () => reprocess(start, end, false),
    onSuccess: (res) => {
      toast.success(`Reprocessed ${res.data.reprocessed_heartbeats} heartbeats`);
      setConfirmText('');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const previewMutation = useMutation({
    mutationFn: () => reprocess(start, end),
    onSuccess: (res) => {
      toast.info(
        `Preview: ${res.data.resolved_heartbeats} resolved, ${res.data.unresolved_heartbeats} unresolved`
      );
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
          Preview is read-only. Applying the confirmed range backfills project IDs, rebuilds
          projections, and records an audit entry.
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
        <Button
          disabled={!userId || previewMutation.isPending}
          onClick={() => previewMutation.mutate()}
          variant="outline"
        >
          {previewMutation.isPending ? 'Preparing preview…' : 'Preview range'}
        </Button>
        <AlertDialog onOpenChange={(open) => !open && setConfirmText('')}>
          <AlertDialogTrigger asChild>
            <Button disabled={!userId} variant="destructive">
              Reprocess range
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Reprocess {start} → {end}?
              </AlertDialogTitle>
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
  const [file, setFile] = React.useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Select a JSON file');
      if (file.size > 1024 * 1024) throw new Error('Select a JSON file smaller than 1 MiB');
      return importWakaTime(userId, await file.text());
    },
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
          <AlertTitle>Upload your WakaTime export</AlertTitle>
          <AlertDescription>
            Select a JSON export containing raw heartbeats, up to 1 MiB and 10,000 records.
            Uploading the same file again will not duplicate its canonical activity.
          </AlertDescription>
        </Alert>
        <div className="space-y-1.5">
          <Label htmlFor="wakatime-import-file">JSON file</Label>
          <Input
            accept=".json,application/json"
            className="font-mono text-sm"
            id="wakatime-import-file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            type="file"
          />
        </div>
        <Button disabled={!userId || !file || mutation.isPending} onClick={() => mutation.mutate()}>
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
