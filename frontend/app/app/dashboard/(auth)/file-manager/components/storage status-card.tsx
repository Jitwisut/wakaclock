'use client';

import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function StorageStatusCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Space Used</CardTitle>
        <CardDescription>See your remaining file storage</CardDescription>
        <CardAction>
          <Button size="icon" variant="outline">
            <ChevronRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-muted-foreground flex justify-between text-sm">
            <span>1.8 GB used</span>
            <span>3 GB total</span>
          </div>
          <Progress className="w-full" value={70} />
        </div>
      </CardContent>
    </Card>
  );
}
