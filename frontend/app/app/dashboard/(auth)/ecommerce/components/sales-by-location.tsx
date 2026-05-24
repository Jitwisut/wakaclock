'use client';

import { ExportButton } from '@/components/CardActionMenus';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type SalesData = {
  change: number;
  country: string;
  percentage: number;
  value: number;
};

export function EcommerceSalesByLocationCard() {
  const salesData: SalesData[] = [
    { country: 'Canada', percentage: 85, value: 1_275_000, change: 5.2 },
    { country: 'Greenland', percentage: 80, value: 1_200_000, change: 7.8 },
    { country: 'Russia', percentage: 63, value: 945_000, change: -2.1 },
    { country: 'China', percentage: 60, value: 900_000, change: 3.4 },
    { country: 'Australia', percentage: 45, value: 675_000, change: 1.2 },
    { country: 'Greece', percentage: 40, value: 475_000, change: 1 },
  ];

  return (
    <Card className="lg:col-span-6 xl:col-span-4">
      <CardHeader>
        <CardTitle className="relative">
          Sales by Location
          <div className="absolute end-0 top-0">
            <ExportButton />
          </div>
        </CardTitle>
        <CardDescription>Income in the last 28 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {salesData.map((item) => (
            <div className="space-y-2" key={item.country}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{item.country}</span>
                  {item.change > 0 ? (
                    <Badge className="text-green-500" variant="outline">
                      +{item.change}%
                    </Badge>
                  ) : (
                    <Badge className="text-red-500" variant="outline">
                      {item.change}%
                    </Badge>
                  )}
                </div>
                <div className="text-sm">{item.percentage}%</div>
              </div>
              <Progress value={item.percentage} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
