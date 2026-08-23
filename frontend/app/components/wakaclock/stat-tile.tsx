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
 * A "character sheet" stat block — icon in a filled square badge (evoking an RPG
 * attribute icon) beside an uppercase label, with the value large and bold below. Same
 * props as before this pass (label/value/subtext/icon/isLoading/tooltip/className), so
 * every existing caller (Overview, Keystrokes, AI Stats) picks up the new composition
 * automatically without changes at the call site.
 */
export function StatTile({
  label,
  value,
  subtext,
  icon,
  isLoading,
  tooltip,
  className,
}: StatTileProps) {
  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="flex flex-row items-center gap-3 px-4">
        {icon && (
          <span
            aria-hidden
            className="border-border bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center border-2 [&_svg]:size-4"
          >
            {icon}
          </span>
        )}
        <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
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
          <div className="text-2xl font-bold tabular-nums" data-slot="stat-value">
            {value}
          </div>
        )}
        {subtext && !isLoading && (
          <p className="text-muted-foreground mt-1 text-xs font-semibold">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}
