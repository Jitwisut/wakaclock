import type React from 'react';

import { ArrowRightIcon, File, FileText, ImageIcon, Video } from 'lucide-react';
import Link from 'next/link';

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CountAnimation } from '@/components/ui/custom/count-animation';
import { Progress } from '@/components/ui/progress';

interface DataType {
  color: string;
  count: number;
  icon: React.ReactNode;
  indicatorColor: string;
  size: string;
  type: string;
  usagePercentage: number;
}

const data: DataType[] = [
  {
    type: 'Documents',
    icon: <FileText className="size-6" />,
    count: 1390,
    size: '2.1 GB',
    color: 'text-blue-500',
    indicatorColor: 'bg-blue-500',
    usagePercentage: 35,
  },
  {
    type: 'Images',
    icon: <ImageIcon className="size-6" />,
    count: 5678,
    size: '3.8 GB',
    color: 'text-green-500',
    indicatorColor: 'bg-green-500',
    usagePercentage: 62,
  },
  {
    type: 'Videos',
    icon: <Video className="size-6" />,
    count: 901,
    size: '7.5 GB',
    color: 'text-red-500',
    indicatorColor: 'bg-red-500',
    usagePercentage: 89,
  },
  {
    type: 'Others',
    icon: <File className="size-6" />,
    count: 234,
    size: '1.2 GB',
    color: 'text-yellow-500',
    indicatorColor: 'bg-yellow-500',
    usagePercentage: 28,
  },
];

export function SummaryCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {data.map((item) => (
        <Card className="pb-0" key={item.type}>
          <CardHeader>
            <CardTitle>{item.type}</CardTitle>
            <CardAction>
              <span className={item.color}>{item.icon}</span>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="font-display text-2xl lg:text-3xl">
              <CountAnimation value={item.count} />
            </div>
            <div className="space-y-2">
              <Progress indicatorColor={item.indicatorColor} value={item.usagePercentage} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">{item.size} used</span>
                <span className="text-muted-foreground text-sm">{item.usagePercentage}%</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-border flex items-center justify-end border-t p-0!">
            <Link
              className="text-primary hover:text-primary/90 flex items-center px-6 py-3 text-sm font-medium"
              href="#"
            >
              View more <ArrowRightIcon className="ms-1 size-4" />
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
