import { Moon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function SleepCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-muted-foreground text-sm font-medium">Sleep</CardTitle>
          <Moon className="h-4 w-4 text-purple-500" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold">7h 32m</div>
        <div className="space-y-2">
          <Progress className="h-2" indicatorColor="bg-purple-500" value={89} />
          <p className="text-muted-foreground text-xs">Quality: 89%</p>
        </div>
      </CardContent>
    </Card>
  );
}
