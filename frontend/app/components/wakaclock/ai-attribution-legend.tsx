'use client';

import { formatPercent } from '@/lib/wakaclock/format';

/**
 * What the four attribution classes mean, in the reader's terms.
 *
 * The AI Stats page shows verified / inferred / human / unknown shares but never
 * explains what evidence puts a heartbeat in each bucket. This legend states the
 * decision rule for each class — metadata only, the same contract the detection
 * pipeline holds: no prompt, diff, patch, source, or clipboard content ever
 * reaches this surface, so none of it is named here either.
 */
export interface AiAttributionLegendProps {
  aiInferredPercent: number;
  aiVerifiedPercent: number;
  humanPercent: number;
  unknownPercent: number;
}

interface LegendRow {
  evidence: string;
  key: string;
  label: string;
  percent: number;
}

export function AiAttributionLegend({
  aiInferredPercent,
  aiVerifiedPercent,
  humanPercent,
  unknownPercent,
}: AiAttributionLegendProps) {
  const rows: LegendRow[] = [
    {
      evidence:
        'A native agent hook or MCP tool reported the change as it happened. Highest confidence — the producer named itself.',
      key: 'ai_verified',
      label: 'AI verified',
      percent: aiVerifiedPercent,
    },
    {
      evidence:
        'Agent activity lined up with the file change inside the correlation window, with no competing editor keystroke. Medium confidence.',
      key: 'ai_inferred',
      label: 'AI inferred',
      percent: aiInferredPercent,
    },
    {
      evidence:
        'A positive editor keystroke or save was recorded and no agent activity fell in the same window.',
      key: 'human',
      label: 'Human',
      percent: humanPercent,
    },
    {
      evidence:
        'The file changed but authorship could not be proven, or human and AI evidence conflicted. Never counted as AI.',
      key: 'unknown',
      label: 'Unknown',
      percent: unknownPercent,
    },
  ];

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">How attribution is decided</h3>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div className="rounded-md border p-3" key={row.key}>
            <dt className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{row.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatPercent(row.percent, 0)} of heartbeats
              </span>
            </dt>
            <dd className="mt-1 text-xs text-muted-foreground">{row.evidence}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
