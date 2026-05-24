import { Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const history = [
  { label: '5d ago', distance: '10.37km' },
  { label: '8d ago', distance: '8.21km' },
  { label: '14d ago', distance: '9.54km' },
];

export function TrackingCard() {
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle className="text-muted-foreground font-medium">Tracking Now</CardTitle>
        <CardAction>
          <div className="flex gap-2">
            <Button size="icon-sm" variant="outline">
              <Pause />
            </Button>
            <Button size="icon-sm" variant="outline">
              <Play />
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold tabular-nums">00:22:50</div>
      </CardContent>
      <CardContent className="space-y-6 border-t">
        <div className="grid grid-cols-3 gap-4 divide-x">
          {history.map((item) => (
            <div className="space-y-1 py-4" key={item.label}>
              <p className="text-muted-foreground text-xs">{item.label}</p>
              <p className="font-semibold">{item.distance}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
