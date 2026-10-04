'use client';

import * as React from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { sendHeartbeat, sendHeartbeatsBulk } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { Category, EntityType, HeartbeatPayload } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const ENTITY_TYPES: EntityType[] = ['file', 'domain', 'url', 'app'];
const CATEGORIES: Category[] = [
  'coding',
  'building',
  'debugging',
  'designing',
  'modeling',
  'meeting',
  'communicating',
];

export function SendHeartbeatDialog({ date, timezone }: { date: string; timezone: null | string }) {
  const [open, setOpen] = React.useState(false);
  const fieldId = React.useId();
  const userId = useWakaclockUserStore((s) => s.userId);
  const queryClient = useQueryClient();

  const [entity, setEntity] = React.useState('src/main.rs');
  const [entityType, setEntityType] = React.useState<EntityType>('file');
  const [project, setProject] = React.useState('wakaclock');
  const [language, setLanguage] = React.useState('Rust');
  const [category, setCategory] = React.useState<Category>('coding');
  const [isWrite, setIsWrite] = React.useState(true);

  const [bulkJson, setBulkJson] = React.useState('');

  function invalidate() {
    if (!userId) return;
    queryClient.invalidateQueries({
      queryKey: wakaclockKeys.heartbeats(userId, date, timezone ?? undefined),
    });
  }

  const singleMutation = useMutation({
    mutationFn: sendHeartbeat,
    onSuccess: (res) => {
      toast.success(`Heartbeat inserted (${res.heartbeats_inserted})`);
      invalidate();
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkMutation = useMutation({
    mutationFn: sendHeartbeatsBulk,
    onSuccess: (res) => {
      toast.success(`Bulk insert: ${res.heartbeats_inserted} heartbeats`);
      invalidate();
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleSingleSubmit() {
    if (!userId) return;
    const payload: HeartbeatPayload = {
      user_id: userId,
      entity,
      entity_type: entityType,
      time: Date.now() / 1000,
      project,
      language,
      category,
      is_write: isWrite,
    };
    singleMutation.mutate(payload);
  }

  function handleBulkSubmit() {
    let parsed: HeartbeatPayload[];
    try {
      const value: unknown = JSON.parse(bulkJson);
      if (!Array.isArray(value)) throw new Error('Expected a JSON array');
      parsed = value as HeartbeatPayload[];
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid JSON');
      return;
    }
    bulkMutation.mutate(parsed);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="gap-1.5" disabled={!userId || !timezone} size="sm">
          <PlusIcon className="size-3.5" />
          Send test heartbeat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send heartbeat</DialogTitle>
          <DialogDescription>
            POST /heartbeats — inserted for user_id{' '}
            <span className="font-mono text-xs">{userId}</span>.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="single">
          <TabsList className="no-scrollbar w-full max-w-full justify-start overflow-x-auto">
            <TabsTrigger className="flex-1" value="single">
              Single
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="bulk">
              Bulk JSON
            </TabsTrigger>
          </TabsList>
          <TabsContent className="space-y-3 pt-2" value="single">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-entity`}>Entity</Label>
                <Input
                  id={`${fieldId}-entity`}
                  onChange={(e) => setEntity(e.target.value)}
                  value={entity}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-entity-type`}>Entity type</Label>
                <NativeSelect
                  id={`${fieldId}-entity-type`}
                  onChange={(e) => setEntityType(e.target.value as EntityType)}
                  value={entityType}
                >
                  {ENTITY_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {t}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-project`}>Project</Label>
                <Input
                  id={`${fieldId}-project`}
                  onChange={(e) => setProject(e.target.value)}
                  value={project}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-language`}>Language</Label>
                <Input
                  id={`${fieldId}-language`}
                  onChange={(e) => setLanguage(e.target.value)}
                  value={language}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-category`}>Category</Label>
                <NativeSelect
                  id={`${fieldId}-category`}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  value={category}
                >
                  {CATEGORIES.map((c) => (
                    <NativeSelectOption key={c} value={c}>
                      {c}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex items-end gap-2 pb-1.5">
                <input
                  checked={isWrite}
                  className="size-4"
                  id={`${fieldId}-write`}
                  onChange={(e) => setIsWrite(e.target.checked)}
                  type="checkbox"
                />
                <Label htmlFor={`${fieldId}-write`}>is_write</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={singleMutation.isPending || !userId || !timezone}
                onClick={handleSingleSubmit}
              >
                {singleMutation.isPending ? 'Sending…' : 'Send'}
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent className="space-y-3 pt-2" value="bulk">
            <p className="text-muted-foreground text-xs">
              A JSON array of HeartbeatPayload objects. The backend takes user_id from the{' '}
              <strong>first element only</strong> and applies it to the whole batch.
            </p>
            <Textarea
              aria-label="Heartbeat batch JSON"
              className="font-mono text-xs"
              onChange={(e) => setBulkJson(e.target.value)}
              placeholder={`[\n  { "user_id": "${userId}", "entity": "src/lib.rs", "entity_type": "file", "time": ${(
                Date.now() / 1000
              ).toFixed(0)}, "project": "wakaclock" }\n]`}
              rows={8}
              value={bulkJson}
            />
            <DialogFooter>
              <Button
                disabled={bulkMutation.isPending || !userId || !timezone}
                onClick={handleBulkSubmit}
              >
                {bulkMutation.isPending ? 'Sending…' : 'Send batch'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
