import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
        <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
          {label}
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={tooltip}
                    className="text-muted-foreground/60 hover:text-foreground cursor-help underline decoration-dotted underline-offset-4"
                    type="button"
                  >
                    ⓘ
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </CardHeader>
      <CardContent className="px-4">
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div
            className="font-(family-name:--font-overpass-mono) text-2xl font-semibold tabular-nums"
            data-slot="stat-value"
          >
            {value}
          </div>
        )}
        {subtext && !isLoading && (
          <p className="text-muted-foreground mt-1 text-xs">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}
