import { Zap } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function ActiveCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-muted-foreground text-sm font-medium">Active</CardTitle>
          <Zap className="h-4 w-4 text-yellow-500" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">58</span>
          <span className="text-muted-foreground text-sm">min</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Progress className="h-2 flex-1" indicatorColor="bg-yellow-500" value={80} />
            <span className="text-muted-foreground text-xs">80%</span>
          </div>
          <p className="text-muted-foreground text-xs">Goal: 60 min</p>
        </div>
      </CardContent>
    </Card>
  );
}
