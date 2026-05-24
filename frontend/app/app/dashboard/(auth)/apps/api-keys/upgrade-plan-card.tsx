import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function UpgradePlanCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Developer Plan</CardTitle>
        <CardAction>
          <Button className="-mt-3" size="sm" variant="outline">
            Upgrade Plan
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={25} />
        <div className="text-muted-foreground text-sm">You used 215 of 2000 of your API</div>
      </CardContent>
    </Card>
  );
}
