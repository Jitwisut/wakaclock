import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type PipelineStage = {
  color: string;
  count: number;
  id: string;
  name: string;
  value: number;
};

const pipelineData: PipelineStage[] = [
  {
    id: 'lead',
    name: 'Lead',
    count: 235,
    value: 420_500,
    color: 'bg-[var(--chart-1)]',
  },
  {
    id: 'qualified',
    name: 'Qualified',
    count: 146,
    value: 267_800,
    color: 'bg-[var(--chart-2)]',
  },
  {
    id: 'proposal',
    name: 'Proposal',
    count: 84,
    value: 192_400,
    color: 'bg-[var(--chart-3)]',
  },
  {
    id: 'negotiation',
    name: 'Negotiation',
    count: 52,
    value: 129_600,
    color: 'bg-[var(--chart-4)]',
  },
  {
    id: 'closed',
    name: 'Closed Won',
    count: 36,
    value: 87_200,
    color: 'bg-[var(--chart-5)]',
  },
];

const totalValue = pipelineData.reduce((sum, stage) => sum + stage.value, 0);
const totalCount = pipelineData.reduce((sum, stage) => sum + stage.count, 0);

export function SalesPipeline() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Pipeline</CardTitle>
        <CardDescription>Current deals in your sales pipeline.</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="mb-6 flex h-4 w-full overflow-hidden rounded-full">
            {pipelineData.map((stage) => (
              <Tooltip key={stage.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`${stage.color} h-full`}
                    style={{ width: `${(stage.value / totalValue) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <p className="font-medium">{stage.name}</p>
                    <p className="text-muted-foreground text-xs">{stage.count} deals</p>
                    <p className="text-muted-foreground text-xs">${stage.value.toLocaleString()}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>

        <div className="space-y-4">
          {pipelineData.map((stage) => (
            <div className="flex items-center gap-4" key={stage.id}>
              <div className={`h-3 w-3 rounded-full ${stage.color}`} />
              <div className="flex flex-1 items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{stage.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {stage.count} deals · ${stage.value.toLocaleString()}
                  </p>
                </div>
                <div className="flex w-24 items-center gap-2">
                  <Progress
                    className="h-2"
                    indicatorColor={stage.color}
                    value={(stage.count / totalCount) * 100}
                  />
                  <span className="text-muted-foreground w-10 text-right text-xs">
                    {Math.round((stage.value / totalValue) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
