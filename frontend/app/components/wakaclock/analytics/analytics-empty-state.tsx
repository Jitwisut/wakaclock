import { Card, CardContent } from '@/components/ui/card';

export function AnalyticsEmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="text-muted-foreground p-8 text-center text-sm">{message}</CardContent>
    </Card>
  );
}
