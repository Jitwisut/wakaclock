import { InfoIcon } from 'lucide-react';

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
    <div
      className={cn('flex min-w-0 flex-col gap-2 border-t px-4 py-4', className)}
      data-slot="stat-tile"
    >
      <div className="flex items-center gap-1.5">
        <span className="cinema-label">{label}</span>
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
      </div>
      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div
          className="font-display text-[1.5rem] leading-none font-medium tracking-[-0.035em] tabular-nums"
          data-slot="stat-value"
        >
          {value}
        </div>
      )}
      {subtext && !isLoading && <p className="text-muted-foreground text-xs">{subtext}</p>}
    </div>
  );
}
