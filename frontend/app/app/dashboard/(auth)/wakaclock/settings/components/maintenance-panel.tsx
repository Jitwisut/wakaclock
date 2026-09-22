'use client';

import * as React from 'react';

import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowRightIcon,
  CalendarIcon,
  DatabaseIcon,
  FileJsonIcon,
  ScanSearchIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';
import { importWakaTime, reprocess } from '@/lib/wakaclock/endpoints';
import { daysAgoDateString, todayDateString } from '@/lib/wakaclock/format';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../settings.module.css';

import { Surface, SurfaceHeader } from './surface';

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
    <Surface className="flex flex-col overflow-hidden">
      <SurfaceHeader
        description="Preview is read-only. Applying the confirmed range backfills project IDs, rebuilds projections, and records an audit entry."
        icon={DatabaseIcon}
        title="Reprocess"
      />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
          <div className="space-y-1.5">
            <Label>Start</Label>
            <DatePickerButton onChange={setStart} value={start} />
          </div>
          <ArrowRightIcon aria-hidden="true" className="text-muted-foreground mb-2.5 size-4" />
          <div className="space-y-1.5">
            <Label>End</Label>
            <DatePickerButton onChange={setEnd} value={end} />
          </div>
        </div>
        <Button
          className="gap-1.5 self-start rounded-full"
          disabled={!userId || previewMutation.isPending}
          onClick={() => previewMutation.mutate()}
          variant="outline"
        >
          <ScanSearchIcon className="size-3.5" />
          {previewMutation.isPending ? 'Preparing preview…' : 'Preview range'}
        </Button>
      </div>
      <div
        className={cn(
          styles.dangerZone,
          'border-destructive/25 mt-auto flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6'
        )}
      >
        <p className="text-destructive flex items-center gap-2 text-xs font-medium">
          <ShieldAlertIcon aria-hidden="true" className="size-4" />
          Rebuilds aggregates for the range
        </p>
        <AlertDialog onOpenChange={(open) => !open && setConfirmText('')}>
          <AlertDialogTrigger asChild>
            <Button className="rounded-full" disabled={!userId} variant="destructive">
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
      </div>
    </Surface>
  );
}

function ImportCard() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const reduced = useReducedMotion();

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

  function pick(next: File | null | undefined) {
    setFile(next ?? null);
  }

  return (
    <Surface className="flex flex-col">
      <SurfaceHeader
        description="POST /import/wakatime"
        icon={UploadIcon}
        title="Import WakaTime data dump"
      />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
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
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drag-and-drop is a pointer shortcut; the file input inside stays keyboard reachable */}
          <label
            className={cn(
              styles.dropzone,
              dragging && styles.dropzoneActive,
              'bg-muted/30 hover:bg-muted/50 focus-within:ring-ring flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center focus-within:ring-2'
            )}
            htmlFor="wakatime-import-file"
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pick(event.dataTransfer.files[0]);
            }}
          >
            <motion.span
              animate={dragging && !reduced ? { y: -3 } : { y: 0 }}
              className="bg-background grid size-10 place-items-center rounded-xl border shadow-sm"
            >
              <FileJsonIcon aria-hidden="true" className="text-muted-foreground size-5" />
            </motion.span>
            {file ? (
              <span className="text-sm">
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {(file.size / 1024).toFixed(1)} KiB
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">
                Drop a JSON export here, or{' '}
                <span className="text-foreground underline">browse</span>
              </span>
            )}
            <Input
              accept=".json,application/json"
              className="sr-only"
              id="wakatime-import-file"
              onChange={(e) => pick(e.target.files?.[0])}
              type="file"
            />
          </label>
        </div>
        <Button
          className="gap-1.5 self-start rounded-full"
          disabled={!userId || !file || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <UploadIcon className="size-3.5" />
          {mutation.isPending ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </Surface>
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
        <Button className="w-full justify-start gap-1.5 rounded-xl" variant="outline">
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
