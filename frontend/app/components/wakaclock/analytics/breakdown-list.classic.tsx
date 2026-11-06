'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsFilterOption } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

export function BreakdownList({
  description,
  items,
  onSelect,
  title,
}: {
  description?: string;
  items: AnalyticsFilterOption[];
  onSelect?: (item: AnalyticsFilterOption) => void;
  title: string;
}) {
  const total = items.reduce((sum, item) => sum + item.total_seconds, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data in this filter.</p>
        ) : (
          items.slice(0, 10).map((item) => {
            const percentage = total > 0 ? (item.total_seconds * 100) / total : 0;
            const inner = (
              <>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{item.name}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {formatDurationShort(item.total_seconds)} · {percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </>
            );
            return onSelect ? (
              <button
                className="hover:bg-muted/50 focus-visible:ring-ring w-full rounded-md p-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                key={item.key}
                onClick={() => onSelect(item)}
                type="button"
              >
                {inner}
              </button>
            ) : (
              <div key={item.key}>{inner}</div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
