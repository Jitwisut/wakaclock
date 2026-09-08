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
  formatAiProviderModel,
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
  return (
    <div>
      {title && <h3 className="mb-2 text-sm font-medium">{title}</h3>}
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
            {agents.map((agent) => {
              const isUnattributed = agent.actor_type === 'ai_inferred';
              return (
                <TableRow
                  key={`${agent.actor_type}:${agent.agent}:${agent.provider ?? ''}:${agent.model ?? ''}`}
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
    </div>
  );
}
