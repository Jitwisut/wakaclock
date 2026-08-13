'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QueryState } from '@/components/wakaclock/query-state';
import {
  deleteProjectMerge,
  getProjectMerges,
  upsertProjectMerge,
} from '@/lib/wakaclock/endpoints';
import { formatUnixSeconds } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { ProjectMergeItem } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MergeFormDialog
          trigger={
            <Button className="gap-1.5" size="sm">
              <PlusIcon className="size-3.5" />
              New merge
            </Button>
          }
          userId={userId}
        />
      </div>
      <QueryState
        emptyDescription="Merges fold one project's totals into another's, but only on the Projects page."
        emptyTitle="No project merges"
        error={error}
        isEmpty={!isLoading && !error && merges.length === 0}
        isLoading={isLoading}
      >
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead />
                <TableHead>Target</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merges.map((merge) => (
                <TableRow key={merge.merge_id}>
                  <TableCell className="font-medium">{merge.source_project}</TableCell>
                  <TableCell>
                    <ArrowRightIcon className="text-muted-foreground size-3.5" />
                  </TableCell>
                  <TableCell className="font-medium">{merge.target_project}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatUnixSeconds(merge.updated_at)}
                  </TableCell>
                  <TableCell className="flex justify-end gap-1 text-right">
                    <MergeFormDialog
                      merge={merge}
                      trigger={
                        <Button className="size-8" size="icon" variant="ghost">
                          <PencilIcon className="size-3.5" />
                        </Button>
                      }
                      userId={userId}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="size-8" size="icon" variant="ghost">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </QueryState>
    </div>
  );
}
