import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardDescription, CardHeader } from '@/components/ui/card';
import { CountAnimation } from '@/components/ui/custom/count-animation';

export default function ApiCallsCard() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>API Calls</CardDescription>
        <CardAction>
          <Badge variant="success">2.3%</Badge>
        </CardAction>
        <div className="font-display text-3xl">
          <CountAnimation value={4328} />
        </div>
        <div className="text-muted-foreground text-sm">More than last month</div>
      </CardHeader>
    </Card>
  );
}
