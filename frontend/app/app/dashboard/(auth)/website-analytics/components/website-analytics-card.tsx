import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function WebsiteAnalyticsCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Website Analytics</CardTitle>
        <CardDescription>Total 28.5% Conversion Rate</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Badge className="border-border w-12 border" variant="secondary">
              432
            </Badge>
            <span>Direct</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="border-border w-12 border" variant="secondary">
              216
            </Badge>
            <span>Organic</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="border-border w-12 border" variant="secondary">
              29%
            </Badge>
            <span>Sessions</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="border-border w-12 border" variant="secondary">
              2.3K
            </Badge>
            <span>Page Views</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="border-border w-12 border" variant="secondary">
              1.6K
            </Badge>
            <span>Leads</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="border-border w-12 border" variant="secondary">
              8%
            </Badge>
            <span>Conversions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
