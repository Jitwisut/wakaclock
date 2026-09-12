'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatActorType,
  formatAiAgentName,
  formatAiIdentityReason,
  formatAiProviderModel,
  isConfirmedAiIdentity,
} from '@/lib/wakaclock/ai-display';
import { formatCompactNumber } from '@/lib/wakaclock/format';
import type { AiAgentItem } from '@/lib/wakaclock/types';

/**
 * Per-agent AI attribution breakdown.
 *
 * Every row is kept so the table reconciles with the attribution totals. Identity
 * labels come from `actor_type`, never from the literal string `'unknown'`: an
 * inferred AI row and an unknown-authorship row can both have missing metadata,
 * but they represent different evidence states. The display helpers also handle
 * legacy placeholder values and partial provider/model metadata consistently.
 */
export interface AiAgentsTableProps {
  agents: AiAgentItem[];
  title?: null | string;
}

export function AiAgentsTable({ agents, title = 'Agents' }: AiAgentsTableProps) {
  const confirmed = agents.filter(isConfirmedAiIdentity);
  const unresolvedAi = agents.filter(
    (agent) =>
      agent.actor_type === 'ai_inferred' ||
      (agent.actor_type === 'ai_verified' && !isConfirmedAiIdentity(agent))
  );
  const otherAuthorship = agents.filter(
    (agent) => agent.actor_type === 'human' || agent.actor_type === 'unknown'
  );
  const hasAiActivity = confirmed.length > 0 || unresolvedAi.length > 0;

  const table = (rows: AiAgentItem[]) => (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Actor</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Provider / model</TableHead>
            <TableHead>AI added</TableHead>
            <TableHead>AI deleted</TableHead>
            <TableHead>Human added</TableHead>
            <TableHead>Unknown</TableHead>
            <TableHead className="text-right">Heartbeats</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((agent) => {
            const isUnattributed = agent.actor_type === 'ai_inferred';
            return (
              <TableRow
                key={`${agent.actor_type}:${agent.agent}:${agent.provider ?? ''}:${agent.model ?? ''}:${agent.identity_status ?? ''}:${agent.identity_reason ?? ''}:${agent.identity_source ?? ''}`}
              >
                <TableCell>{formatActorType(agent.actor_type)}</TableCell>
                <TableCell className={isUnattributed ? 'text-muted-foreground' : 'font-medium'}>
                  {formatAiAgentName(agent)}
                </TableCell>
                <TableCell className={isUnattributed ? 'text-muted-foreground' : undefined}>
                  {formatAiProviderModel(agent.provider, agent.model, agent.actor_type)}
                </TableCell>
                <TableCell>{formatCompactNumber(agent.ai_lines_added)}</TableCell>
                <TableCell>{formatCompactNumber(agent.ai_lines_deleted)}</TableCell>
                <TableCell>{formatCompactNumber(agent.human_lines_added)}</TableCell>
                <TableCell>
                  {formatCompactNumber(
                    agent.unknown_lines_added ?? agent.unattributed_lines_added ?? 0
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCompactNumber(agent.heartbeat_count)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const primaryIdentityTable = () => {
    if (confirmed.length > 0) {
      return (
        <section aria-label="Confirmed AI identities" className="space-y-2">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            AI verified · model confirmed
          </p>
          {table(confirmed)}
        </section>
      );
    }
    if (hasAiActivity) {
      return (
        <p className="text-muted-foreground rounded-md border p-4 text-sm" role="status">
          AI activity was detected, but no provider/model tuple is confirmed for this range.
        </p>
      );
    }
    return null;
  };

  return (
    <div>
      {title && <h3 className="mb-2 text-sm font-medium">{title}</h3>}
      {primaryIdentityTable()}

      {!hasAiActivity && otherAuthorship.length === 0 && (
        <p className="text-muted-foreground rounded-md border p-4 text-sm" role="status">
          No AI activity was detected for this range.
        </p>
      )}

      {unresolvedAi.length > 0 && (
        <details className="mt-4 rounded-md border" open={confirmed.length === 0}>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
            AI identity needs review ({unresolvedAi.length} group{unresolvedAi.length === 1 ? '' : 's'})
          </summary>
          <div className="space-y-2 px-4 pb-4">
            <p className="text-muted-foreground text-xs">
              These edits remain in the totals. Only the evidence needed to name the model is missing or conflicting.
            </p>
            <p className="text-muted-foreground text-xs">
              Run <code className="rounded bg-muted px-1 py-0.5">wakaclock doctor ai</code> to inspect the local adapter evidence. Updating an adapter can improve future events; a historical row stays unresolved when its source evidence was never recorded.
            </p>
            {table(unresolvedAi)}
            <ul className="text-muted-foreground space-y-1 text-xs">
              {unresolvedAi.map((agent) => (
                <li
                  key={`reason:${agent.agent}:${agent.identity_reason ?? ''}:${agent.model ?? ''}:${agent.identity_source ?? ''}`}
                >
                  {formatAiIdentityReason(agent.identity_reason)}
                  {agent.provider || agent.model ? ` · ${agent.provider ?? 'provider not reported'} / ${agent.model ?? 'model not reported'}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {otherAuthorship.length > 0 && (
        <details className="mt-4 rounded-md border">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
            Human / unknown authorship ({otherAuthorship.length} group{otherAuthorship.length === 1 ? '' : 's'})
          </summary>
          <div className="px-4 pb-4">{table(otherAuthorship)}</div>
        </details>
      )}
    </div>
  );
}
