'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, PencilIcon, PlusIcon, RegexIcon, Trash2Icon } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { QueryState } from '@/components/wakaclock/query-state';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';
import { deleteProjectRule, getProjectRules, upsertProjectRule } from '@/lib/wakaclock/endpoints';
import { formatUnixSeconds } from '@/lib/wakaclock/format';
import { timelineProjectColor } from '@/lib/wakaclock/project-timeline-colors';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { ProjectRuleItem } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { Surface, SurfaceHeader } from './surface';

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
  const activeCount = rules.filter((rule) => rule.is_active).length;
  const reduced = useReducedMotion();

  return (
    <Surface>
      <SurfaceHeader
        actions={
          <RuleFormDialog
            trigger={
              <Button className="gap-1.5 rounded-full" size="sm">
                <PlusIcon className="size-3.5" />
                New rule
              </Button>
            }
            userId={userId}
          />
        }
        description="The first matching pattern (in list order) wins."
        icon={RegexIcon}
        title={rules.length > 0 ? `${activeCount} of ${rules.length} rules active` : 'Rules'}
      />
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
        <QueryState
          emptyDescription="Regex rules override the client-supplied project on every ingested heartbeat."
          emptyTitle="No project rules"
          error={error}
          isEmpty={!isLoading && !error && rules.length === 0}
          isLoading={isLoading}
        >
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {rules.map((rule, index) => (
                <motion.li
                  animate={{ opacity: 1, y: 0 }}
                  className="group bg-muted/25 hover:bg-muted/60 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl border p-3 transition-colors sm:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:p-3.5"
                  exit={{ opacity: 0, x: -12 }}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  key={rule.rule_id}
                  layout={reduced ? false : 'position'}
                  transition={{ delay: reduced ? 0 : Math.min(index, 8) * 0.04, duration: 0.35 }}
                >
                  <span
                    className="bg-background text-muted-foreground hidden h-7 place-items-center rounded-lg border font-mono text-xs tabular-nums sm:grid"
                    title="Priority"
                  >
                    {rule.priority}
                  </span>
                  <code
                    className="bg-background/80 min-w-0 truncate rounded-lg border px-2.5 py-1.5 font-mono text-xs"
                    title={rule.pattern}
                  >
                    {rule.pattern}
                  </code>
                  <span className="col-span-2 flex min-w-0 items-center gap-2 text-sm sm:col-span-1">
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="text-muted-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    />
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: timelineProjectColor(rule.project_name) }}
                    />
                    <span className="truncate font-medium">{rule.project_name}</span>
                    <span
                      className={cn(
                        'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium sm:ml-2',
                        rule.is_active
                          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          rule.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                        )}
                      />
                      {rule.is_active ? 'active' : 'inactive'}
                    </span>
                  </span>
                  <span className="col-start-2 row-start-1 flex items-center justify-end gap-1 sm:col-start-auto sm:row-start-auto">
                    <span className="text-muted-foreground mr-1 hidden text-xs xl:inline">
                      {formatUnixSeconds(rule.updated_at)}
                    </span>
                    <RuleFormDialog
                      rule={rule}
                      trigger={
                        <Button
                          aria-label={`Edit rule for ${rule.project_name}`}
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
                          aria-label={`Delete rule for ${rule.project_name}`}
                          className="hover:text-destructive size-8 rounded-lg"
                          size="icon"
                          variant="ghost"
                        >
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
