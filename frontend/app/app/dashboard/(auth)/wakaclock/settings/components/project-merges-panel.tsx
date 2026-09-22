'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, FolderSyncIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QueryState } from '@/components/wakaclock/query-state';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';
import {
  deleteProjectMerge,
  getProjectMerges,
  upsertProjectMerge,
} from '@/lib/wakaclock/endpoints';
import { formatUnixSeconds } from '@/lib/wakaclock/format';
import { timelineProjectColor } from '@/lib/wakaclock/project-timeline-colors';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { ProjectMergeItem } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../settings.module.css';

import { Surface, SurfaceHeader } from './surface';

function ProjectPill({ muted = false, name }: { muted?: boolean; name: string }) {
  return (
    <span
      className={cn(
        'bg-background inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
        muted && 'text-muted-foreground'
      )}
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ background: timelineProjectColor(name) }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

function MergeFormDialog({
  userId,
  merge,
  trigger,
}: {
  merge?: ProjectMergeItem;
  trigger: React.ReactNode;
  userId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState(merge?.source_project ?? '');
  const [target, setTarget] = React.useState(merge?.target_project ?? '');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      upsertProjectMerge(merge?.merge_id ?? uuidv4(), {
        user_id: userId,
        source_project: source,
        target_project: target,
      }),
    onSuccess: () => {
      toast.success(merge ? 'Merge updated' : 'Merge created');
      queryClient.invalidateQueries({ queryKey: wakaclockKeys.projectMerges(userId) });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{merge ? 'Edit project merge' : 'New project merge'}</DialogTitle>
          <DialogDescription>
            Applied at read time — only the Projects page reflects this. Summaries, stats, and
            insights still show the source project name separately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source project</Label>
            <Input onChange={(e) => setSource(e.target.value)} value={source} />
          </div>
          <div className="space-y-1.5">
            <Label>Target project</Label>
            <Input onChange={(e) => setTarget(e.target.value)} value={target} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={mutation.isPending || !source || !target}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectMergesPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.projectMerges(userId),
    queryFn: () => getProjectMerges(userId),
    enabled: Boolean(userId),
  });

  const deleteMutation = useMutation({
    mutationFn: (mergeId: string) => deleteProjectMerge(mergeId, userId),
    onSuccess: () => {
      toast.success('Merge deleted');
      queryClient.invalidateQueries({ queryKey: wakaclockKeys.projectMerges(userId) });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const merges = data?.data ?? [];
  const reduced = useReducedMotion();

  return (
    <Surface>
      <SurfaceHeader
        actions={
          <MergeFormDialog
            trigger={
              <Button className="gap-1.5 rounded-full" size="sm">
                <PlusIcon className="size-3.5" />
                New merge
              </Button>
            }
            userId={userId}
          />
        }
        description="Summaries, stats and insights still show the source project separately."
        icon={FolderSyncIcon}
        title={merges.length === 1 ? '1 merge' : `${merges.length} merges`}
      />
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
        <QueryState
          emptyDescription="Merges fold one project's totals into another's, but only on the Projects page."
          emptyTitle="No project merges"
          error={error}
          isEmpty={!isLoading && !error && merges.length === 0}
          isLoading={isLoading}
        >
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {merges.map((merge, index) => (
                <motion.li
                  animate={{ opacity: 1, y: 0 }}
                  className="group bg-muted/25 hover:bg-muted/60 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 transition-colors sm:flex-nowrap sm:p-3.5"
                  exit={{ opacity: 0, x: -12 }}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  key={merge.merge_id}
                  layout={reduced ? false : 'position'}
                  transition={{ delay: reduced ? 0 : Math.min(index, 8) * 0.04, duration: 0.35 }}
                >
                  <ProjectPill muted name={merge.source_project} />
                  <span className={styles.mergeFlow}>
                    <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">merges into</span>
                  </span>
                  <ProjectPill name={merge.target_project} />
                  <span className="ml-auto flex items-center gap-1">
                    <span className="text-muted-foreground mr-1 hidden text-xs lg:inline">
                      {formatUnixSeconds(merge.updated_at)}
                    </span>
                    <MergeFormDialog
                      merge={merge}
                      trigger={
                        <Button
                          aria-label={`Edit merge of ${merge.source_project}`}
                          className="size-8 rounded-lg"
                          size="icon"
                          variant="ghost"
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                      }
                      userId={userId}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          aria-label={`Delete merge of ${merge.source_project}`}
                          className="hover:text-destructive size-8 rounded-lg"
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this merge?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {merge.source_project} will show up as its own project again on the
                            Projects page.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(merge.merge_id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </QueryState>
      </div>
    </Surface>
  );
}
