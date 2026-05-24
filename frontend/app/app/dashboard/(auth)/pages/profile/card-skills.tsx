import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CardSkills() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Photoshop</Badge>
          <Badge variant="outline">Figma</Badge>
          <Badge variant="outline">HTML</Badge>
          <Badge variant="outline">React</Badge>
          <Badge variant="outline">Tailwind CSS</Badge>
          <Badge variant="outline">CSS</Badge>
          <Badge variant="outline">Laravel</Badge>
          <Badge variant="outline">Node.js</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
