import { InfoIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface StatTileProps {
  className?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  label: string;
  subtext?: string;
  tooltip?: string;
  value: string;
}

/**
 * A single figure: a sentence-case label (with an optional info tooltip), the value, and
 * a short note. The icon prop is accepted for compatibility but no longer drawn; the
 * dashboard's figures read as text, the way a desktop app's inspector does.
 */
export function StatTile({
  label,
  value,
  subtext,
  icon: _icon,
  isLoading,
  tooltip,
  className,
}: StatTileProps) {
  return (
    <Card className={cn('gap-1.5 py-3.5', className)}>
      <CardHeader className="flex flex-row items-center gap-3 px-4">
        <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs font-normal">
          {label}
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={tooltip}
                    className="text-muted-foreground/60 hover:text-foreground cursor-help transition-colors"
                    type="button"
                  >
                    <InfoIcon aria-hidden className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-xl font-semibold tracking-tight tabular-nums" data-slot="stat-value">
            {value}
          </div>
        )}
        {subtext && !isLoading && <p className="text-muted-foreground mt-0.5 text-xs">{subtext}</p>}
      </CardContent>
    </Card>
  );
}
