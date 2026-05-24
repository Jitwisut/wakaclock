import { ArrowRight, Navigation } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DistanceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">Distance</CardTitle>
        <CardAction>
          <Navigation className="size-4 text-blue-500" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold lg:text-4xl">3.37</span>
            <span className="text-muted-foreground text-sm">KM</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            <Avatar className="border-card h-7 w-7 border-2">
              <AvatarImage src="/images/avatars/10.png" />
              <AvatarFallback>U1</AvatarFallback>
            </Avatar>
            <Avatar className="border-card h-7 w-7 border-2">
              <AvatarImage src="/images/avatars/02.png" />
              <AvatarFallback>U2</AvatarFallback>
            </Avatar>
          </div>
          <Badge className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium">
            Running <ArrowRight className="ml-1 inline h-3 w-3" />
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
