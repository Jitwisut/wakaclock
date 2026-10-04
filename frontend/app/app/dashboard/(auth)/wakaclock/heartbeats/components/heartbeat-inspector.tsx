'use client';

import * as React from 'react';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatActorType, formatAiProviderModel } from '@/lib/wakaclock/ai-display';
import {
  displayEditor,
  heartbeatAgentLabel,
  splitEntityPath,
} from '@/lib/wakaclock/heartbeat-stats';
import {
  timelineProjectColor,
  timelineProjectLabel,
} from '@/lib/wakaclock/project-timeline-colors';
import type { ActorType, HeartbeatItem } from '@/lib/wakaclock/types';

type Value = boolean | null | number | string | undefined;

function show(value: Value): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

function lines(added?: null | number, deleted?: null | number) {
  if (added == null && deleted == null) return '—';
  return `+${added ?? 0} −${deleted ?? 0}`;
}

function Section({ rows, title }: { rows: Array<[string, React.ReactNode]>; title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
        {title}
      </h3>
      <dl className="bg-muted/40 divide-border/70 divide-y rounded-xl border">
        {rows.map(([label, value]) => (
          <div
            className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 px-3.5 py-2 text-sm"
            key={label}
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 font-mono text-[13px] break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function HeartbeatInspector({
  heartbeat: hb,
  onOpenChange,
  open,
}: {
  heartbeat: HeartbeatItem | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copyJson() {
    if (!hb) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(hb, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  }

  const { dir, name } = hb ? splitEntityPath(hb.entity) : { dir: '', name: '' };
  const actor = (hb?.actor_type ?? 'unknown') as ActorType;

  return (
    <Sheet onOpenChange={onOpenChange} open={open && hb !== null}>
      <SheetContent className="w-full gap-0 sm:max-w-xl" side="right">
        {hb && (
          <>
            <SheetHeader className="border-b p-6 pr-12">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span
                  className="size-2 rounded-full"
                  style={{ background: timelineProjectColor(hb.project) }}
                />
                {timelineProjectLabel(hb.project)}
                <span>·</span>
                <span className="font-mono tabular-nums">
                  {new Date(hb.time * 1000).toLocaleString([], { hour12: false })}
                </span>
              </div>
              <SheetTitle className="text-xl tracking-tight break-all">{name}</SheetTitle>
              <SheetDescription className="font-mono text-xs break-all">
                {dir || hb.entity_type}
              </SheetDescription>
              <div className="mt-2">
                <Button
                  className="gap-1.5 rounded-full"
                  onClick={copyJson}
                  size="sm"
                  variant="outline"
                >
                  {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                  {copied ? 'Copied' : 'Copy raw JSON'}
                </Button>
              </div>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
              <Section
                rows={[
                  ['Entity type', show(hb.entity_type)],
                  ['Category', show(hb.category)],
                  ['Language', show(hb.language)],
                  ['Branch', show(hb.branch)],
                  ['Write', show(hb.is_write)],
                  [
                    'Dependencies',
                    hb.dependencies.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {hb.dependencies.map((dep) => (
                          <span
                            className="bg-background rounded-md border px-1.5 py-0.5 text-xs"
                            key={dep}
                          >
                            {dep}
                          </span>
                        ))}
                      </span>
                    ) : (
                      '—'
                    ),
                  ],
                ]}
                title="Context"
              />
              <Section
                rows={[
                  ['Line', show(hb.line_number)],
                  ['Cursor', show(hb.cursor_position)],
                  ['Lines in file', show(hb.lines)],
                  ['AST language', show(hb.ast_language)],
                  ['AST confidence', show(hb.ast_confidence)],
                ]}
                title="Position"
              />
              <Section
                rows={[
                  ['Editor', displayEditor(hb.editor)],
                  ['OS', show(hb.operating_system)],
                  ['Machine', show(hb.machine)],
                  ['Session', show(hb.session_id)],
                  ['Active seconds', show(hb.active_seconds)],
                ]}
                title="Client"
              />
              <Section
                rows={[
                  ['Actor', formatActorType(actor)],
                  ['Actor confidence', show(hb.actor_confidence)],
                  ['Agent', heartbeatAgentLabel(hb)],
                  ['Provider / model', formatAiProviderModel(hb.ai_provider, hb.ai_model, actor)],
                  ['AI confidence', show(hb.ai_confidence)],
                  ['AI source', show(hb.ai_source)],
                  ['AI lines', lines(hb.ai_lines_added, hb.ai_lines_deleted)],
                  ['Human lines', lines(hb.human_lines_added, hb.human_lines_deleted)],
                  [
                    'Unattributed lines',
                    lines(hb.unattributed_lines_added, hb.unattributed_lines_deleted),
                  ],
                ]}
                title="Attribution"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Editor identifies the application observing the file. Agent identifies the AI
                evidenced for this change; Codex can change a file that VS Code also observes.
              </p>
              <Section
                rows={[
                  ['Status', show(hb.identity_status)],
                  ['Reason', show(hb.identity_reason)],
                  ['Source', show(hb.identity_source)],
                  ['Turn', show(hb.identity_turn_id)],
                  ['Message', show(hb.identity_message_id)],
                  ['AI event', show(hb.ai_event_id)],
                ]}
                title="Identity"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Active seconds is the raw value this client sent with the heartbeat. Coding time on
                other pages comes from the canonical activity timeline, not from adding these values
                up.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
