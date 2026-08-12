'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QueryState } from '@/components/wakaclock/query-state';
import { deleteProjectRule, getProjectRules, upsertProjectRule } from '@/lib/wakaclock/endpoints';
import { formatUnixSeconds } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { ProjectRuleItem } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

function isValidRegex(pattern: string) {
  try {
    // eslint-disable-next-line security/detect-non-literal-regexp -- client-side syntax check only, never executed against untrusted input
    const compiled = new RegExp(pattern);
    return Boolean(compiled);
  } catch {
    return false;
  }
}

function RuleFormDialog({
  userId,
  rule,
  trigger,
}: {
  rule?: ProjectRuleItem;
  trigger: React.ReactNode;
  userId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pattern, setPattern] = React.useState(rule?.pattern ?? '');
  const [projectName, setProjectName] = React.useState(rule?.project_name ?? '');
  const [priority, setPriority] = React.useState(rule?.priority ?? 0);
  const [isActive, setIsActive] = React.useState(rule?.is_active ?? true);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      upsertProjectRule(rule?.rule_id ?? uuidv4(), {
        user_id: userId,
        pattern,
        project_name: projectName,
        priority,
        is_active: isActive,
      }),
    onSuccess: () => {
      toast.success(rule ? 'Rule updated' : 'Rule created');
      queryClient.invalidateQueries({ queryKey: wakaclockKeys.projectRules(userId) });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patternInvalid = pattern.length > 0 && !isValidRegex(pattern);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit project rule' : 'New project rule'}</DialogTitle>
          <DialogDescription>
            Applied at heartbeat write time — the first matching pattern (in list order) wins.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Pattern (Rust regex)</Label>
            <Input
              aria-invalid={patternInvalid}
              className="font-mono text-sm"
              onChange={(e) => setPattern(e.target.value)}
              placeholder="^/home/me/code/(.+?)/"
              value={pattern}
            />
            {patternInvalid && (
              <p className="text-destructive text-xs">Not a valid regular expression.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Project name</Label>
            <Input onChange={(e) => setProjectName(e.target.value)} value={projectName} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Input
                onChange={(e) => setPriority(Number(e.target.value))}
                type="number"
                value={priority}
              />
            </div>
            <div className="flex items-end gap-2 pb-1.5">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={mutation.isPending || !pattern || !projectName || patternInvalid}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectRulesPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.projectRules(userId),
    queryFn: () => getProjectRules(userId),
    enabled: Boolean(userId),
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteProjectRule(ruleId, userId),
    onSuccess: () => {
      toast.success('Rule deleted');
      queryClient.invalidateQueries({ queryKey: wakaclockKeys.projectRules(userId) });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rules = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RuleFormDialog
          trigger={
            <Button className="gap-1.5" size="sm">
              <PlusIcon className="size-3.5" />
              New rule
            </Button>
          }
          userId={userId}
        />
      </div>
      <QueryState
        emptyDescription="Regex rules override the client-supplied project on every ingested heartbeat."
        emptyTitle="No project rules"
        error={error}
        isEmpty={!isLoading && !error && rules.length === 0}
        isLoading={isLoading}
      >
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pattern</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.rule_id}>
                  <TableCell className="max-w-56 truncate font-mono text-xs" title={rule.pattern}>
                    {rule.pattern}
                  </TableCell>
                  <TableCell>{rule.project_name}</TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                      {rule.is_active ? 'active' : 'inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatUnixSeconds(rule.updated_at)}
                  </TableCell>
                  <TableCell className="flex justify-end gap-1 text-right">
                    <RuleFormDialog
                      rule={rule}
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
                          <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Future heartbeats matching “{rule.pattern}” will no longer be reassigned
                            to {rule.project_name}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(rule.rule_id)}>
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
