'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatCompactNumber } from '@/lib/wakaclock/format';
import type { AiAgentItem } from '@/lib/wakaclock/types';

/**
 * Per-agent AI attribution breakdown.
 *
 * An `ai_inferred` row is real activity with real line counts, so it is rendered
 * rather than hidden — dropping it would stop the heartbeat counts here from
 * reconciling with the "AI inferred" share shown above. What it must not do is
 * name a tool: inference proves *an* AI acted, never *which* one, so the identity
 * columns read "Unattributed AI" instead of a guess. See
 * `plans/decision-accuracy-over-coverage.md`.
 *
 * The guard keys off `actor_type`, never the literal string `'unknown'`: the
 * backend's `fetch_agents` coalesces a NULL agent to `'unknown'` for *both* an
 * unnamed inferred row and a genuinely unattributed one, and those two must read
 * differently.
 */
export interface AiAgentsTableProps {
  agents: AiAgentItem[];
}

export function AiAgentsTable({ agents }: AiAgentsTableProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Agents</h3>
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
              const isInferred = agent.actor_type === 'ai_inferred';
              return (
                <TableRow
                  key={`${agent.actor_type}:${agent.agent}:${agent.provider ?? ''}:${agent.model ?? ''}`}
                >
                  <TableCell className="capitalize">
                    {agent.actor_type.replaceAll('_', ' ')}
                  </TableCell>
                  <TableCell
                    className={isInferred ? 'text-muted-foreground' : 'font-medium'}
                  >
                    {isInferred ? 'Unattributed AI' : agent.agent}
                  </TableCell>
                  <TableCell className={isInferred ? 'text-muted-foreground' : undefined}>
                    {isInferred
                      ? '—'
                      : `${agent.provider ?? 'unknown'} / ${agent.model ?? 'unknown'}`}
                  </TableCell>
                  <TableCell>{formatCompactNumber(agent.ai_lines_added)}</TableCell>
                  <TableCell>{formatCompactNumber(agent.ai_lines_deleted)}</TableCell>
                  <TableCell>{formatCompactNumber(agent.human_lines_added)}</TableCell>
                  <TableCell>{formatCompactNumber(agent.unknown_lines_added)}</TableCell>
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
